import { describe, it, expect } from "vitest";
import { BayNet } from "../baynet.js";
import type { DatabaseAdapter } from "../adapters.js";
import type { StorageAdapter } from "../adapters.js";

// Minimal mock adapters for testing initialization
const mockDb: DatabaseAdapter = {
  insertDetection: async () => {},
  getDetection: async () => null,
  queryDetections: async () => ({ items: [], total: 0 }),
  updateDetectionReview: async () => {},
  insertAnnotation: async () => {},
  getAnnotationsForDetection: async () => [],
  insertExport: async () => {},
  insertAuditEntry: async () => {},
  getDetectionStats: async () => ({ total: 0, pending: 0, approved: 0, corrected: 0, rejected: 0, withViolation: 0 }),
  getAnnotationStats: async () => ({ total: 0, confirms: 0, falsePositives: 0, missedDetections: 0, boxCorrections: 0, classCorrections: 0 }),
};

const mockStorage: StorageAdapter = {
  put: async () => {},
  get: async () => null,
  getUrl: async () => "https://example.com/mock",
  delete: async () => {},
};

describe("BayNet initialization", () => {
  it("creates instance with minimal config", () => {
    const baynet = new BayNet({
      database: mockDb,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
    });
    expect(baynet).toBeInstanceOf(BayNet);
    expect(baynet.backends).toHaveLength(0);
  });

  it("registers builtin categories by default", () => {
    const baynet = new BayNet({
      database: mockDb,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
    });
    expect(baynet.categories.getAllCategories().length).toBe(7);
    expect(baynet.categories.getCocoCategoryId("FEMALE_BREAST_EXPOSED")).toBe(1);
  });

  it("throws if CSAM backend registered without hook", () => {
    expect(() => {
      new BayNet({
        database: mockDb,
        storage: mockStorage,
        auth: { authenticate: async () => null, isReviewer: async () => false },
        backends: [
          { id: "test-csam", category: "csam_indicators", detect: async () => ({ regions: [], hasViolation: false }) },
        ],
      });
    }).toThrow("onCsamIndicator");
  });

  it("accepts CSAM backend with hook", () => {
    const baynet = new BayNet({
      database: mockDb,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
      backends: [
        { id: "test-csam", category: "csam_indicators", detect: async () => ({ regions: [], hasViolation: false }) },
      ],
      hooks: {
        onCsamIndicator: async () => {},
      },
    });
    expect(baynet.backends).toHaveLength(1);
  });

  it("respects maxBatchSize config", () => {
    const baynet = new BayNet({
      database: mockDb,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
      maxBatchSize: 50,
    });
    expect(baynet.maxBatchSize).toBe(50);
  });

  it("respects maxExportDetections config", () => {
    const baynet = new BayNet({
      database: mockDb,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
      maxExportDetections: 1000,
    });
    expect(baynet.maxExportDetections).toBe(1000);
  });

  it("registers custom categories alongside builtins", () => {
    const baynet = new BayNet({
      database: mockDb,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
      categories: [{
        id: "custom",
        displayName: "Custom",
        severity: "low",
        classes: [{ id: 999, name: "MY_CLASS", category: "custom" }],
      }],
    });
    expect(baynet.categories.getCocoCategoryId("MY_CLASS")).toBe(999);
    // Builtins still present
    expect(baynet.categories.getCocoCategoryId("HANDGUN")).toBe(300);
  });
});

describe("BayNet.getStats", () => {
  it("calculates false positive rate", async () => {
    const db: DatabaseAdapter = {
      ...mockDb,
      getDetectionStats: async () => ({ total: 10, pending: 5, approved: 3, corrected: 1, rejected: 1, withViolation: 8 }),
      getAnnotationStats: async () => ({ total: 20, confirms: 15, falsePositives: 5, missedDetections: 0, boxCorrections: 0, classCorrections: 0 }),
    };

    const baynet = new BayNet({
      database: db,
      storage: mockStorage,
      auth: { authenticate: async () => null, isReviewer: async () => false },
    });

    const stats = await baynet.getStats();
    expect(stats.detections.total).toBe(10);
    expect(stats.annotations.falsePositives).toBe(5);
    // FP rate: 5 / (15 + 5) = 25%
    expect(stats.falsePositiveRate).toBe(25);
  });
});
