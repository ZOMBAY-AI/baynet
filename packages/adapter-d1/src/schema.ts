/**
 * Drizzle ORM schema for BayNet D1 tables.
 *
 * These are the platform-agnostic moderation tables. Unlike the Zombay source
 * schema, they have no foreign keys to application-specific tables (scenes,
 * projects, jobs). Context is stored in the JSON `metadata` column instead.
 */

import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ─── Detections ────────────────────────────────────────────────────────────

export const detections = sqliteTable("baynet_detections", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceKey: text("source_key").notNull(),
  blurredKey: text("blurred_key"),

  regions: text("regions").notNull(), // JSON: DetectedRegion[]
  hasViolation: integer("has_violation", { mode: "boolean" }).notNull(),
  processingMs: integer("processing_ms"),
  imageWidth: integer("image_width"),
  imageHeight: integer("image_height"),

  regionCount: integer("region_count").notNull().default(0),
  maxConfidence: real("max_confidence"),
  minConfidence: real("min_confidence"),

  reviewStatus: text("review_status").notNull().default("pending"),
  reviewPriority: integer("review_priority").notNull().default(0),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  reviewedBy: text("reviewed_by"),

  metadata: text("metadata"), // JSON: platform-specific context (sceneId, projectId, etc.)

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("bnd_review_status_idx").on(table.reviewStatus),
  index("bnd_priority_idx").on(table.reviewPriority, table.reviewStatus),
  index("bnd_source_key_idx").on(table.sourceKey),
  index("bnd_created_idx").on(table.createdAt),
]);

// ─── Annotations ───────────────────────────────────────────────────────────

export const annotations = sqliteTable("baynet_annotations", {
  id: text("id").primaryKey(),
  detectionId: text("detection_id").notNull(),

  annotationType: text("annotation_type").notNull(),
  originalRegionIndex: integer("original_region_index"),
  correctedClass: text("corrected_class"),
  correctedBox: text("corrected_box"), // JSON: [x, y, w, h]
  notes: text("notes"),
  annotatedBy: text("annotated_by").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("bna_detection_idx").on(table.detectionId),
  index("bna_type_idx").on(table.annotationType),
]);

// ─── Training Exports ──────────────────────────────────────────────────────

export const trainingExports = sqliteTable("baynet_exports", {
  id: text("id").primaryKey(),
  format: text("format").notNull(), // "coco" | "yolo" | "csv"
  imageCount: integer("image_count").notNull(),
  annotationCount: integer("annotation_count").notNull(),
  storageKey: text("storage_key").notNull(),
  filterCriteria: text("filter_criteria"), // JSON
  exportedBy: text("exported_by").notNull(),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Audit Log ─────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("baynet_audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  targetIds: text("target_ids"), // JSON array
  details: text("details"), // JSON
  ipAddress: text("ip_address"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("bnal_user_idx").on(table.userId),
  index("bnal_action_idx").on(table.action),
  index("bnal_created_idx").on(table.createdAt),
]);

/**
 * SQL to create all BayNet tables.
 * Use this if you're not using Drizzle migrations.
 */
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS baynet_detections (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  blurred_key TEXT,
  regions TEXT NOT NULL,
  has_violation INTEGER NOT NULL,
  processing_ms INTEGER,
  image_width INTEGER,
  image_height INTEGER,
  region_count INTEGER NOT NULL DEFAULT 0,
  max_confidence REAL,
  min_confidence REAL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_priority INTEGER NOT NULL DEFAULT 0,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bnd_review_status_idx ON baynet_detections(review_status);
CREATE INDEX IF NOT EXISTS bnd_priority_idx ON baynet_detections(review_priority, review_status);
CREATE INDEX IF NOT EXISTS bnd_source_key_idx ON baynet_detections(source_key);
CREATE INDEX IF NOT EXISTS bnd_created_idx ON baynet_detections(created_at);

CREATE TABLE IF NOT EXISTS baynet_annotations (
  id TEXT PRIMARY KEY,
  detection_id TEXT NOT NULL,
  annotation_type TEXT NOT NULL,
  original_region_index INTEGER,
  corrected_class TEXT,
  corrected_box TEXT,
  notes TEXT,
  annotated_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bna_detection_idx ON baynet_annotations(detection_id);
CREATE INDEX IF NOT EXISTS bna_type_idx ON baynet_annotations(annotation_type);

CREATE TABLE IF NOT EXISTS baynet_exports (
  id TEXT PRIMARY KEY,
  format TEXT NOT NULL,
  image_count INTEGER NOT NULL,
  annotation_count INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  filter_criteria TEXT,
  exported_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS baynet_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_ids TEXT,
  details TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bnal_user_idx ON baynet_audit_log(user_id);
CREATE INDEX IF NOT EXISTS bnal_action_idx ON baynet_audit_log(action);
CREATE INDEX IF NOT EXISTS bnal_created_idx ON baynet_audit_log(created_at);
`;
