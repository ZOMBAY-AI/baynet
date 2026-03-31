/**
 * Types used by @baynet/react components.
 *
 * These are the view-model types — they correspond to the SDK's domain types
 * but are shaped for UI consumption (e.g., blurredUrl instead of blurredKey).
 */

export interface DetectionView {
  id: string;
  sourceType: string;
  sourceKey: string;
  blurredKey: string | null;
  /** Pre-resolved URL for the blurred image */
  blurredUrl: string | null;
  regions: RegionView[];
  hasViolation: boolean;
  regionCount: number;
  maxConfidence: number | null;
  minConfidence: number | null;
  reviewStatus: string;
  reviewPriority: number;
  createdAt: string;
  annotations?: AnnotationView[];
  /** Platform-specific metadata (e.g., sceneId, projectId) */
  metadata?: Record<string, unknown>;
}

export interface RegionView {
  class: string;
  score: number;
  box: [number, number, number, number];
  /** Optional category label */
  category?: string;
}

export interface AnnotationView {
  id: string;
  annotationType: string;
  originalRegionIndex: number | null;
  correctedClass: string | null;
  correctedBox: [number, number, number, number] | null;
  notes: string | null;
  annotatedBy: string;
  createdAt: string;
}

export interface ModerationStatsView {
  detections: {
    total: number;
    pending: number;
    approved: number;
    corrected: number;
    rejected: number;
    withViolation: number;
  };
  annotations: {
    total: number;
    confirms: number;
    falsePositives: number;
    missedDetections: number;
    boxCorrections: number;
    classCorrections: number;
  };
  falsePositiveRate: number;
}

export interface ReviewSubmission {
  detectionId: string;
  status: string;
  annotations?: Array<{
    type: string;
    regionIndex?: number;
    correctedClass?: string;
    correctedBox?: [number, number, number, number];
    notes?: string;
  }>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

/**
 * Data source callbacks — inject your own API/SDK calls.
 */
export interface BayNetDataSource {
  fetchQueue: (params: {
    status?: string;
    limit?: number;
    offset?: number;
  }) => Promise<PaginatedResult<DetectionView>>;

  fetchStats: () => Promise<ModerationStatsView>;

  fetchDetection: (id: string) => Promise<DetectionView>;

  submitReview: (submission: ReviewSubmission) => Promise<void>;

  batchReview: (detectionIds: string[], status: string) => Promise<void>;

  triggerExport: () => Promise<{
    imageCount: number;
    annotationCount: number;
    downloadUrl?: string;
  }>;
}
