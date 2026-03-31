/**
 * DetectionReviewer — full-page annotation view for a single detection.
 *
 * Features:
 * - SVG bounding box overlay on the blurred image
 * - Per-region confirm/false-positive annotation buttons
 * - Draw mode for missed detections (click-drag on image)
 * - Review notes and submit actions (approve/correct/reject/skip)
 */

import { useState } from "react";
import type { DetectionView, RegionView, ReviewSubmission } from "./types.js";
import { DEFAULT_CLASS_COLORS, DEFAULT_CLASS_LABELS, STATUS_COLORS } from "./constants.js";

interface RegionAnnotation {
  type: string;
  notes?: string;
}

interface DrawnBox {
  box: [number, number, number, number];
  className: string;
  notes?: string;
}

export interface DetectionReviewerProps {
  detection: DetectionView;
  onBack: () => void;
  onSubmit: (submission: ReviewSubmission) => Promise<void>;
  /** Custom class colors (merged with defaults) */
  classColors?: Record<string, string>;
  /** Custom class label options for missed-detection dropdowns */
  classLabels?: string[];
  /** Render custom metadata section */
  renderMetadata?: (detection: DetectionView) => React.ReactNode;
}

export function DetectionReviewer({
  detection,
  onBack,
  onSubmit,
  classColors: userColors,
  classLabels = DEFAULT_CLASS_LABELS,
  renderMetadata,
}: DetectionReviewerProps) {
  const classColors = { ...DEFAULT_CLASS_COLORS, ...userColors };
  const [annotations, setAnnotations] = useState<Map<number, RegionAnnotation>>(new Map());
  const [drawnBoxes, setDrawnBoxes] = useState<DrawnBox[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [drawMode, setDrawMode] = useState(false);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  const handleRegionAction = (index: number, type: string) => {
    const next = new Map(annotations);
    if (next.get(index)?.type === type) {
      next.delete(index);
    } else {
      next.set(index, { ...next.get(index), type });
    }
    setAnnotations(next);
  };

  const handleRegionNotes = (index: number, notes: string) => {
    const next = new Map(annotations);
    const existing = next.get(index) || { type: "confirm" };
    next.set(index, { ...existing, notes });
    setAnnotations(next);
  };

  const mouseToSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = imgSize.width / rect.width;
    const scaleY = imgSize.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawMode) return;
    const pt = mouseToSvg(e);
    setDrawing({ startX: pt.x, startY: pt.y, curX: pt.x, curY: pt.y });
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const pt = mouseToSvg(e);
    setDrawing({ ...drawing, curX: pt.x, curY: pt.y });
  };

  const handleSvgMouseUp = () => {
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.curX);
    const y = Math.min(drawing.startY, drawing.curY);
    const w = Math.abs(drawing.curX - drawing.startX);
    const h = Math.abs(drawing.curY - drawing.startY);

    if (w >= 10 && h >= 10) {
      setDrawnBoxes([...drawnBoxes, {
        box: [x, y, w, h],
        className: classLabels[0] || "UNKNOWN",
      }]);
    }
    setDrawing(null);
    setDrawMode(false);
  };

  const removeDrawnBox = (index: number) => {
    setDrawnBoxes(drawnBoxes.filter((_, i) => i !== index));
  };

  const updateDrawnBoxClass = (index: number, className: string) => {
    const next = [...drawnBoxes];
    next[index] = { ...next[index], className };
    setDrawnBoxes(next);
  };

  const updateDrawnBoxNotes = (index: number, notes: string) => {
    const next = [...drawnBoxes];
    next[index] = { ...next[index], notes };
    setDrawnBoxes(next);
  };

  const totalAnnotationCount = annotations.size + drawnBoxes.length;

  const handleSubmit = async (status: string) => {
    setSubmitting(true);

    const anns: ReviewSubmission["annotations"] = [];

    for (const [idx, ann] of annotations.entries()) {
      anns.push({
        type: ann.type,
        regionIndex: idx,
        notes: ann.notes || (reviewNotes ? reviewNotes : undefined),
      });
    }

    for (const drawn of drawnBoxes) {
      anns.push({
        type: "missed_detection",
        correctedClass: drawn.className,
        correctedBox: drawn.box,
        notes: drawn.notes || undefined,
      });
    }

    await onSubmit({
      detectionId: detection.id,
      status,
      annotations: anns.length > 0 ? anns : undefined,
    });

    setSubmitting(false);
  };

  const drawPreview = drawing ? {
    x: Math.min(drawing.startX, drawing.curX),
    y: Math.min(drawing.startY, drawing.curY),
    w: Math.abs(drawing.curX - drawing.startX),
    h: Math.abs(drawing.curY - drawing.startY),
  } : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-zinc-800 rounded text-sm hover:bg-zinc-700"
        >
          Back to queue
        </button>
        <h2 className="text-lg font-semibold">Detection {detection.id.slice(0, 8)}...</h2>
        <span className={`${STATUS_COLORS[detection.reviewStatus]} px-2 py-0.5 rounded text-sm`}>
          {detection.reviewStatus}
        </span>
        <span className="text-sm text-zinc-400 ml-auto">
          Priority: {detection.reviewPriority} | Source: {detection.sourceType}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image with bounding box overlay */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setDrawMode(!drawMode)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                drawMode
                  ? "bg-orange-900/60 text-orange-300 ring-1 ring-orange-500/50"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {drawMode ? "Drawing... click and drag on image" : "Draw missed region"}
            </button>
            {drawMode && (
              <button
                onClick={() => { setDrawMode(false); setDrawing(null); }}
                className="px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="relative bg-zinc-900 rounded-lg overflow-hidden">
            {detection.blurredUrl ? (
              <div className="relative">
                <img
                  src={detection.blurredUrl}
                  alt="Detection"
                  className={`w-full ${drawMode ? "cursor-crosshair" : ""}`}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                  draggable={false}
                />
                {imgSize.width > 0 && (
                  <svg
                    className={`absolute inset-0 w-full h-full ${drawMode ? "cursor-crosshair" : "pointer-events-none"}`}
                    viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    onMouseDown={handleSvgMouseDown}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={() => { if (drawing) setDrawing(null); }}
                  >
                    {/* NudeNet-detected regions */}
                    {detection.regions.map((region, i) => {
                      const [x, y, w, h] = region.box;
                      const color = classColors[region.class] || "#ffffff";
                      const ann = annotations.get(i);
                      const isFP = ann?.type === "false_positive";
                      const isConfirmed = ann?.type === "confirm";

                      return (
                        <g key={`region-${i}`}>
                          <rect
                            x={x} y={y} width={w} height={h}
                            fill="none"
                            stroke={isFP ? "#666" : isConfirmed ? "#22c55e" : color}
                            strokeWidth={isFP ? 1 : 2}
                            strokeDasharray={isFP ? "4,4" : "none"}
                            opacity={isFP ? 0.4 : 0.9}
                          />
                          <text
                            x={x + 4} y={y - 4}
                            fill={color}
                            fontSize={Math.max(12, imgSize.width / 80)}
                            fontFamily="monospace"
                          >
                            {region.class.replace("_EXPOSED", "").toLowerCase()} ({region.score.toFixed(2)})
                          </text>
                        </g>
                      );
                    })}

                    {/* Human-drawn missed detection boxes */}
                    {drawnBoxes.map((drawn, i) => {
                      const [x, y, w, h] = drawn.box;
                      return (
                        <g key={`drawn-${i}`}>
                          <rect
                            x={x} y={y} width={w} height={h}
                            fill="rgba(249, 115, 22, 0.1)"
                            stroke="#f97316"
                            strokeWidth={2}
                            strokeDasharray="6,3"
                          />
                          <text
                            x={x + 4} y={y - 4}
                            fill="#f97316"
                            fontSize={Math.max(12, imgSize.width / 80)}
                            fontFamily="monospace"
                          >
                            + {drawn.className.replace("_EXPOSED", "").toLowerCase()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Drawing preview */}
                    {drawPreview && drawPreview.w > 0 && drawPreview.h > 0 && (
                      <rect
                        x={drawPreview.x} y={drawPreview.y}
                        width={drawPreview.w} height={drawPreview.h}
                        fill="rgba(249, 115, 22, 0.15)"
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="4,4"
                      />
                    )}
                  </svg>
                )}
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center text-zinc-600">
                No image available
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Region list */}
          <div className="bg-zinc-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">
              Detected Regions ({detection.regions.length})
            </h3>
            <div className="space-y-2">
              {detection.regions.map((region, i) => {
                const ann = annotations.get(i);
                return (
                  <div key={i} className="bg-zinc-800 rounded p-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: classColors[region.class] || "#fff" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-xs truncate">
                          {region.class.replace(/_/g, " ").toLowerCase()}
                        </div>
                        <div className="text-zinc-500 text-xs">
                          conf: {region.score.toFixed(3)} | box: [{region.box.join(", ")}]
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRegionAction(i, "confirm")}
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            ann?.type === "confirm"
                              ? "bg-green-900 text-green-300"
                              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                          }`}
                          title="Confirm detection"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => handleRegionAction(i, "false_positive")}
                          className={`px-1.5 py-0.5 rounded text-xs ${
                            ann?.type === "false_positive"
                              ? "bg-red-900 text-red-300"
                              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                          }`}
                          title="Mark as false positive"
                        >
                          FP
                        </button>
                      </div>
                    </div>
                    {ann && (
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={ann.notes || ""}
                        onChange={(e) => handleRegionNotes(i, e.target.value)}
                        className="mt-1.5 w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs placeholder-zinc-500"
                      />
                    )}
                  </div>
                );
              })}
              {detection.regions.length === 0 && (
                <div className="text-zinc-500 text-xs">No regions detected</div>
              )}
            </div>
          </div>

          {/* Drawn boxes */}
          {drawnBoxes.length > 0 && (
            <div className="bg-zinc-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3 text-orange-400">
                Missed Detections ({drawnBoxes.length})
              </h3>
              <div className="space-y-2">
                {drawnBoxes.map((drawn, i) => (
                  <div key={i} className="bg-zinc-800 rounded p-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full flex-shrink-0 bg-orange-500" />
                      <select
                        value={drawn.className}
                        onChange={(e) => updateDrawnBoxClass(i, e.target.value)}
                        className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-1.5 py-0.5 text-xs"
                      >
                        {classLabels.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls.replace(/_/g, " ").toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeDrawnBox(i)}
                        className="px-1.5 py-0.5 bg-red-900/50 text-red-400 rounded text-xs hover:bg-red-900/80"
                        title="Remove"
                      >
                        X
                      </button>
                    </div>
                    <div className="text-zinc-500 text-xs mt-1">
                      box: [{drawn.box.join(", ")}]
                    </div>
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={drawn.notes || ""}
                      onChange={(e) => updateDrawnBoxNotes(i, e.target.value)}
                      className="mt-1 w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs placeholder-zinc-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous annotations */}
          {detection.annotations && detection.annotations.length > 0 && (
            <div className="bg-zinc-900 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Previous Annotations</h3>
              {detection.annotations.map((ann) => (
                <div key={ann.id} className="text-xs text-zinc-400 mb-1">
                  <span className="text-zinc-300">{ann.annotationType}</span>
                  {ann.originalRegionIndex !== null && ` (region ${ann.originalRegionIndex})`}
                  {ann.notes && ` — ${ann.notes}`}
                </div>
              ))}
            </div>
          )}

          {/* Review notes */}
          <div className="bg-zinc-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-2">Review Notes</h3>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="General notes about this detection..."
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs placeholder-zinc-500 resize-none"
            />
          </div>

          {/* Metadata */}
          {renderMetadata ? (
            renderMetadata(detection)
          ) : (
            <div className="bg-zinc-900 rounded-lg p-4 text-xs text-zinc-400 space-y-1">
              <div>Source: {detection.sourceType}</div>
              <div>Created: {new Date(detection.createdAt).toLocaleString()}</div>
            </div>
          )}

          {/* Review actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleSubmit("approved")}
              disabled={submitting}
              className="w-full py-2 bg-green-900/50 text-green-300 rounded text-sm font-medium hover:bg-green-900/80 disabled:opacity-50"
            >
              {totalAnnotationCount > 0 ? "Approve with annotations" : "Approve (all correct)"}
            </button>
            <button
              onClick={() => handleSubmit("corrected")}
              disabled={submitting || totalAnnotationCount === 0}
              className="w-full py-2 bg-blue-900/50 text-blue-300 rounded text-sm font-medium hover:bg-blue-900/80 disabled:opacity-30"
            >
              Submit Corrections ({totalAnnotationCount})
            </button>
            <button
              onClick={() => handleSubmit("rejected")}
              disabled={submitting}
              className="w-full py-2 bg-red-900/50 text-red-300 rounded text-sm font-medium hover:bg-red-900/80 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={() => handleSubmit("skipped")}
              disabled={submitting}
              className="w-full py-1.5 bg-zinc-800 text-zinc-400 rounded text-sm hover:bg-zinc-700 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
