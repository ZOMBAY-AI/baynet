/**
 * Region validation — ensures detection data integrity before persistence.
 */

import type { DetectedRegion } from "./types.js";

/**
 * Validate and filter detected regions.
 * Invalid regions are logged and skipped. Returns only valid regions.
 */
export function validateRegions(
  regions: DetectedRegion[],
  options?: { logger?: (msg: string) => void }
): DetectedRegion[] {
  const log = options?.logger || console.warn;
  const validated: DetectedRegion[] = [];

  for (const r of regions) {
    if (
      typeof r.class !== "string" ||
      !r.class ||
      typeof r.score !== "number" ||
      !isFinite(r.score) ||
      r.score < 0 ||
      r.score > 1 ||
      !Array.isArray(r.box) ||
      r.box.length !== 4 ||
      r.box.some((v) => typeof v !== "number" || !isFinite(v) || v < 0)
    ) {
      log(`[baynet] Skipping invalid region: ${JSON.stringify(r).slice(0, 200)}`);
      continue;
    }

    validated.push({
      class: r.class,
      score: r.score,
      box: r.box as [number, number, number, number],
      category: r.category || "custom",
      backendId: r.backendId || "unknown",
    });
  }

  return validated;
}

/**
 * Validate annotation input fields.
 */
export function validateAnnotationInput(ann: {
  type: string;
  correctedClass?: string;
  correctedBox?: unknown;
  validClasses?: string[];
}): string | null {
  const validTypes = [
    "confirm",
    "false_positive",
    "missed_detection",
    "box_correction",
    "class_correction",
  ];

  if (!validTypes.includes(ann.type)) {
    return `Invalid annotation type: ${ann.type}`;
  }

  if (ann.type === "missed_detection") {
    if (!ann.correctedClass || !ann.correctedBox) {
      return "missed_detection requires correctedClass and correctedBox";
    }
  }

  if (ann.correctedClass && ann.validClasses) {
    if (!ann.validClasses.includes(ann.correctedClass)) {
      return `Invalid class: ${ann.correctedClass}`;
    }
  }

  if (ann.correctedBox) {
    const box = ann.correctedBox as number[];
    if (!Array.isArray(box) || box.length !== 4) {
      return "correctedBox must be [x, y, width, height]";
    }
    if (box.some((v) => typeof v !== "number" || v < 0 || !isFinite(v))) {
      return "correctedBox values must be non-negative finite numbers";
    }
  }

  return null; // valid
}
