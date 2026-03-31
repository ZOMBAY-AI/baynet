/**
 * BayNet — the main orchestrator class.
 *
 * Delegates all operations to pluggable adapters (database, storage, auth)
 * and detection backends. Provides the full HITL moderation pipeline.
 */

import { nanoid } from "nanoid";
import type { DatabaseAdapter, StorageAdapter, AuthAdapter } from "./adapters.js";
import type { DetectionBackend, DetectionResult } from "./backends.js";
import type {
  Detection,
  DetectedRegion,
  DetectionFilter,
  PaginatedResult,
  ModerationStats,
  ReviewStatus,
  SourceType,
  AnnotationType,
  AuditAction,
} from "./types.js";
import { CategoryRegistry, BUILTIN_CATEGORIES, type CategoryDefinition } from "./categories.js";
import { calculateReviewPriority } from "./priority.js";
import { validateRegions } from "./validation.js";
import { buildCocoManifest, type CocoManifest } from "./export-coco.js";

// ─── Configuration ──────────────────────────────────────────────────────────

export interface BayNetConfig {
  database: DatabaseAdapter;
  storage: StorageAdapter;
  auth: AuthAdapter;

  /** Detection backends to run (NudeNet, Gemini safety, etc.) */
  backends?: DetectionBackend[];

  /** Custom categories to register (merged with built-ins) */
  categories?: CategoryDefinition[];

  /** Lifecycle hooks */
  hooks?: {
    onDetection?: (detection: Detection) => Promise<void>;
    onReview?: (params: { detectionId: string; status: ReviewStatus }) => Promise<void>;
    /** REQUIRED if a csam_indicators backend is registered */
    onCsamIndicator?: (detection: Detection) => Promise<void>;
  };

  /** Max detections per COCO export (default: 500) */
  maxExportDetections?: number;

  /** Max batch review size (default: 100) */
  maxBatchSize?: number;
}

// ─── BayNet Class ───────────────────────────────────────────────────────────

export class BayNet {
  readonly db: DatabaseAdapter;
  readonly storage: StorageAdapter;
  readonly auth: AuthAdapter;
  readonly backends: DetectionBackend[];
  readonly categories: CategoryRegistry;
  readonly hooks: BayNetConfig["hooks"];
  readonly maxExportDetections: number;
  readonly maxBatchSize: number;

  constructor(config: BayNetConfig) {
    this.db = config.database;
    this.storage = config.storage;
    this.auth = config.auth;
    this.backends = config.backends || [];
    this.hooks = config.hooks;
    this.maxExportDetections = config.maxExportDetections || 500;
    this.maxBatchSize = config.maxBatchSize || 100;

    // Build category registry
    this.categories = new CategoryRegistry(BUILTIN_CATEGORIES);
    if (config.categories) {
      for (const cat of config.categories) {
        this.categories.register(cat);
      }
    }

    // Enforce CSAM hook requirement
    const hasCsamBackend = this.backends.some((b) => b.category === "csam_indicators");
    if (hasCsamBackend && !config.hooks?.onCsamIndicator) {
      throw new Error(
        "BayNet: A CSAM detection backend is registered but no onCsamIndicator hook is provided. " +
        "This hook is required for mandatory reporting obligations. " +
        "Provide hooks.onCsamIndicator in your BayNet config."
      );
    }
  }

  // ─── Detection Pipeline ─────────────────────────────────────────────────

  /**
   * Run all registered detection backends on an image and persist results.
   */
  async detectAndPersist(input: {
    imageBase64: string;
    mimeType: string;
    sourceType: SourceType;
    metadata?: Record<string, unknown>;
  }): Promise<{ detectionId: string | null; results: DetectionResult[] }> {
    if (this.backends.length === 0) {
      return { detectionId: null, results: [] };
    }

    // Run all backends in parallel
    const results = await Promise.allSettled(
      this.backends.map((backend) =>
        backend.detect({ imageBase64: input.imageBase64, mimeType: input.mimeType })
      )
    );

    // Merge regions from all backends
    const allRegions: DetectedRegion[] = [];
    const successfulResults: DetectionResult[] = [];
    let blurredBase64: string | undefined;
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;
    let totalProcessingMs = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        successfulResults.push(result.value);
        allRegions.push(...result.value.regions);
        if (result.value.blurredImageBase64) blurredBase64 = result.value.blurredImageBase64;
        if (result.value.imageWidth) imageWidth = result.value.imageWidth;
        if (result.value.imageHeight) imageHeight = result.value.imageHeight;
        if (result.value.processingMs) totalProcessingMs += result.value.processingMs;
      } else {
        console.error(`[baynet] Backend ${this.backends[i].id} failed:`, result.reason);
      }
    }

    // Validate regions
    const validRegions = validateRegions(allRegions);
    if (validRegions.length === 0) {
      return { detectionId: null, results: successfulResults };
    }

    // Persist detection
    const detectionId = await this.persistDetection({
      regions: validRegions,
      hasViolation: validRegions.length > 0,
      sourceType: input.sourceType,
      originalImageBase64: input.imageBase64,
      blurredImageBase64: blurredBase64 || input.imageBase64,
      mimeType: input.mimeType,
      imageWidth,
      imageHeight,
      processingMs: totalProcessingMs || undefined,
      metadata: input.metadata,
    });

    // Fire hooks
    if (detectionId && this.hooks?.onDetection) {
      const detection = await this.db.getDetection(detectionId);
      if (detection) {
        this.hooks.onDetection(detection).catch((err) =>
          console.error("[baynet] onDetection hook error:", err)
        );
      }
    }

    // CSAM hook — fire immediately on critical detections
    if (detectionId && this.hooks?.onCsamIndicator) {
      const hasCsam = validRegions.some((r) => r.category === "csam_indicators");
      if (hasCsam) {
        const detection = await this.db.getDetection(detectionId);
        if (detection) {
          this.hooks.onCsamIndicator(detection).catch((err) =>
            console.error("[baynet] CRITICAL: onCsamIndicator hook error:", err)
          );
        }
      }
    }

    return { detectionId, results: successfulResults };
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  async persistDetection(input: {
    regions: DetectedRegion[];
    hasViolation: boolean;
    sourceType: SourceType;
    originalImageBase64: string;
    blurredImageBase64: string;
    mimeType?: string;
    imageWidth?: number;
    imageHeight?: number;
    processingMs?: number;
    metadata?: Record<string, unknown>;
    safetyFlagged?: boolean;
  }): Promise<string | null> {
    try {
      const id = nanoid();
      const mime = input.mimeType || "image/png";
      const ext = mime.includes("webp") ? "webp" : "png";

      const sourceKey = `baynet/detections/${id}/original.${ext}`;
      const blurredKey = `baynet/detections/${id}/blurred.${ext}`;

      // Store images
      const originalBytes = base64ToUint8Array(input.originalImageBase64);
      const blurredBytes = base64ToUint8Array(input.blurredImageBase64);

      await Promise.all([
        this.storage.put(sourceKey, originalBytes, { contentType: mime }),
        this.storage.put(blurredKey, blurredBytes, { contentType: mime }),
      ]);

      // Calculate priority
      const scores = input.regions.map((r) => r.score);
      const priority = calculateReviewPriority({
        regions: input.regions,
        hasViolation: input.hasViolation,
        sourceType: input.sourceType,
        safetyFlagged: input.safetyFlagged,
        criticalCategories: ["csam_indicators"],
      });

      // Insert record
      await this.db.insertDetection({
        id,
        sourceType: input.sourceType,
        sourceKey,
        blurredKey,
        regions: JSON.stringify(input.regions),
        hasViolation: input.hasViolation,
        processingMs: input.processingMs || null,
        imageWidth: input.imageWidth || null,
        imageHeight: input.imageHeight || null,
        regionCount: input.regions.length,
        maxConfidence: scores.length > 0 ? Math.max(...scores) : null,
        minConfidence: scores.length > 0 ? Math.min(...scores) : null,
        reviewStatus: "pending",
        reviewPriority: priority,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      });

      return id;
    } catch (err: any) {
      console.error("[baynet] Failed to persist detection:", err.message);
      return null;
    }
  }

  // ─── Review Queue ───────────────────────────────────────────────────────

  async getReviewQueue(filter?: DetectionFilter): Promise<PaginatedResult<Detection>> {
    return this.db.queryDetections(filter || {});
  }

  async getDetection(id: string) {
    const detection = await this.db.getDetection(id);
    if (!detection) return null;

    const annotations = await this.db.getAnnotationsForDetection(id);
    return { ...detection, annotations };
  }

  // ─── Review Submission ──────────────────────────────────────────────────

  async submitReview(params: {
    detectionId: string;
    reviewerId: string;
    status: ReviewStatus;
    annotations?: Array<{
      type: AnnotationType;
      regionIndex?: number;
      correctedClass?: string;
      correctedBox?: [number, number, number, number];
      notes?: string;
    }>;
  }) {
    await this.db.updateDetectionReview({
      id: params.detectionId,
      status: params.status,
      reviewedBy: params.reviewerId,
      reviewedAt: new Date(),
    });

    if (params.annotations) {
      for (const a of params.annotations) {
        await this.db.insertAnnotation({
          id: nanoid(),
          detectionId: params.detectionId,
          annotationType: a.type,
          originalRegionIndex: a.regionIndex ?? null,
          correctedClass: a.correctedClass || null,
          correctedBox: a.correctedBox ? JSON.stringify(a.correctedBox) : null,
          notes: a.notes || null,
          annotatedBy: params.reviewerId,
        });
      }
    }

    if (this.hooks?.onReview) {
      this.hooks.onReview({
        detectionId: params.detectionId,
        status: params.status,
      }).catch((err) => console.error("[baynet] onReview hook error:", err));
    }
  }

  // ─── Batch Review ───────────────────────────────────────────────────────

  async batchReview(params: {
    detectionIds: string[];
    reviewerId: string;
    status: ReviewStatus;
  }) {
    const ids = params.detectionIds.slice(0, this.maxBatchSize);
    for (const id of ids) {
      await this.db.updateDetectionReview({
        id,
        status: params.status,
        reviewedBy: params.reviewerId,
        reviewedAt: new Date(),
      });
    }
    return { reviewed: ids.length };
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  async getStats(): Promise<ModerationStats> {
    const [detections, annotations] = await Promise.all([
      this.db.getDetectionStats(),
      this.db.getAnnotationStats(),
    ]);

    const totalAnnotated = (annotations.confirms || 0) + (annotations.falsePositives || 0);
    const falsePositiveRate =
      totalAnnotated > 0
        ? Math.round(((annotations.falsePositives || 0) / totalAnnotated) * 1000) / 10
        : 0;

    return { detections, annotations, falsePositiveRate };
  }

  // ─── COCO Export ────────────────────────────────────────────────────────

  async exportCoco(params: {
    exporterId: string;
    includeUnreviewed?: boolean;
  }): Promise<{ manifest: CocoManifest; imageKeys: string[]; exportId: string }> {
    const filter: DetectionFilter = params.includeUnreviewed
      ? { limit: this.maxExportDetections }
      : { status: "approved", limit: this.maxExportDetections };

    const { items: detections } = await this.db.queryDetections(filter);

    // Also fetch corrected detections
    if (!params.includeUnreviewed) {
      const { items: corrected } = await this.db.queryDetections({
        status: "corrected",
        limit: this.maxExportDetections,
      });
      detections.push(...corrected);
    }

    // Fetch annotations for these detections
    const annotationsByDetection = new Map<string, any[]>();
    for (const det of detections) {
      const anns = await this.db.getAnnotationsForDetection(det.id);
      if (anns.length > 0) {
        annotationsByDetection.set(det.id, anns);
      }
    }

    const { manifest, imageKeys } = buildCocoManifest({
      detections,
      annotationsByDetection,
      categories: this.categories,
    });

    // Record export
    const exportId = nanoid();
    const storageKey = `baynet/exports/${exportId}/manifest.json`;

    await this.db.insertExport({
      id: exportId,
      format: "coco",
      imageCount: manifest.images.length,
      annotationCount: manifest.annotations.length,
      storageKey,
      filterCriteria: JSON.stringify({ includeUnreviewed: params.includeUnreviewed || false }),
      exportedBy: params.exporterId,
    });

    // Store manifest
    const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    await this.storage.put(storageKey, manifestBytes, { contentType: "application/json" });

    return { manifest, imageKeys, exportId };
  }

  // ─── Audit ──────────────────────────────────────────────────────────────

  async logAudit(params: {
    userId: string;
    action: AuditAction;
    targetIds?: string[];
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    try {
      await this.db.insertAuditEntry({
        id: nanoid(),
        userId: params.userId,
        action: params.action,
        targetIds: params.targetIds ? JSON.stringify(params.targetIds) : null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress || null,
      });
    } catch (err: any) {
      console.error("[baynet] Audit log failed:", err.message);
    }
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  // Workers / browser fallback
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
