/**
 * Tests for D1DatabaseAdapter.
 *
 * Uses a mock Drizzle DB that tracks calls — we can't run real D1 in unit tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { D1DatabaseAdapter } from "../adapter.js";
import type { InsertDetection, InsertAnnotation, InsertAuditEntry, InsertExport } from "@baynet/sdk";

// ─── Mock Drizzle DB ───────────────────────────────────────────────────────

function createMockDb() {
  // Build a chainable query builder that resolves to mockRows
  function chainable(mockRows: any[] = []) {
    const chain: any = {};
    // Use a function that lazily returns chain to avoid TDZ issues
    const self = () => chain;
    chain.from = vi.fn().mockImplementation(() => self());
    chain.where = vi.fn().mockImplementation(() => self());
    chain.orderBy = vi.fn().mockImplementation(() => self());
    chain.limit = vi.fn().mockImplementation(() => self());
    chain.offset = vi.fn().mockImplementation(() => self());
    chain.set = vi.fn().mockImplementation(() => self());
    // Make it thenable so await resolves to mockRows
    chain.then = (resolve: any) => resolve(mockRows);
    chain[Symbol.toStringTag] = "Promise";
    return chain;
  }

  const selectChain = chainable([{ count: 0 }]);
  const db: any = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(selectChain),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return db;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("D1DatabaseAdapter", () => {
  let adapter: D1DatabaseAdapter;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    adapter = new D1DatabaseAdapter({ db: mockDb as any });
  });

  describe("insertDetection", () => {
    it("calls db.insert with correct values", async () => {
      const record: InsertDetection = {
        id: "det_1",
        sourceType: "preview",
        sourceKey: "baynet/detections/det_1/original.png",
        blurredKey: "baynet/detections/det_1/blurred.png",
        regions: JSON.stringify([{ class: "FEMALE_BREAST_EXPOSED", score: 0.85, box: [10, 20, 50, 60], category: "nudity", backendId: "nudenet" }]),
        hasViolation: true,
        processingMs: 150,
        imageWidth: 512,
        imageHeight: 512,
        regionCount: 1,
        maxConfidence: 0.85,
        minConfidence: 0.85,
        reviewStatus: "pending",
        reviewPriority: 40,
      };

      await adapter.insertDetection(record);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const valuesCall = mockDb.insert.mock.results[0].value.values;
      expect(valuesCall).toHaveBeenCalledTimes(1);
      const inserted = valuesCall.mock.calls[0][0];
      expect(inserted.id).toBe("det_1");
      expect(inserted.sourceType).toBe("preview");
      expect(inserted.reviewPriority).toBe(40);
    });
  });

  describe("insertAnnotation", () => {
    it("calls db.insert for annotations", async () => {
      const record: InsertAnnotation = {
        id: "ann_1",
        detectionId: "det_1",
        annotationType: "confirm",
        originalRegionIndex: 0,
        correctedClass: null,
        correctedBox: null,
        notes: "Looks correct",
        annotatedBy: "reviewer_1",
      };

      await adapter.insertAnnotation(record);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const inserted = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(inserted.id).toBe("ann_1");
      expect(inserted.annotationType).toBe("confirm");
    });
  });

  describe("insertExport", () => {
    it("calls db.insert for exports", async () => {
      const record: InsertExport = {
        id: "exp_1",
        format: "coco",
        imageCount: 10,
        annotationCount: 25,
        storageKey: "baynet/exports/exp_1/manifest.json",
        filterCriteria: JSON.stringify({ includeUnreviewed: false }),
        exportedBy: "admin_1",
      };

      await adapter.insertExport(record);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const inserted = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(inserted.id).toBe("exp_1");
      expect(inserted.format).toBe("coco");
    });
  });

  describe("insertAuditEntry", () => {
    it("calls db.insert for audit entries", async () => {
      const record: InsertAuditEntry = {
        id: "audit_1",
        userId: "admin_1",
        action: "review",
        targetIds: JSON.stringify(["det_1"]),
        details: null,
        ipAddress: "127.0.0.1",
      };

      await adapter.insertAuditEntry(record);

      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      const inserted = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(inserted.userId).toBe("admin_1");
      expect(inserted.action).toBe("review");
    });
  });

  describe("updateDetectionReview", () => {
    it("calls db.update with status and reviewer", async () => {
      await adapter.updateDetectionReview({
        id: "det_1",
        status: "approved",
        reviewedBy: "reviewer_1",
        reviewedAt: new Date("2026-03-31"),
      });

      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDetectionStats", () => {
    it("calls select with aggregation on detections table", async () => {
      const stats = await adapter.getDetectionStats();

      expect(mockDb.select).toHaveBeenCalled();
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("approved");
    });
  });

  describe("getAnnotationStats", () => {
    it("calls select with aggregation on annotations table", async () => {
      const stats = await adapter.getAnnotationStats();

      expect(mockDb.select).toHaveBeenCalled();
      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("confirms");
      expect(stats).toHaveProperty("falsePositives");
    });
  });
});

describe("D1DatabaseAdapter schema", () => {
  it("exports CREATE_TABLES_SQL with all 4 tables", async () => {
    const { CREATE_TABLES_SQL } = await import("../schema.js");

    expect(CREATE_TABLES_SQL).toContain("baynet_detections");
    expect(CREATE_TABLES_SQL).toContain("baynet_annotations");
    expect(CREATE_TABLES_SQL).toContain("baynet_exports");
    expect(CREATE_TABLES_SQL).toContain("baynet_audit_log");
  });

  it("CREATE_TABLES_SQL includes all indexes", async () => {
    const { CREATE_TABLES_SQL } = await import("../schema.js");

    expect(CREATE_TABLES_SQL).toContain("bnd_review_status_idx");
    expect(CREATE_TABLES_SQL).toContain("bnd_priority_idx");
    expect(CREATE_TABLES_SQL).toContain("bna_detection_idx");
    expect(CREATE_TABLES_SQL).toContain("bnal_user_idx");
  });
});
