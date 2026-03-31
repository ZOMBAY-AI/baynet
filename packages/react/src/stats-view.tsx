/**
 * StatsView — moderation statistics dashboard with stat cards and annotation breakdown.
 */

import { useState } from "react";
import type { ModerationStatsView } from "./types.js";
import { STAT_COLORS } from "./constants.js";

export interface StatsViewProps {
  stats: ModerationStatsView;
  onExport?: () => Promise<{ imageCount: number; annotationCount: number; downloadUrl?: string }>;
}

export function StatsView({ stats, onExport }: StatsViewProps) {
  const { detections: d, annotations: a, falsePositiveRate } = stats;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Detections" value={d.total} />
        <StatCard label="Pending Review" value={d.pending} color="yellow" />
        <StatCard label="Approved" value={d.approved} color="green" />
        <StatCard label="Corrected" value={d.corrected} color="blue" />
        <StatCard label="Rejected" value={d.rejected} color="red" />
        <StatCard label="With Violation" value={d.withViolation} />
        <StatCard label="False Positive Rate" value={`${falsePositiveRate}%`} color="orange" />
        <StatCard label="Total Annotations" value={a.total} />
      </div>

      <div className="bg-zinc-900 rounded-lg p-6">
        <h3 className="text-sm font-semibold mb-4">Annotation Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MiniStat label="Confirms" value={a.confirms} />
          <MiniStat label="False Positives" value={a.falsePositives} />
          <MiniStat label="Missed Detections" value={a.missedDetections} />
          <MiniStat label="Box Corrections" value={a.boxCorrections} />
          <MiniStat label="Class Corrections" value={a.classCorrections} />
        </div>
      </div>

      {onExport && (
        <div className="bg-zinc-900 rounded-lg p-6">
          <h3 className="text-sm font-semibold mb-2">Training Data Export</h3>
          <p className="text-zinc-400 text-sm mb-4">
            Export reviewed detections with human annotations as labeled training data.
          </p>
          <ExportButton onExport={onExport} fullWidth />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  const colorClass = color ? STAT_COLORS[color] || "text-white" : "text-white";

  return (
    <div className="bg-zinc-900 rounded-lg p-4">
      <div className="text-zinc-400 text-xs mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-xl font-mono font-bold">{value}</div>
      <div className="text-zinc-500 text-xs">{label}</div>
    </div>
  );
}

export function ExportButton({
  onExport,
  fullWidth,
}: {
  onExport: () => Promise<{ imageCount: number; annotationCount: number; downloadUrl?: string }>;
  fullWidth?: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ imageCount: number; annotationCount: number; downloadUrl?: string } | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await onExport();
      setResult(data);
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExporting(false);
  };

  return (
    <div className={fullWidth ? "" : "inline-block"}>
      <button
        onClick={handleExport}
        disabled={exporting}
        className={`px-4 py-2 bg-purple-900/50 text-purple-300 rounded text-sm font-medium hover:bg-purple-900/80 disabled:opacity-50 ${
          fullWidth ? "w-full" : ""
        }`}
      >
        {exporting ? "Exporting..." : "Export COCO Dataset"}
      </button>
      {result && (
        <div className="text-xs text-zinc-400 mt-2">
          Exported {result.imageCount} images, {result.annotationCount} annotations.
          {result.downloadUrl && (
            <>
              {" "}
              <a
                href={result.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline"
              >
                Download manifest
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
