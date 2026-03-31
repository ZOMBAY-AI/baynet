# @baynet/sdk

Open-source HITL content moderation + AI training data pipeline.

BayNet bridges automated NSFW detection and human oversight. It persists detection results, builds a human review queue, and exports corrections as labeled training data (COCO format) for model improvement.

## Install

```bash
npm install @baynet/sdk
```

## Quick Start

```typescript
import { BayNet, nudenetBackend, simpleAuth } from "@baynet/sdk";

const baynet = new BayNet({
  database: yourDatabaseAdapter,  // @baynet/adapter-d1, @baynet/adapter-postgres, or custom
  storage: yourStorageAdapter,    // @baynet/adapter-r2, @baynet/adapter-s3, or custom
  auth: simpleAuth({ isReviewer: (id) => ADMIN_IDS.includes(id) }),
  backends: [nudenetBackend({ url: "https://your-nudenet-service.com" })],
  hooks: {
    onCsamIndicator: async (detection) => {
      // Required if csam_indicators backend is registered
      await reportToAuthorities(detection);
    },
  },
});

// Detect and persist
const { detectionId, results } = await baynet.detectAndPersist({
  imageBase64: "...",
  mimeType: "image/png",
  sourceType: "preview",
});

// Review queue
const queue = await baynet.getReviewQueue({ status: "pending" });

// Submit review with annotations
await baynet.submitReview({
  detectionId: "det_123",
  reviewerId: "admin_1",
  status: "corrected",
  annotations: [
    { type: "false_positive", regionIndex: 0 },
    { type: "missed_detection", correctedClass: "BUTTOCKS_EXPOSED", correctedBox: [100, 200, 50, 60] },
  ],
});

// Export COCO training data
const { manifest, exportId } = await baynet.exportCoco({ exporterId: "admin_1" });
```

## Adapter Interfaces

BayNet uses pluggable adapters. Implement `DatabaseAdapter`, `StorageAdapter`, and `AuthAdapter` for your platform, or use a pre-built adapter:

| Package | Platform |
|---------|----------|
| `@baynet/adapter-d1` | Cloudflare D1 (Drizzle ORM) |
| `@baynet/adapter-r2` | Cloudflare R2 |
| `@baynet/adapter-postgres` | PostgreSQL (coming soon) |
| `@baynet/adapter-s3` | AWS S3 (coming soon) |

## Detection Backends

- **NudeNet** — `nudenetBackend({ url })` — connects to a NudeNet Flask microservice
- **Gemini Safety** — `geminiSafetyBackend({ apiKey })` — Google Gemini safety classifier (fail-closed)

## Features

- 7 detection categories, 33 class labels
- Active learning priority scoring (uncertain predictions reviewed first)
- CSAM hook enforcement (SDK refuses to init without mandatory reporting hook)
- COCO JSON export with human corrections applied
- Batch review (up to 100 detections)
- Audit logging

## License

MIT
