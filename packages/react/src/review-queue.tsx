/**
 * ReviewQueue — paginated grid of detection cards with batch actions.
 */

import { useState, useEffect, useCallback } from "react";
import type { DetectionView, BayNetDataSource, ReviewSubmission } from "./types.js";
import { DetectionCard } from "./detection-card.js";
import { DetectionReviewer } from "./detection-reviewer.js";
import { ExportButton } from "./stats-view.js";

export interface ReviewQueueProps {
  dataSource: BayNetDataSource;
  onStatsChange?: () => void;
  /** Items per page (default: 20) */
  pageSize?: number;
  /** Custom class colors for the reviewer */
  classColors?: Record<string, string>;
  /** Custom class labels for missed-detection dropdowns */
  classLabels?: string[];
  /** Custom metadata renderer for the reviewer */
  renderMetadata?: (detection: DetectionView) => React.ReactNode;
}

export function ReviewQueue({
  dataSource,
  onStatsChange,
  pageSize = 20,
  classColors,
  classLabels,
  renderMetadata,
}: ReviewQueueProps) {
  const [items, setItems] = useState<DetectionView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDetection, setActiveDetection] = useState<DetectionView | null>(null);
  const [offset, setOffset] = useState(0);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const result = await dataSource.fetchQueue({
        status: statusFilter || undefined,
        limit: pageSize,
        offset,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to load queue:", err);
    }
    setLoading(false);
  }, [dataSource, statusFilter, offset, pageSize]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleBatchAction = async (status: string) => {
    if (selected.size === 0) return;
    await dataSource.batchReview(Array.from(selected), status);
    setSelected(new Set());
    loadQueue();
    onStatsChange?.();
  };

  const handleOpenDetail = async (det: DetectionView) => {
    const full = await dataSource.fetchDetection(det.id);
    setActiveDetection(full);
  };

  const handleReviewSubmit = async (submission: ReviewSubmission) => {
    await dataSource.submitReview(submission);
    setActiveDetection(null);
    loadQueue();
    onStatsChange?.();
  };

  if (activeDetection) {
    return (
      <DetectionReviewer
        detection={activeDetection}
        onBack={() => {
          setActiveDetection(null);
          loadQueue();
          onStatsChange?.();
        }}
        onSubmit={handleReviewSubmit}
        classColors={classColors}
        classLabels={classLabels}
        renderMetadata={renderMetadata}
      />
    );
  }

  return (
    <div>
      {/* Filters + batch actions */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="corrected">Corrected</option>
          <option value="rejected">Rejected</option>
        </select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm text-zinc-400">{selected.size} selected</span>
            <button
              onClick={() => handleBatchAction("approved")}
              className="px-3 py-1 bg-green-900/50 text-green-300 rounded text-sm hover:bg-green-900/80"
            >
              Approve
            </button>
            <button
              onClick={() => handleBatchAction("rejected")}
              className="px-3 py-1 bg-red-900/50 text-red-300 rounded text-sm hover:bg-red-900/80"
            >
              Reject
            </button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          <ExportButton onExport={dataSource.triggerExport} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-zinc-500 text-center py-12">Loading queue...</div>
      ) : items.length === 0 ? (
        <div className="text-zinc-500 text-center py-12">No detections to review</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((item) => (
            <DetectionCard
              key={item.id}
              detection={item}
              selected={selected.has(item.id)}
              onSelect={(sel) => {
                const next = new Set(selected);
                sel ? next.add(item.id) : next.delete(item.id);
                setSelected(next);
              }}
              onOpen={() => handleOpenDetail(item)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setOffset(Math.max(0, offset - pageSize))}
            disabled={offset === 0}
            className="px-3 py-1 bg-zinc-800 rounded text-sm disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-400">
            {offset + 1}–{Math.min(offset + pageSize, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + pageSize)}
            disabled={offset + pageSize >= total}
            className="px-3 py-1 bg-zinc-800 rounded text-sm disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
