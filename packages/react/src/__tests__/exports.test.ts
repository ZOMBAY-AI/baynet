/**
 * Tests that @baynet/react exports all expected components and types.
 */

import { describe, it, expect } from "vitest";

describe("@baynet/react exports", () => {
  it("exports ModerationDashboard", async () => {
    const mod = await import("../index.js");
    expect(mod.ModerationDashboard).toBeDefined();
    expect(typeof mod.ModerationDashboard).toBe("function");
  });

  it("exports ReviewQueue", async () => {
    const mod = await import("../index.js");
    expect(mod.ReviewQueue).toBeDefined();
    expect(typeof mod.ReviewQueue).toBe("function");
  });

  it("exports DetectionReviewer", async () => {
    const mod = await import("../index.js");
    expect(mod.DetectionReviewer).toBeDefined();
    expect(typeof mod.DetectionReviewer).toBe("function");
  });

  it("exports DetectionCard", async () => {
    const mod = await import("../index.js");
    expect(mod.DetectionCard).toBeDefined();
    expect(typeof mod.DetectionCard).toBe("function");
  });

  it("exports StatsView", async () => {
    const mod = await import("../index.js");
    expect(mod.StatsView).toBeDefined();
    expect(typeof mod.StatsView).toBe("function");
  });

  it("exports ExportButton", async () => {
    const mod = await import("../index.js");
    expect(mod.ExportButton).toBeDefined();
    expect(typeof mod.ExportButton).toBe("function");
  });

  it("exports constants", async () => {
    const mod = await import("../index.js");
    expect(mod.DEFAULT_CLASS_COLORS).toBeDefined();
    expect(mod.DEFAULT_CLASS_LABELS).toBeInstanceOf(Array);
    expect(mod.STATUS_COLORS).toBeDefined();
    expect(mod.STAT_COLORS).toBeDefined();
  });

  it("DEFAULT_CLASS_COLORS has standard NudeNet classes", async () => {
    const { DEFAULT_CLASS_COLORS } = await import("../index.js");
    expect(DEFAULT_CLASS_COLORS).toHaveProperty("FEMALE_BREAST_EXPOSED");
    expect(DEFAULT_CLASS_COLORS).toHaveProperty("BUTTOCKS_EXPOSED");
  });

  it("DEFAULT_CLASS_LABELS has 6 entries", async () => {
    const { DEFAULT_CLASS_LABELS } = await import("../index.js");
    expect(DEFAULT_CLASS_LABELS).toHaveLength(6);
  });
});
