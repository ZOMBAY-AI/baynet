/**
 * Detection category registry — extensible classification system.
 *
 * Each category has COCO-compatible class IDs so exports work across
 * multiple detection backends producing different region types.
 */

import type { DetectionCategory } from "./types.js";

export interface CategoryClass {
  /** COCO category_id — unique across all categories */
  id: number;
  /** Class label (e.g., "FEMALE_BREAST_EXPOSED", "HANDGUN") */
  name: string;
  /** Parent category */
  category: DetectionCategory;
}

export interface CategoryDefinition {
  id: DetectionCategory;
  displayName: string;
  /** How severe violations in this category are */
  severity: "critical" | "high" | "medium" | "low";
  /** Class labels with COCO IDs */
  classes: CategoryClass[];
}

// ─── Built-in Categories ────────────────────────────────────────────────────

export const BUILTIN_CATEGORIES: CategoryDefinition[] = [
  {
    id: "nudity",
    displayName: "Nudity / NSFW",
    severity: "high",
    classes: [
      { id: 1, name: "FEMALE_BREAST_EXPOSED", category: "nudity" },
      { id: 2, name: "MALE_BREAST_EXPOSED", category: "nudity" },
      { id: 3, name: "FEMALE_GENITALIA_EXPOSED", category: "nudity" },
      { id: 4, name: "MALE_GENITALIA_EXPOSED", category: "nudity" },
      { id: 5, name: "BUTTOCKS_EXPOSED", category: "nudity" },
      { id: 6, name: "ANUS_EXPOSED", category: "nudity" },
    ],
  },
  {
    id: "csam_indicators",
    displayName: "CSAM Indicators",
    severity: "critical",
    classes: [
      { id: 100, name: "MINOR_DETECTED", category: "csam_indicators" },
      { id: 101, name: "MINOR_IN_EXPLICIT_CONTEXT", category: "csam_indicators" },
    ],
  },
  {
    id: "violence",
    displayName: "Violence / Gore",
    severity: "high",
    classes: [
      { id: 200, name: "BLOOD", category: "violence" },
      { id: 201, name: "WOUND", category: "violence" },
      { id: 202, name: "CORPSE", category: "violence" },
      { id: 203, name: "DISMEMBERMENT", category: "violence" },
      { id: 204, name: "TORTURE", category: "violence" },
    ],
  },
  {
    id: "weapons",
    displayName: "Weapons",
    severity: "medium",
    classes: [
      { id: 300, name: "HANDGUN", category: "weapons" },
      { id: 301, name: "RIFLE", category: "weapons" },
      { id: 302, name: "KNIFE", category: "weapons" },
      { id: 303, name: "EXPLOSIVE", category: "weapons" },
      { id: 304, name: "WEAPON_POINTED_AT_PERSON", category: "weapons" },
    ],
  },
  {
    id: "hate_symbols",
    displayName: "Hate Symbols / Extremism",
    severity: "high",
    classes: [
      { id: 400, name: "SWASTIKA", category: "hate_symbols" },
      { id: 401, name: "SS_BOLTS", category: "hate_symbols" },
      { id: 402, name: "CONFEDERATE_FLAG", category: "hate_symbols" },
      { id: 403, name: "KKK_IMAGERY", category: "hate_symbols" },
      { id: 404, name: "HATE_GESTURE", category: "hate_symbols" },
    ],
  },
  {
    id: "drugs",
    displayName: "Drugs / Paraphernalia",
    severity: "medium",
    classes: [
      { id: 500, name: "SYRINGE", category: "drugs" },
      { id: 501, name: "PILL_BOTTLE", category: "drugs" },
      { id: 502, name: "MARIJUANA", category: "drugs" },
      { id: 503, name: "POWDER_SUBSTANCE", category: "drugs" },
      { id: 504, name: "PIPE", category: "drugs" },
    ],
  },
  {
    id: "text_in_image",
    displayName: "Text in Image",
    severity: "low",
    classes: [
      { id: 600, name: "OFFENSIVE_TEXT", category: "text_in_image" },
      { id: 601, name: "INJECTION_TEXT", category: "text_in_image" },
      { id: 602, name: "PII_TEXT", category: "text_in_image" },
    ],
  },
];

// ─── Category Registry ──────────────────────────────────────────────────────

export class CategoryRegistry {
  private categories: Map<string, CategoryDefinition> = new Map();
  private classMap: Map<string, CategoryClass> = new Map();

  constructor(categories: CategoryDefinition[] = BUILTIN_CATEGORIES) {
    for (const cat of categories) {
      this.register(cat);
    }
  }

  register(category: CategoryDefinition): void {
    this.categories.set(category.id, category);
    for (const cls of category.classes) {
      this.classMap.set(cls.name, cls);
    }
  }

  getCategory(id: string): CategoryDefinition | undefined {
    return this.categories.get(id);
  }

  getClass(name: string): CategoryClass | undefined {
    return this.classMap.get(name);
  }

  getCategoryForClass(className: string): DetectionCategory | undefined {
    return this.classMap.get(className)?.category;
  }

  getCocoCategoryId(className: string): number | undefined {
    return this.classMap.get(className)?.id;
  }

  getAllClasses(): CategoryClass[] {
    return Array.from(this.classMap.values());
  }

  getAllCategories(): CategoryDefinition[] {
    return Array.from(this.categories.values());
  }

  /** Get all classes as COCO categories format */
  toCoco(): Array<{ id: number; name: string; supercategory: string }> {
    return this.getAllClasses().map((cls) => ({
      id: cls.id,
      name: cls.name,
      supercategory: cls.category,
    }));
  }
}
