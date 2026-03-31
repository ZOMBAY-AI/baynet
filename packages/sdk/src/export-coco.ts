/**
 * COCO-format training data export.
 *
 * Takes reviewed detections with human annotations and produces
 * a COCO JSON manifest. False positives are excluded, corrections
 * are applied, missed detections are added.
 */

import type { Detection, Annotation, DetectedRegion } from "./types.js";
import type { CategoryRegistry } from "./categories.js";

export interface CocoManifest {
  info: {
    description: string;
    version: string;
    year: number;
    date_created: string;
  };
  images: CocoImage[];
  annotations: CocoAnnotation[];
  categories: Array<{ id: number; name: string; supercategory: string }>;
}

interface CocoImage {
  id: number;
  file_name: string;
  width?: number;
  height?: number;
}

interface CocoAnnotation {
  id: number;
  image_id: number;
  category_id: number;
  bbox: [number, number, number, number];
  area: number;
  iscrowd: 0;
}

export interface ExportCocoParams {
  detections: Detection[];
  annotationsByDetection: Map<string, Annotation[]>;
  categories: CategoryRegistry;
  description?: string;
}

export function buildCocoManifest(params: ExportCocoParams): {
  manifest: CocoManifest;
  imageKeys: string[];
} {
  const { detections, annotationsByDetection, categories, description } = params;

  const images: CocoImage[] = [];
  const annotations: CocoAnnotation[] = [];
  const imageKeys: string[] = [];
  let annotationId = 1;

  for (let i = 0; i < detections.length; i++) {
    const det = detections[i];
    const regions = det.regions;
    const detAnnotations = annotationsByDetection.get(det.id) || [];

    // Index corrections
    const falsePositiveIndexes = new Set<number>();
    const boxCorrections = new Map<number, [number, number, number, number]>();
    const classCorrections = new Map<number, string>();
    const missedDetections: Array<{
      class: string;
      box: [number, number, number, number];
    }> = [];

    for (const ann of detAnnotations) {
      if (ann.annotationType === "false_positive" && ann.originalRegionIndex !== null) {
        falsePositiveIndexes.add(ann.originalRegionIndex);
      }
      if (ann.annotationType === "box_correction" && ann.originalRegionIndex !== null && ann.correctedBox) {
        boxCorrections.set(ann.originalRegionIndex, ann.correctedBox);
      }
      if (ann.annotationType === "class_correction" && ann.originalRegionIndex !== null && ann.correctedClass) {
        classCorrections.set(ann.originalRegionIndex, ann.correctedClass);
      }
      if (ann.annotationType === "missed_detection" && ann.correctedClass && ann.correctedBox) {
        missedDetections.push({
          class: ann.correctedClass,
          box: ann.correctedBox,
        });
      }
    }

    const imageId = i + 1;
    const imageEntry: CocoImage = {
      id: imageId,
      file_name: `${det.id}.png`,
    };
    if (det.imageWidth) imageEntry.width = det.imageWidth;
    if (det.imageHeight) imageEntry.height = det.imageHeight;
    images.push(imageEntry);
    imageKeys.push(det.sourceKey);

    // Add confirmed/uncorrected regions
    for (let ri = 0; ri < regions.length; ri++) {
      if (falsePositiveIndexes.has(ri)) continue;

      const region = regions[ri];
      const box = boxCorrections.get(ri) || region.box;
      const className = classCorrections.get(ri) || region.class;
      const categoryId = categories.getCocoCategoryId(className);
      if (!categoryId) continue;

      annotations.push({
        id: annotationId++,
        image_id: imageId,
        category_id: categoryId,
        bbox: box,
        area: box[2] * box[3],
        iscrowd: 0,
      });
    }

    // Add human-drawn missed detections
    for (const missed of missedDetections) {
      const categoryId = categories.getCocoCategoryId(missed.class);
      if (!categoryId) continue;

      annotations.push({
        id: annotationId++,
        image_id: imageId,
        category_id: categoryId,
        bbox: missed.box,
        area: missed.box[2] * missed.box[3],
        iscrowd: 0,
      });
    }
  }

  const manifest: CocoManifest = {
    info: {
      description: description || "BayNet HITL Training Data",
      version: "1.0",
      year: new Date().getFullYear(),
      date_created: new Date().toISOString(),
    },
    images,
    annotations,
    categories: categories.toCoco(),
  };

  return { manifest, imageKeys };
}
