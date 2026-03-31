/**
 * ModerationDashboard — top-level component with tab navigation.
 *
 * This is the main entry point for embedding the BayNet moderation UI.
 * Provide a `dataSource` to connect it to your backend.
 */

import { useState, useEffect } from "react";
import type { BayNetDataSource, ModerationStatsView, DetectionView } from "./types.js";
import { ReviewQueue } from "./review-queue.js";
import { StatsView } from "./stats-view.js";

export interface ModerationDashboardProps {
  /** Data source callbacks — connect to your API/SDK */
  dataSource: BayNetDataSource;
  /** Custom class colors for bounding box visualization */
  classColors?: Record<string, string>;
  /** Custom class labels for missed-detection dropdowns */
  classLabels?: string[];
  /** Custom metadata renderer for the reviewer */
  renderMetadata?: (detection: DetectionView) => React.ReactNode;
}

export function ModerationDashboard({
  dataSource,
  classColors,
  classLabels,
  renderMetadata,
}: ModerationDashboardProps) {
  const [tab, setTab] = useState<"queue" | "stats">("queue");
  const [stats, setStats] = useState<ModerationStatsView | null>(null);

  const refreshStats = () => {
    dataSource.fetchStats().then(setStats).catch(console.error);
  };

  useEffect(() => { refreshStats(); }, []);

  return (
    <>
      {/* Tab bar + stats summary */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          <button
            onClick={() => setTab("queue")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === "queue" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Review Queue
          </button>
          <button
            onClick={() => setTab("stats")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === "stats" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Stats
          </button>
        </div>

        {stats && (
          <div className="flex gap-4 text-sm text-zinc-400 ml-auto">
            <span>
              <span className="text-yellow-400 font-mono">{stats.detections.pending}</span> pending
            </span>
            <span>
              <span className="text-green-400 font-mono">{stats.detections.approved}</span> approved
            </span>
            <span>
              <span className="text-blue-400 font-mono">{stats.detections.corrected}</span> corrected
            </span>
            <span>
              FP rate: <span className="text-orange-400 font-mono">{stats.falsePositiveRate}%</span>
            </span>
          </div>
        )}
      </div>

      {tab === "queue" && (
        <ReviewQueue
          dataSource={dataSource}
          onStatsChange={refreshStats}
          classColors={classColors}
          classLabels={classLabels}
          renderMetadata={renderMetadata}
        />
      )}
      {tab === "stats" && stats && (
        <StatsView stats={stats} onExport={dataSource.triggerExport} />
      )}
    </>
  );
}
