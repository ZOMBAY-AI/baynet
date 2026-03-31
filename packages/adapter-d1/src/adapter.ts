/**
 * Cloudflare D1 DatabaseAdapter implementation.
 *
 * Uses Drizzle ORM to translate the BayNet SDK's DatabaseAdapter interface
 * into D1 queries against the baynet_* tables.
 */

import { eq, and, desc, asc, sql, count } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type {
  DatabaseAdapter,
  Detection,
  InsertDetection,
  InsertAnnotation,
  InsertExport,
  InsertAuditEntry,
  Annotation,
  DetectionFilter,
  PaginatedResult,
  DetectionStats,
  AnnotationStats,
  ReviewStatus,
} from "@baynet/sdk";
import * as schema from "./schema.js";

export interface D1AdapterConfig {
  /** Drizzle D1 database instance */
  db: DrizzleD1Database<typeof schema>;
}

export class D1DatabaseAdapter implements DatabaseAdapter {
  private db: DrizzleD1Database<typeof schema>;

  constructor(config: D1AdapterConfig) {
    this.db = config.db;
  }

  // ─── Detections ──────────────────────────────────────────────────────────

  async insertDetection(record: InsertDetection): Promise<void> {
    await this.db.insert(schema.detections).values({
      id: record.id,
      sourceType: record.sourceType,
      sourceKey: record.sourceKey,
      blurredKey: record.blurredKey,
      regions: record.regions,
      hasViolation: record.hasViolation,
      processingMs: record.processingMs,
      imageWidth: record.imageWidth,
      imageHeight: record.imageHeight,
      regionCount: record.regionCount,
      maxConfidence: record.maxConfidence,
      minConfidence: record.minConfidence,
      reviewStatus: record.reviewStatus,
      reviewPriority: record.reviewPriority,
      metadata: record.metadata,
    });
  }

  async getDetection(id: string): Promise<Detection | null> {
    const [row] = await this.db
      .select()
      .from(schema.detections)
      .where(eq(schema.detections.id, id))
      .limit(1);

    return row ? this.rowToDetection(row) : null;
  }

  async queryDetections(filter: DetectionFilter): Promise<PaginatedResult<Detection>> {
    const conditions = [];

    if (filter.status) {
      conditions.push(eq(schema.detections.reviewStatus, filter.status));
    }
    if (filter.sourceType) {
      conditions.push(eq(schema.detections.sourceType, filter.sourceType));
    }
    if (filter.hasViolation !== undefined) {
      conditions.push(eq(schema.detections.hasViolation, filter.hasViolation));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schema.detections)
        .where(where)
        .orderBy(desc(schema.detections.reviewPriority), asc(schema.detections.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(schema.detections)
        .where(where),
    ]);

    return {
      items: items.map((row) => this.rowToDetection(row)),
      total: totalResult[0]?.count || 0,
    };
  }

  async updateDetectionReview(params: {
    id: string;
    status: ReviewStatus;
    reviewedBy: string;
    reviewedAt: Date;
  }): Promise<void> {
    await this.db
      .update(schema.detections)
      .set({
        reviewStatus: params.status,
        reviewedBy: params.reviewedBy,
        reviewedAt: params.reviewedAt,
      })
      .where(eq(schema.detections.id, params.id));
  }

  // ─── Annotations ─────────────────────────────────────────────────────────

  async insertAnnotation(record: InsertAnnotation): Promise<void> {
    await this.db.insert(schema.annotations).values({
      id: record.id,
      detectionId: record.detectionId,
      annotationType: record.annotationType,
      originalRegionIndex: record.originalRegionIndex,
      correctedClass: record.correctedClass,
      correctedBox: record.correctedBox,
      notes: record.notes,
      annotatedBy: record.annotatedBy,
    });
  }

  async getAnnotationsForDetection(detectionId: string): Promise<Annotation[]> {
    const rows = await this.db
      .select()
      .from(schema.annotations)
      .where(eq(schema.annotations.detectionId, detectionId));

    return rows.map((row) => ({
      id: row.id,
      detectionId: row.detectionId,
      annotationType: row.annotationType as Annotation["annotationType"],
      originalRegionIndex: row.originalRegionIndex,
      correctedClass: row.correctedClass,
      correctedBox: row.correctedBox ? JSON.parse(row.correctedBox) : null,
      notes: row.notes,
      annotatedBy: row.annotatedBy,
      createdAt: row.createdAt,
    }));
  }

  // ─── Exports ─────────────────────────────────────────────────────────────

  async insertExport(record: InsertExport): Promise<void> {
    await this.db.insert(schema.trainingExports).values({
      id: record.id,
      format: record.format,
      imageCount: record.imageCount,
      annotationCount: record.annotationCount,
      storageKey: record.storageKey,
      filterCriteria: record.filterCriteria,
      exportedBy: record.exportedBy,
    });
  }

  // ─── Audit ───────────────────────────────────────────────────────────────

  async insertAuditEntry(record: InsertAuditEntry): Promise<void> {
    await this.db.insert(schema.auditLog).values({
      id: record.id,
      userId: record.userId,
      action: record.action,
      targetIds: record.targetIds,
      details: record.details,
      ipAddress: record.ipAddress,
    });
  }

  // ─── Stats ───────────────────────────────────────────────────────────────

  async getDetectionStats(): Promise<DetectionStats> {
    const [result] = await this.db
      .select({
        total: count(),
        pending: sql<number>`COUNT(CASE WHEN ${schema.detections.reviewStatus} = 'pending' THEN 1 END)`,
        approved: sql<number>`COUNT(CASE WHEN ${schema.detections.reviewStatus} = 'approved' THEN 1 END)`,
        corrected: sql<number>`COUNT(CASE WHEN ${schema.detections.reviewStatus} = 'corrected' THEN 1 END)`,
        rejected: sql<number>`COUNT(CASE WHEN ${schema.detections.reviewStatus} = 'rejected' THEN 1 END)`,
        withViolation: sql<number>`COUNT(CASE WHEN ${schema.detections.hasViolation} = 1 THEN 1 END)`,
      })
      .from(schema.detections);

    return {
      total: result?.total || 0,
      pending: result?.pending || 0,
      approved: result?.approved || 0,
      corrected: result?.corrected || 0,
      rejected: result?.rejected || 0,
      withViolation: result?.withViolation || 0,
    };
  }

  async getAnnotationStats(): Promise<AnnotationStats> {
    const [result] = await this.db
      .select({
        total: count(),
        confirms: sql<number>`COUNT(CASE WHEN ${schema.annotations.annotationType} = 'confirm' THEN 1 END)`,
        falsePositives: sql<number>`COUNT(CASE WHEN ${schema.annotations.annotationType} = 'false_positive' THEN 1 END)`,
        missedDetections: sql<number>`COUNT(CASE WHEN ${schema.annotations.annotationType} = 'missed_detection' THEN 1 END)`,
        boxCorrections: sql<number>`COUNT(CASE WHEN ${schema.annotations.annotationType} = 'box_correction' THEN 1 END)`,
        classCorrections: sql<number>`COUNT(CASE WHEN ${schema.annotations.annotationType} = 'class_correction' THEN 1 END)`,
      })
      .from(schema.annotations);

    return {
      total: result?.total || 0,
      confirms: result?.confirms || 0,
      falsePositives: result?.falsePositives || 0,
      missedDetections: result?.missedDetections || 0,
      boxCorrections: result?.boxCorrections || 0,
      classCorrections: result?.classCorrections || 0,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private rowToDetection(row: typeof schema.detections.$inferSelect): Detection {
    return {
      id: row.id,
      sourceType: row.sourceType as Detection["sourceType"],
      sourceKey: row.sourceKey,
      blurredKey: row.blurredKey,
      regions: JSON.parse(row.regions),
      hasViolation: row.hasViolation,
      processingMs: row.processingMs,
      imageWidth: row.imageWidth,
      imageHeight: row.imageHeight,
      regionCount: row.regionCount,
      maxConfidence: row.maxConfidence,
      minConfidence: row.minConfidence,
      reviewStatus: row.reviewStatus as Detection["reviewStatus"],
      reviewPriority: row.reviewPriority,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      createdAt: row.createdAt,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
