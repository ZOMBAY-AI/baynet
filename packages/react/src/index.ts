/**
 * @baynet/react — React dashboard components for BayNet content moderation.
 *
 * Usage:
 *   import { ModerationDashboard } from "@baynet/react";
 *
 *   <ModerationDashboard
 *     dataSource={{
 *       fetchQueue: async (params) => { ... },
 *       fetchStats: async () => { ... },
 *       fetchDetection: async (id) => { ... },
 *       submitReview: async (submission) => { ... },
 *       batchReview: async (ids, status) => { ... },
 *       triggerExport: async () => { ... },
 *     }}
 *   />
 */

// Main dashboard
export { ModerationDashboard, type ModerationDashboardProps } from "./dashboard.js";

// Individual components for custom layouts
export { ReviewQueue, type ReviewQueueProps } from "./review-queue.js";
export { DetectionReviewer, type DetectionReviewerProps } from "./detection-reviewer.js";
export { DetectionCard, type DetectionCardProps } from "./detection-card.js";
export { StatsView, ExportButton, type StatsViewProps } from "./stats-view.js";

// Types
export type {
  DetectionView,
  RegionView,
  AnnotationView,
  ModerationStatsView,
  ReviewSubmission,
  PaginatedResult,
  BayNetDataSource,
} from "./types.js";

// Constants (for customization)
export { DEFAULT_CLASS_COLORS, DEFAULT_CLASS_LABELS, STATUS_COLORS, STAT_COLORS } from "./constants.js";
