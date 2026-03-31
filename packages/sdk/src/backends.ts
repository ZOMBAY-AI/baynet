/**
 * Detection backend interface — pluggable content analysis engines.
 *
 * Each backend analyzes images and returns detected regions with
 * bounding boxes, confidence scores, and class labels.
 */

import type { DetectedRegion, DetectionCategory } from "./types.js";

export interface DetectionInput {
  /** Base64-encoded image data */
  imageBase64: string;
  /** MIME type (e.g., "image/png", "image/webp") */
  mimeType: string;
}

export interface DetectionResult {
  /** Detected regions with bounding boxes */
  regions: DetectedRegion[];
  /** Whether any violation was found */
  hasViolation: boolean;
  /** Processing time in milliseconds */
  processingMs?: number;
  /** Image dimensions (if available from the backend) */
  imageWidth?: number;
  imageHeight?: number;
  /** Blurred version of the image (if backend provides blur) */
  blurredImageBase64?: string;
  /** Backend-specific raw response for debugging */
  raw?: unknown;
}

export interface DetectionBackend {
  /** Unique identifier (e.g., "nudenet", "gemini-safety") */
  readonly id: string;
  /** What category this backend detects */
  readonly category: DetectionCategory;
  /** Run detection on an image */
  detect(input: DetectionInput): Promise<DetectionResult>;
}

// ─── Built-in Backends ──────────────────────────────────────────────────────

/**
 * NudeNet backend — NSFW region detection via external Flask service.
 *
 * The NudeNet service is a separate microservice (see services/nudenet-blur/).
 * It accepts base64 images, returns bounding boxes + blurred versions.
 */
export function nudenetBackend(config: {
  /** URL of the NudeNet service (e.g., "https://nudenet.example.com") */
  url: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}): DetectionBackend {
  return {
    id: "nudenet",
    category: "nudity",
    async detect(input: DetectionInput): Promise<DetectionResult> {
      const resp = await fetch(`${config.url}/blur`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: input.imageBase64 }),
        signal: AbortSignal.timeout(config.timeout || 30000),
      });

      if (!resp.ok) {
        throw new Error(`NudeNet service error: ${resp.status}`);
      }

      const data = (await resp.json()) as {
        blurred: string;
        regions: Array<{ class: string; score: number; box: number[] }>;
        has_explicit: boolean;
        processing_ms: number;
        width?: number;
        height?: number;
      };

      return {
        regions: (data.regions || []).map((r) => ({
          class: r.class,
          score: r.score,
          box: r.box as [number, number, number, number],
          category: "nudity" as const,
          backendId: "nudenet",
        })),
        hasViolation: data.has_explicit,
        processingMs: data.processing_ms,
        imageWidth: data.width,
        imageHeight: data.height,
        blurredImageBase64: data.blurred,
      };
    },
  };
}

/**
 * Gemini Vision safety backend — detect minors in images using Gemini AI.
 *
 * CRITICAL: This is a safety-critical classifier. It fails closed —
 * any error, timeout, or ambiguous response results in a violation flag.
 */
export function geminiSafetyBackend(config: {
  /** Gemini API key */
  apiKey: string;
  /** Model ID (default: gemini-3.1-flash-lite-preview) */
  model?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}): DetectionBackend {
  const model = config.model || "gemini-3.1-flash-lite-preview";

  return {
    id: "gemini-safety",
    category: "csam_indicators",
    async detect(input: DetectionInput): Promise<DetectionResult> {
      const safetyPrompt = `You are a child safety classifier. Your ONLY task is to determine whether the image contains a person who appears to be a minor (under 18 years old).

Analyze the image ONLY. Look for:
- Youthful facial features (round face, small chin, large eyes relative to face)
- Small body proportions or stature suggesting a child or adolescent
- Any visual cues suggesting the person is under 18

Do NOT consider any text, captions, or metadata — classify based solely on visual appearance.

When in doubt, flag as detected. False positives are acceptable — false negatives are NOT.

Respond in JSON: { "minorDetected": true/false, "confidence": "high|medium|low", "reasoning": "..." }`;

      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": config.apiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: safetyPrompt },
                    { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.0,
              },
            }),
            signal: AbortSignal.timeout(config.timeout || 30000),
          }
        );

        if (!resp.ok) {
          // Fail closed
          return { regions: [failClosedRegion()], hasViolation: true };
        }

        const data = (await resp.json()) as any;
        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason;

        if (
          finishReason === "SAFETY" ||
          finishReason === "PROHIBITED_CONTENT" ||
          data.promptFeedback?.blockReason
        ) {
          return { regions: [failClosedRegion()], hasViolation: true };
        }

        const text = candidate?.content?.parts?.[0]?.text;
        if (!text) {
          return { regions: [failClosedRegion()], hasViolation: true };
        }

        const result = JSON.parse(text) as {
          minorDetected: boolean;
          confidence: string;
          reasoning: string;
        };

        if (result.minorDetected) {
          return {
            regions: [
              {
                class: "MINOR_DETECTED",
                score: result.confidence === "high" ? 0.95 : result.confidence === "medium" ? 0.7 : 0.4,
                box: [0, 0, 0, 0], // full-image classification, no specific box
                category: "csam_indicators",
                backendId: "gemini-safety",
              },
            ],
            hasViolation: true,
          };
        }

        return { regions: [], hasViolation: false };
      } catch {
        // Fail closed on any error
        return { regions: [failClosedRegion()], hasViolation: true };
      }
    },
  };

  function failClosedRegion(): DetectedRegion {
    return {
      class: "MINOR_DETECTED",
      score: 0.5,
      box: [0, 0, 0, 0],
      category: "csam_indicators",
      backendId: "gemini-safety",
    };
  }
}
