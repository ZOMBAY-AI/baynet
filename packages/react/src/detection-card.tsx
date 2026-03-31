/**
 * DetectionCard — grid thumbnail for the review queue.
 *
 * Shows blurred preview, region count, priority badge, review status,
 * and max confidence. Supports checkbox selection for batch actions.
 */

import { useState } from "react";
import type { DetectionView } from "./types.js";
import { STATUS_COLORS } from "./constants.js";

export interface DetectionCardProps {
  detection: DetectionView;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onOpen: () => void;
}

export function DetectionCard({
  detection,
  selected,
  onSelect,
  onOpen,
}: DetectionCardProps) {
  const confidenceColor =
    (detection.maxConfidence || 0) > 0.8
      ? "text-green-400"
      : (detection.maxConfidence || 0) > 0.5
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div
      className={`relative bg-zinc-900 rounded-lg overflow-hidden border cursor-pointer transition hover:border-zinc-500 ${
        selected ? "border-blue-500 ring-1 ring-blue-500/30" : "border-zinc-800"
      }`}
    >
      {/* Select checkbox */}
      <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-blue-500"
        />
      </div>

      {/* Blurred thumbnail */}
      <div className="aspect-video bg-zinc-800 relative" onClick={onOpen}>
        {detection.blurredUrl ? (
          <img
            src={detection.blurredUrl}
            alt="Blurred preview"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
            No preview
          </div>
        )}

        {/* Region count badge */}
        <div className="absolute top-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-xs font-mono">
          {detection.regionCount} region{detection.regionCount !== 1 ? "s" : ""}
        </div>

        {/* Priority indicator */}
        {detection.reviewPriority >= 50 && (
          <div className="absolute bottom-2 right-2 bg-red-900/80 text-red-300 rounded px-1.5 py-0.5 text-xs font-mono">
            P{detection.reviewPriority}
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="px-2 py-1.5 flex items-center gap-2 text-xs" onClick={onOpen}>
        <span className={`${STATUS_COLORS[detection.reviewStatus] || ""} px-1.5 py-0.5 rounded`}>
          {detection.reviewStatus}
        </span>
        <span className={`${confidenceColor} font-mono`}>
          {detection.maxConfidence?.toFixed(2) || "–"}
        </span>
        <span className="text-zinc-500 ml-auto">{detection.sourceType}</span>
      </div>
    </div>
  );
}
