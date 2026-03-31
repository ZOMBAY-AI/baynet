import { describe, it, expect } from "vitest";
import { calculateReviewPriority } from "../priority.js";
import type { DetectedRegion } from "../types.js";

function region(cls: string, score: number, category = "nudity" as const): DetectedRegion {
  return { class: cls, score, box: [100, 100, 200, 200], category, backendId: "test" };
}

describe("calculateReviewPriority", () => {
  it("returns 0 for empty regions", () => {
    expect(calculateReviewPriority({ regions: [], hasViolation: false, sourceType: "preview" })).toBe(0);
  });

  it("adds +40 for low confidence (<0.5)", () => {
    const p = calculateReviewPriority({
      regions: [region("TEST", 0.35)],
      hasViolation: true,
      sourceType: "preview",
    });
    expect(p).toBeGreaterThanOrEqual(40);
  });

  it("adds +20 for medium confidence (0.5-0.7)", () => {
    const p = calculateReviewPriority({
      regions: [region("TEST", 0.6)],
      hasViolation: true,
      sourceType: "preview",
    });
    expect(p).toBeGreaterThanOrEqual(20);
    expect(p).toBeLessThan(40);
  });

  it("adds +15 for wide confidence spread", () => {
    const p = calculateReviewPriority({
      regions: [region("A", 0.9), region("B", 0.35)],
      hasViolation: true,
      sourceType: "preview",
    });
    expect(p).toBe(55); // 40 (low) + 15 (spread)
  });

  it("adds +30 for safetyFlagged", () => {
    const p = calculateReviewPriority({
      regions: [region("TEST", 0.95)],
      hasViolation: true,
      sourceType: "preview",
      safetyFlagged: true,
    });
    expect(p).toBe(30);
  });

  it("adds +50 for reported source", () => {
    const p = calculateReviewPriority({
      regions: [region("TEST", 0.95)],
      hasViolation: true,
      sourceType: "reported",
    });
    expect(p).toBe(50);
  });

  it("adds +25 for critical categories", () => {
    const p = calculateReviewPriority({
      regions: [region("MINOR_DETECTED", 0.95, "csam_indicators")],
      hasViolation: true,
      sourceType: "preview",
      criticalCategories: ["csam_indicators"],
    });
    expect(p).toBe(25);
  });

  it("caps at 100", () => {
    const p = calculateReviewPriority({
      regions: [region("A", 0.9), region("B", 0.3, "csam_indicators")],
      hasViolation: true,
      sourceType: "reported",
      safetyFlagged: true,
      criticalCategories: ["csam_indicators"],
    });
    expect(p).toBe(100);
  });
});
