/**
 * Default color mappings and class labels for the dashboard UI.
 */

/** Color per detection class for bounding box visualization */
export const DEFAULT_CLASS_COLORS: Record<string, string> = {
  FEMALE_BREAST_EXPOSED: "#e74c3c",
  MALE_BREAST_EXPOSED: "#e67e22",
  FEMALE_GENITALIA_EXPOSED: "#9b59b6",
  MALE_GENITALIA_EXPOSED: "#3498db",
  BUTTOCKS_EXPOSED: "#f39c12",
  ANUS_EXPOSED: "#1abc9c",
};

/** Tailwind classes per review status */
export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-900/40 text-yellow-300",
  approved: "bg-green-900/40 text-green-300",
  corrected: "bg-blue-900/40 text-blue-300",
  rejected: "bg-red-900/40 text-red-300",
  skipped: "bg-zinc-800 text-zinc-400",
};

/** Color classes for stat cards */
export const STAT_COLORS: Record<string, string> = {
  yellow: "text-yellow-400",
  green: "text-green-400",
  blue: "text-blue-400",
  red: "text-red-400",
  orange: "text-orange-400",
  purple: "text-purple-400",
};

/** Default NudeNet class labels for dropdowns */
export const DEFAULT_CLASS_LABELS = [
  "FEMALE_BREAST_EXPOSED",
  "MALE_BREAST_EXPOSED",
  "FEMALE_GENITALIA_EXPOSED",
  "MALE_GENITALIA_EXPOSED",
  "BUTTOCKS_EXPOSED",
  "ANUS_EXPOSED",
];
