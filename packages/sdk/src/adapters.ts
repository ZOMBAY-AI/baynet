/**
 * Adapter interfaces — plug in any database, storage, or auth system.
 */

import type {
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
} from "./types.js";

// ─── Database Adapter ───────────────────────────────────────────────────────

export interface DatabaseAdapter {
  // Detections
  insertDetection(record: InsertDetection): Promise<void>;
  getDetection(id: string): Promise<Detection | null>;
  queryDetections(filter: DetectionFilter): Promise<PaginatedResult<Detection>>;
  updateDetectionReview(params: {
    id: string;
    status: ReviewStatus;
    reviewedBy: string;
    reviewedAt: Date;
  }): Promise<void>;

  // Annotations
  insertAnnotation(record: InsertAnnotation): Promise<void>;
  getAnnotationsForDetection(detectionId: string): Promise<Annotation[]>;

  // Exports
  insertExport(record: InsertExport): Promise<void>;

  // Audit
  insertAuditEntry(record: InsertAuditEntry): Promise<void>;

  // Stats
  getDetectionStats(): Promise<DetectionStats>;
  getAnnotationStats(): Promise<AnnotationStats>;
}

// ─── Storage Adapter ────────────────────────────────────────────────────────

export interface StorageAdapter {
  /** Store a binary object */
  put(key: string, data: Uint8Array, metadata?: { contentType?: string }): Promise<void>;
  /** Retrieve a binary object (null if not found) */
  get(key: string): Promise<Uint8Array | null>;
  /** Get a URL for accessing the object (signed or proxied) */
  getUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string>;
  /** Delete an object */
  delete(key: string): Promise<void>;
}

// ─── Auth Adapter ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email?: string;
  roles?: string[];
}

export interface AuthAdapter {
  /** Verify a request and return the authenticated user, or null */
  authenticate(request: Request): Promise<AuthUser | null>;
  /** Check if a user has reviewer/admin privileges */
  isReviewer(userId: string): Promise<boolean>;
}

/**
 * Simple auth adapter from a function — for quick setup.
 *
 * Usage:
 *   auth: simpleAuth({ isReviewer: (id) => ADMIN_IDS.includes(id) })
 */
export function simpleAuth(config: {
  authenticate?: (request: Request) => Promise<AuthUser | null>;
  isReviewer: (userId: string) => boolean | Promise<boolean>;
}): AuthAdapter {
  return {
    authenticate: config.authenticate || (async () => null),
    isReviewer: async (userId) => config.isReviewer(userId),
  };
}
