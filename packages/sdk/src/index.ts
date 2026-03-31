/**
 * @baynet/sdk — Open-source HITL content moderation + AI training data pipeline.
 *
 * Usage:
 *   import { BayNet, nudenetBackend } from "@baynet/sdk";
 *
 *   const baynet = new BayNet({
 *     database: yourDatabaseAdapter,
 *     storage: yourStorageAdapter,
 *     auth: { isReviewer: (id) => ADMIN_IDS.includes(id) },
 *     backends: [nudenetBackend({ url: "https://nudenet.example.com" })],
 *   });
 */

// Core class
export { BayNet, type BayNetConfig } from "./baynet.js";

// Adapter interfaces
export {
  type DatabaseAdapter,
  type StorageAdapter,
  type AuthAdapter,
  type AuthUser,
  simpleAuth,
} from "./adapters.js";

// Detection backends
export {
  type DetectionBackend,
  type DetectionInput,
  type DetectionResult,
  nudenetBackend,
  geminiSafetyBackend,
} from "./backends.js";

// Categories
export {
  CategoryRegistry,
  BUILTIN_CATEGORIES,
  type CategoryDefinition,
  type CategoryClass,
} from "./categories.js";

// Types
export type {
  DetectionCategory,
  ReviewStatus,
  SourceType,
  AnnotationType,
  DetectedRegion,
  Detection,
  InsertDetection,
  Annotation,
  InsertAnnotation,
  TrainingExport,
  InsertExport,
  AuditAction,
  InsertAuditEntry,
  DetectionStats,
  AnnotationStats,
  ModerationStats,
  DetectionFilter,
  PaginatedResult,
} from "./types.js";

// Utilities
export { calculateReviewPriority, type PriorityParams } from "./priority.js";
export { validateRegions, validateAnnotationInput } from "./validation.js";
export { buildCocoManifest, type CocoManifest, type ExportCocoParams } from "./export-coco.js";
