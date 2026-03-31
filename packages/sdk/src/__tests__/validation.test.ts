import { describe, it, expect } from "vitest";
import { validateRegions, validateAnnotationInput } from "../validation.js";
import type { DetectedRegion } from "../types.js";

function region(overrides: Partial<DetectedRegion> = {}): DetectedRegion {
  return {
    class: "FEMALE_BREAST_EXPOSED",
    score: 0.85,
    box: [100, 100, 200, 200],
    category: "nudity",
    backendId: "nudenet",
    ...overrides,
  };
}

describe("validateRegions", () => {
  it("accepts valid regions", () => {
    const result = validateRegions([region()]);
    expect(result).toHaveLength(1);
    expect(result[0].class).toBe("FEMALE_BREAST_EXPOSED");
  });

  it("rejects region with empty class", () => {
    const result = validateRegions([region({ class: "" })]);
    expect(result).toHaveLength(0);
  });

  it("rejects region with score > 1", () => {
    const result = validateRegions([region({ score: 1.5 })]);
    expect(result).toHaveLength(0);
  });

  it("rejects region with negative score", () => {
    const result = validateRegions([region({ score: -0.1 })]);
    expect(result).toHaveLength(0);
  });

  it("rejects region with NaN score", () => {
    const result = validateRegions([region({ score: NaN })]);
    expect(result).toHaveLength(0);
  });

  it("rejects region with wrong box length", () => {
    const result = validateRegions([region({ box: [1, 2, 3] as any })]);
    expect(result).toHaveLength(0);
  });

  it("rejects region with negative box value", () => {
    const result = validateRegions([region({ box: [-1, 100, 200, 200] })]);
    expect(result).toHaveLength(0);
  });

  it("keeps valid regions and skips invalid ones", () => {
    const result = validateRegions([
      region(),
      region({ score: 999 }),
      region({ class: "BUTTOCKS_EXPOSED" }),
    ]);
    expect(result).toHaveLength(2);
  });

  it("defaults missing category to 'custom'", () => {
    const result = validateRegions([region({ category: undefined as any })]);
    expect(result[0].category).toBe("custom");
  });
});

describe("validateAnnotationInput", () => {
  it("accepts valid confirm annotation", () => {
    expect(validateAnnotationInput({ type: "confirm" })).toBeNull();
  });

  it("rejects invalid type", () => {
    expect(validateAnnotationInput({ type: "delete_everything" })).toContain("Invalid annotation type");
  });

  it("rejects missed_detection without required fields", () => {
    expect(validateAnnotationInput({ type: "missed_detection" })).toContain("requires correctedClass");
  });

  it("validates correctedClass against allowlist", () => {
    const err = validateAnnotationInput({
      type: "class_correction",
      correctedClass: "INVALID_CLASS",
      validClasses: ["FEMALE_BREAST_EXPOSED"],
    });
    expect(err).toContain("Invalid class");
  });

  it("validates correctedBox format", () => {
    const err = validateAnnotationInput({
      type: "box_correction",
      correctedBox: [1, 2, 3],
    });
    expect(err).toContain("[x, y, width, height]");
  });

  it("validates correctedBox values are non-negative", () => {
    const err = validateAnnotationInput({
      type: "box_correction",
      correctedBox: [1, -1, 3, 4],
    });
    expect(err).toContain("non-negative");
  });
});
