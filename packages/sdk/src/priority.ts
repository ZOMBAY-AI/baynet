/**
 * Active learning priority scoring.
 *
 * Higher priority = review first. Prioritizes uncertain predictions
 * (low confidence) since those are most valuable as training corrections.
 */

import type { DetectedRegion, DetectionCategory } from "./types.js";

export interface PriorityParams {
  regions: DetectedRegion[];
  hasViolation: boolean;
  sourceType: string;
  /** Flagged by a safety classifier (e.g., CSAM detection) */
  safetyFlagged?: boolean;
  /** Categories with critical severity boost priority */
  criticalCategories?: DetectionCategory[];
}

export function calculateReviewPriority(params: PriorityParams): number {
  const { regions, sourceType, safetyFlagged, criticalCategories } = params;

  let priority = 0;

  if (regions.length === 0) return 0;

  const scores = regions.map((r) => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  // Low confidence detections are most valuable for training
  if (minScore < 0.5) priority += 40;
  else if (minScore < 0.7) priority += 20;

  // Wide confidence spread = mixed certainty, interesting for review
  if (maxScore - minScore > 0.4) priority += 15;

  // Safety classifier flag → urgent
  if (safetyFlagged) priority += 30;

  // User-reported content is highest priority
  if (sourceType === "reported") priority += 50;

  // Completed/published content matters more (user-facing)
  if (sourceType === "completed_video") priority += 10;

  // Critical category regions boost priority
  if (criticalCategories && criticalCategories.length > 0) {
    const hasCritical = regions.some((r) =>
      criticalCategories.includes(r.category)
    );
    if (hasCritical) priority += 25;
  }

  return Math.min(priority, 100);
}
