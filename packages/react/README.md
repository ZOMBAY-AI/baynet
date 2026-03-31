# @baynet/react

React dashboard components for [BayNet](https://github.com/ZOMBAY-AI/baynet) content moderation.

Provides a complete HITL moderation UI with review queue, SVG bounding box annotator, stats dashboard, and COCO training data export — all as composable React components.

## Install

```bash
npm install @baynet/react @baynet/sdk react
```

## Quick Start

```tsx
import { ModerationDashboard } from "@baynet/react";

function App() {
  return (
    <ModerationDashboard
      dataSource={{
        fetchQueue: async (params) => {
          const res = await fetch(`/api/moderation?${new URLSearchParams(params)}`);
          return res.json();
        },
        fetchStats: async () => {
          const res = await fetch("/api/moderation/stats");
          return res.json();
        },
        fetchDetection: async (id) => {
          const res = await fetch(`/api/moderation/${id}`);
          return res.json();
        },
        submitReview: async (submission) => {
          await fetch(`/api/moderation/${submission.detectionId}`, {
            method: "POST",
            body: JSON.stringify(submission),
          });
        },
        batchReview: async (ids, status) => {
          await fetch("/api/moderation/batch", {
            method: "POST",
            body: JSON.stringify({ ids, status }),
          });
        },
        triggerExport: async () => {
          const res = await fetch("/api/moderation/export", { method: "POST" });
          return res.json();
        },
      }}
    />
  );
}
```

## Components

| Component | Description |
|-----------|-------------|
| `ModerationDashboard` | Top-level with queue/stats tabs and header stats |
| `ReviewQueue` | Paginated detection grid with batch approve/reject |
| `DetectionReviewer` | Full annotation view with SVG bounding box overlay |
| `DetectionCard` | Grid thumbnail with priority/confidence badges |
| `StatsView` | Stat cards + annotation breakdown |
| `ExportButton` | Trigger COCO training data export |

## Customization

All components accept optional props for customization:

- `classColors` — custom color map for detection class bounding boxes
- `classLabels` — custom class label options for missed-detection dropdowns
- `renderMetadata` — render custom metadata section in the reviewer sidebar

## Styling

Components use Tailwind CSS utility classes with a dark theme. Include Tailwind in your project for correct rendering.

## License

MIT
