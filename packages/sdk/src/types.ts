/**
 * Core types for the BayNet content moderation pipeline.
 */

// ─── Detection Categories ───────────────────────────────────────────────────

export type DetectionCategory =
  | "nudity"
  | "violence"
  | "weapons"
  | "hate_symbols"
  | "drugs"
  | "csam_indicators"
  | "text_in_image"
  | "custom";

export type ReviewStatus = "pending" | "approved" | "corrected" | "rejected" | "skipped";

export type SourceType = "preview" | "checkpoint" | "reference" | "completed_video" | "reported";

export type AnnotationType =
  | "confirm"
  | "false_positive"
  | "missed_detection"
  | "box_correction"
  | "class_correction";

// ─── Detected Regions ───────────────────────────────────────────────────────

export interface DetectedRegion {
  /** Class label (e.g., "FEMALE_BREAST_EXPOSED", "HANDGUN", "BLOOD") */
  class: string;
  /** Confidence score 0-1 */
  score: number;
  /** Bounding box [x, y, width, height] in pixels */
  box: [number, number, number, number];
  /** Which detection category this region belongs to */
  category: DetectionCategory;
  /** Which detection backend produced this region */
  backendId: string;
}

// ─── Detection Records ──────────────────────────────────────────────────────

export interface Detection {
  id: string;
  sourceType: SourceType;
  sourceKey: string;
  blurredKey: string | null;
  regions: DetectedRegion[];
  hasViolation: boolean;
  processingMs: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  regionCount: number;
  maxConfidence: number | null;
  minConfidence: number | null;
  reviewStatus: ReviewStatus;
  reviewPriority: number;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
  // Optional context (platform-specific)
  metadata?: Record<string, unknown>;
}

export interface InsertDetection {
  id: string;
  sourceType: SourceType;
  sourceKey: string;
  blurredKey: string | null;
  regions: string; // JSON stringified DetectedRegion[]
  hasViolation: boolean;
  processingMs: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  regionCount: number;
  maxConfidence: number | null;
  minConfidence: number | null;
  reviewStatus: ReviewStatus;
  reviewPriority: number;
  metadata?: string; // JSON stringified
}

// ─── Annotations ────────────────────────────────────────────────────────────

export interface Annotation {
  id: string;
  detectionId: string;
  annotationType: AnnotationType;
  originalRegionIndex: number | null;
  correctedClass: string | null;
  correctedBox: [number, number, number, number] | null;
  notes: string | null;
  annotatedBy: string;
  createdAt: Date;
}

export interface InsertAnnotation {
  id: string;
  detectionId: string;
  annotationType: AnnotationType;
  originalRegionIndex: number | null;
  correctedClass: string | null;
  correctedBox: string | null; // JSON stringified
  notes: string | null;
  annotatedBy: string;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export interface TrainingExport {
  id: string;
  format: "coco" | "yolo" | "csv";
  imageCount: number;
  annotationCount: number;
  storageKey: string;
  filterCriteria: string | null;
  exportedBy: string;
  createdAt: Date;
}

export interface InsertExport {
  id: string;
  format: "coco" | "yolo" | "csv";
  imageCount: number;
  annotationCount: number;
  storageKey: string;
  filterCriteria: string | null;
  exportedBy: string;
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export type AuditAction = "review" | "batch_review" | "export" | "detection_view";

export interface InsertAuditEntry {
  id: string;
  userId: string;
  action: AuditAction;
  targetIds: string | null; // JSON array
  details: string | null;   // JSON object
  ipAddress: string | null;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface DetectionStats {
  total: number;
  pending: number;
  approved: number;
  corrected: number;
  rejected: number;
  withViolation: number;
}

export interface AnnotationStats {
  total: number;
  confirms: number;
  falsePositives: number;
  missedDetections: number;
  boxCorrections: number;
  classCorrections: number;
}

export interface ModerationStats {
  detections: DetectionStats;
  annotations: AnnotationStats;
  falsePositiveRate: number;
}

// ─── Query ──────────────────────────────────────────────────────────────────

export interface DetectionFilter {
  status?: ReviewStatus;
  sourceType?: SourceType;
  hasViolation?: boolean;
  category?: DetectionCategory;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
