# BayNet

**Open-source HITL content moderation + AI training data pipeline**

BayNet bridges automated NSFW detection and human oversight. It persists detection results that existing tools discard, builds a human review queue, and exports human corrections as labeled training data (COCO format) for model improvement.

Nothing like this exists as an integrated open-source tool. The individual pieces (NudeNet, Label Studio, active learning frameworks) exist in isolation, but nobody has wired them together for content moderation. BayNet fills that gap.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@baynet/sdk`](packages/sdk) | Core SDK — detection pipeline, review queue, COCO export, audit logging | [![npm](https://img.shields.io/npm/v/@baynet/sdk)](https://www.npmjs.com/package/@baynet/sdk) |
| [`@baynet/adapter-d1`](packages/adapter-d1) | Cloudflare D1 database adapter (Drizzle ORM) | [![npm](https://img.shields.io/npm/v/@baynet/adapter-d1)](https://www.npmjs.com/package/@baynet/adapter-d1) |
| [`@baynet/adapter-r2`](packages/adapter-r2) | Cloudflare R2 storage adapter | [![npm](https://img.shields.io/npm/v/@baynet/adapter-r2)](https://www.npmjs.com/package/@baynet/adapter-r2) |
| [`@baynet/react`](packages/react) | React dashboard components (review queue, SVG annotator, stats) | [![npm](https://img.shields.io/npm/v/@baynet/react)](https://www.npmjs.com/package/@baynet/react) |

## Quick Start

```bash
npm install @baynet/sdk @baynet/adapter-d1 @baynet/adapter-r2
```

```typescript
import { BayNet, nudenetBackend, simpleAuth } from "@baynet/sdk";
import { D1DatabaseAdapter } from "@baynet/adapter-d1";
import { R2StorageAdapter } from "@baynet/adapter-r2";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@baynet/adapter-d1/schema";

const baynet = new BayNet({
  database: new D1DatabaseAdapter({ db: drizzle(env.DB, { schema }) }),
  storage: new R2StorageAdapter({ bucket: env.R2_ASSETS }),
  auth: simpleAuth({ isReviewer: (id) => ADMIN_IDS.includes(id) }),
  backends: [nudenetBackend({ url: env.NUDENET_URL })],
});

// Detect and persist
const { detectionId } = await baynet.detectAndPersist({
  imageBase64: frameBase64,
  mimeType: "image/png",
  sourceType: "preview",
});

// Review queue
const queue = await baynet.getReviewQueue({ status: "pending" });

// Submit human review
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
const { manifest } = await baynet.exportCoco({ exporterId: "admin_1" });
```

## How It Works

```
Content Pipeline
  |
  +-- Detection backends (NudeNet, Gemini Safety, custom)
  |     detect regions --> persist detections + images
  |
  +-- Active learning priority scoring
  |     (uncertain predictions reviewed first)
  |
  +-- Human Review Dashboard (@baynet/react)
  |     SVG annotator: confirm / false positive / draw missed regions
  |
  +-- COCO Export
        labeled training data for model retraining
```

## Architecture

BayNet uses a pluggable adapter pattern — bring your own database, storage, and auth:

```
@baynet/sdk (core)
  ├── DatabaseAdapter  ←  @baynet/adapter-d1, @baynet/adapter-postgres
  ├── StorageAdapter   ←  @baynet/adapter-r2, @baynet/adapter-s3
  ├── AuthAdapter      ←  simpleAuth() or custom
  └── DetectionBackend ←  nudenetBackend(), geminiSafetyBackend(), custom

@baynet/react (dashboard)
  └── BayNetDataSource ←  your API routes
```

## Features

- **7 detection categories, 33 class labels** — nudity, violence, weapons, hate symbols, drugs, CSAM indicators, text-in-image
- **Active learning priority queue** — uncertain predictions (low confidence) reviewed first, user reports boosted
- **SVG bounding box annotator** — confirm, reject, draw missed detections, correct classes/boxes
- **COCO JSON export** — human corrections applied (FP removal, box/class corrections, missed detection additions)
- **CSAM hook enforcement** — SDK refuses to initialize without mandatory reporting hook
- **Batch review** — approve/reject up to 100 detections at once
- **Audit logging** — every admin action tracked with user, target, IP, timestamp
- **Fail-closed detection** — backend failures block content rather than silently passing

## Detection Backends

| Backend | Description |
|---------|-------------|
| `nudenetBackend({ url })` | NudeNet Flask microservice (included in `services/nudenet-blur/`) |
| `geminiSafetyBackend({ apiKey })` | Google Gemini safety classifier |
| Custom | Implement the `DetectionBackend` interface |

## Adapters

### Database

| Adapter | Status |
|---------|--------|
| `@baynet/adapter-d1` | Published |
| `@baynet/adapter-postgres` | Coming soon |
| Custom | Implement `DatabaseAdapter` |

### Storage

| Adapter | Status |
|---------|--------|
| `@baynet/adapter-r2` | Published |
| `@baynet/adapter-s3` | Coming soon |
| Custom | Implement `StorageAdapter` |

## NudeNet Microservice

A ready-to-deploy Flask microservice for NudeNet detection + region blur is included in [`services/nudenet-blur/`](services/nudenet-blur/).

## Development

```bash
# Install dependencies
npm install

# Build all packages
npx turbo build

# Run all tests
npx turbo test

# Build + test in one shot
npx turbo build test
```

## Origin

BayNet was built as part of [Zombay](https://zombay.net), an AI short film platform. The content safety pipeline needed human oversight and a way to improve detection accuracy over time. We couldn't find an open-source tool that connected automated detection -> human review -> training data export, so we built one.

The name "BayNet" is a nod to Zombay + neural networks + Bayesian thinking (updating beliefs with evidence from human review).

## License

MIT

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

If you're building a content platform that needs moderation, we'd love to hear how BayNet works for your use case. Open an issue or reach out.
