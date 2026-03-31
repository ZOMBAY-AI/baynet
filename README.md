# BayNet

**Open-source HITL content moderation + AI training data pipeline**

BayNet bridges the gap between automated NSFW detection and human oversight. It persists detection results that existing tools discard, builds a human review queue on top of them, and exports human corrections as labeled training data for model improvement.

Nothing like this exists as an integrated open-source tool. The individual pieces (NudeNet, Label Studio, active learning frameworks) exist in isolation, but nobody has wired them together for content moderation. BayNet fills that gap.

---

## What It Does

```
Content Generation Pipeline
  |
  +-- NudeNet detects regions --> persist detections + blurred images
  |
  +-- Active learning scores review priority (low confidence = review first)
  |
  +-- Admin Review Dashboard
       |-- Blurred thumbnail grid (originals never exposed)
       |-- SVG bounding box annotator (confirm / false positive / draw missed)
       |-- Per-region notes + class correction
       +-- Export --> COCO/YOLO labeled dataset for model retraining
```

**Detection** -- NudeNet analyzes frames, returns bounding boxes with class labels and confidence scores. BayNet persists this data instead of discarding it after blur.

**Review** -- Human moderators see blurred thumbnails sorted by priority. They confirm, reject, or correct NudeNet's predictions using an SVG bounding box annotator.

**Training** -- Human corrections are exported as COCO-format labeled datasets. False positives are removed, missed detections are added, bounding boxes are corrected. This data feeds back into NudeNet fine-tuning, closing the active learning loop.

## Architecture

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  NudeNet Worker  +---->+  BayNet Service  +---->+  Review Dashboard|
|  (Detection +    |     |  (Persist, Queue |     |  (SVG Annotator, |
|   Region Blur)   |     |   Priority, API) |     |   Batch Review)  |
|                  |     |                  |     |                  |
+------------------+     +--------+---------+     +------------------+
                                  |
                                  v
                         +------------------+
                         |                  |
                         |  COCO/YOLO Export |
                         |  (Training Data) |
                         |                  |
                         +------------------+
```

## Features

### Detection Persistence
- Captures NudeNet bounding boxes, class labels, confidence scores, and processing time
- Stores both original and blurred images in object storage
- Supports multiple source types: preview frames, video checkpoints, completed videos, user reports

### Active Learning Priority Queue
- Prioritizes uncertain predictions (low confidence) for human review -- most valuable as training corrections
- Boosts priority for: user-reported content (+50), AI safety flags (+30), wide confidence spread (+15)
- Caps at 100, sorted by priority then age (FIFO fairness within same priority tier)

### Admin Review Dashboard
- Blurred thumbnail grid with batch select/approve/reject
- Full SVG bounding box annotator:
  - Confirm or mark false positive on each NudeNet region
  - Click-drag to draw new boxes for missed detections
  - Class dropdown for each drawn box (NudeNet's 6 classes)
  - Per-region and per-review notes
- Stats view: pending count, false positive rate, annotation breakdown

### COCO Training Data Export
- Exports reviewed detections as COCO JSON format
- Applies human corrections: FP removal, box/class corrections, missed detection additions
- Includes image dimensions for full COCO spec compliance
- Categories match NudeNet classes: `FEMALE_BREAST_EXPOSED`, `MALE_BREAST_EXPOSED`, `FEMALE_GENITALIA_EXPOSED`, `MALE_GENITALIA_EXPOSED`, `BUTTOCKS_EXPOSED`, `ANUS_EXPOSED`

### Security
- Admin role gating via configurable allowlist (`ADMIN_USER_IDS`)
- Original unblurred images hard-blocked from API responses (only accessible via COCO export)
- Timing-safe secret comparison on webhook endpoints
- Input validation on all annotation fields (class allowlist, bounding box bounds, batch size limits)
- Generic error messages to clients (full errors logged server-side only)
- Admin audit log with user, action, target IDs, IP address, timestamp

## Database Schema

### `nudenet_detections`
One row per NudeNet analysis of an image/frame.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | nanoid |
| `scene_id` | text FK | Source scene (nullable) |
| `project_id` | text FK | Source project (nullable) |
| `source_type` | enum | `preview`, `checkpoint`, `reference`, `completed_video`, `reported` |
| `source_key` | text | Object storage key for original image |
| `blurred_key` | text | Object storage key for blurred version |
| `regions` | JSON text | `Array<{ class, score, box: [x,y,w,h] }>` |
| `has_explicit` | boolean | Whether NudeNet found explicit content |
| `image_width` | integer | Original image width (for COCO export) |
| `image_height` | integer | Original image height |
| `region_count` | integer | Number of detected regions |
| `max_confidence` | real | Highest confidence score |
| `min_confidence` | real | Lowest confidence score |
| `review_status` | enum | `pending`, `approved`, `corrected`, `rejected`, `skipped` |
| `review_priority` | integer | 0-100, higher = review first |
| `reviewed_by` | text | Reviewer user ID |

### `detection_annotations`
Human corrections on NudeNet detections.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text PK | nanoid |
| `detection_id` | text FK | Parent detection (cascade delete) |
| `annotation_type` | enum | `confirm`, `false_positive`, `missed_detection`, `box_correction`, `class_correction` |
| `original_region_index` | integer | Which NudeNet region this annotates (null for missed_detection) |
| `corrected_class` | text | Human-provided correct class label |
| `corrected_box` | JSON text | `[x, y, width, height]` |
| `notes` | text | Reviewer notes |

### `training_exports`
Tracks exported datasets.

### `admin_audit_log`
Tamper-evident log of all admin moderation actions.

## API Endpoints

All endpoints require admin authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/moderation` | Review queue (paginated, filterable by status/source/confidence) |
| GET | `/moderation?action=stats` | Aggregate dashboard metrics |
| POST | `/moderation` `{action:"batch-review"}` | Batch approve/reject (max 100) |
| POST | `/moderation` `{action:"export"}` | Export COCO training data (max 500 detections) |
| GET | `/moderation/detection/:id` | Full detection detail with regions + annotations |
| POST | `/moderation/detection/:id` | Submit review with annotations |

## Integration

BayNet integrates into content generation pipelines via a single function call:

```typescript
import { blurWithNudeNet } from "./qa-vision";

// Call NudeNet with moderation context -- detection data persisted automatically
const result = await blurWithNudeNet(imageBase64, {
  sourceType: "preview",
  sceneId: "sc_abc",
  projectId: "proj_123",
  userId: "user_456",
});
// result.blurred = base64 blurred image
// result.regions = NudeNet detection data
// Detection automatically persisted to DB + object storage (fire-and-forget)
```

## Tech Stack

- **Detection**: NudeNet (ONNX model, Flask microservice)
- **Database**: SQLite / Cloudflare D1 (via Drizzle ORM)
- **Storage**: Cloudflare R2 / S3-compatible
- **API**: Cloudflare Workers / Node.js
- **Dashboard**: React + Tailwind + SVG
- **Export**: COCO JSON format (YOLO planned)

## Roadmap

- [ ] YOLO export format
- [ ] Expand beyond nudity: illegal content categories (violence, CSAM indicators, weapons, drugs)
- [ ] BayNet SDK (npm package) for drop-in integration
- [ ] Standalone BayNet web dashboard (decoupled from host app)
- [ ] Pluggable detection backends (custom models, Google Vision, AWS Rekognition)
- [ ] Pluggable storage backends (S3, GCS, local filesystem)
- [ ] Inter-annotator agreement metrics
- [ ] Confidence calibration dashboard
- [ ] Webhook notifications for high-priority detections
- [ ] NudeNet fine-tuning pipeline (train on exported COCO data)

## Origin

BayNet was built as part of [Zombay](https://zombay.net), an AI short film platform. The content safety pipeline needed human oversight and a way to improve detection accuracy over time. We couldn't find an open-source tool that connected automated detection -> human review -> training data export, so we built one.

The name "BayNet" is a nod to Zombay + neural networks + Bayesian thinking (updating beliefs with evidence from human review).

## License

MIT

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

If you're building a content platform that needs moderation, we'd love to hear how BayNet works for your use case. Open an issue or reach out.
