import { describe, it, expect } from "vitest";
import { CategoryRegistry, BUILTIN_CATEGORIES } from "../categories.js";

describe("CategoryRegistry", () => {
  it("initializes with builtin categories", () => {
    const registry = new CategoryRegistry();
    expect(registry.getAllCategories().length).toBe(7);
  });

  it("resolves NudeNet classes", () => {
    const registry = new CategoryRegistry();
    const cls = registry.getClass("FEMALE_BREAST_EXPOSED");
    expect(cls).toBeDefined();
    expect(cls!.id).toBe(1);
    expect(cls!.category).toBe("nudity");
  });

  it("resolves violence classes", () => {
    const registry = new CategoryRegistry();
    expect(registry.getCocoCategoryId("BLOOD")).toBe(200);
    expect(registry.getCategoryForClass("BLOOD")).toBe("violence");
  });

  it("resolves weapon classes", () => {
    const registry = new CategoryRegistry();
    expect(registry.getCocoCategoryId("HANDGUN")).toBe(300);
  });

  it("resolves CSAM classes", () => {
    const registry = new CategoryRegistry();
    expect(registry.getCocoCategoryId("MINOR_DETECTED")).toBe(100);
    expect(registry.getCategoryForClass("MINOR_DETECTED")).toBe("csam_indicators");
  });

  it("returns undefined for unknown classes", () => {
    const registry = new CategoryRegistry();
    expect(registry.getClass("UNKNOWN")).toBeUndefined();
    expect(registry.getCocoCategoryId("UNKNOWN")).toBeUndefined();
  });

  it("registers custom categories", () => {
    const registry = new CategoryRegistry();
    registry.register({
      id: "custom",
      displayName: "Custom",
      severity: "low",
      classes: [{ id: 900, name: "CUSTOM_THING", category: "custom" }],
    });
    expect(registry.getCocoCategoryId("CUSTOM_THING")).toBe(900);
  });

  it("generates COCO categories array", () => {
    const registry = new CategoryRegistry();
    const coco = registry.toCoco();
    expect(coco.length).toBeGreaterThan(0);
    expect(coco[0]).toHaveProperty("id");
    expect(coco[0]).toHaveProperty("name");
    expect(coco[0]).toHaveProperty("supercategory");
  });

  it("has no duplicate COCO IDs across categories", () => {
    const registry = new CategoryRegistry();
    const ids = registry.getAllClasses().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("BUILTIN_CATEGORIES", () => {
  it("has 7 categories", () => {
    expect(BUILTIN_CATEGORIES).toHaveLength(7);
  });

  it("nudity has 6 classes", () => {
    const nudity = BUILTIN_CATEGORIES.find((c) => c.id === "nudity");
    expect(nudity!.classes).toHaveLength(6);
  });

  it("csam_indicators is critical severity", () => {
    const csam = BUILTIN_CATEGORIES.find((c) => c.id === "csam_indicators");
    expect(csam!.severity).toBe("critical");
  });

  it("all classes have unique IDs", () => {
    const allIds = BUILTIN_CATEGORIES.flatMap((c) => c.classes.map((cls) => cls.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
