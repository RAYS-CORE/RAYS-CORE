import fs from "fs/promises";
import path from "path";

import { compileTemplateSchema } from "@/lib/compile-template-schema";

export type BuiltinLayoutSlide = {
  id: string;
  name: string;
  description: string;
  json_schema: unknown;
};

/**
 * Build layout + JSON schemas for a built-in template directory without importing
 * `presentation-templates/index.tsx` (that pulls Recharts/client bundles into RSC).
 *
 * Scans `app/presentation-templates/<group>/*.tsx` and runs the same schema compiler
 * the UI uses. Slide IDs match `getSchemaByTemplateId` in `presentation-templates/index.tsx`
 * (`id` is the fully-qualified `<group>:<layoutId>` form used by layout lookup).
 * Slide order is sorted by filename for stability (may differ slightly from registration
 * order in index.tsx).
 */
export async function buildBuiltinTemplateLayoutPayload(group: string): Promise<{
  name: string;
  ordered: boolean;
  slides: BuiltinLayoutSlide[];
} | null> {
  const dir = path.join(
    process.cwd(),
    "app",
    "presentation-templates",
    group,
  );

  try {
    await fs.access(dir);
  } catch {
    return null;
  }

  let ordered = false;
  try {
    const raw = await fs.readFile(path.join(dir, "settings.json"), "utf8");
    const s = JSON.parse(raw) as { ordered?: boolean };
    if (typeof s.ordered === "boolean") {
      ordered = s.ordered;
    }
  } catch {
    // settings.json optional
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const tsxFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".tsx"))
    .map((e) => e.name)
    .filter(
      (n) =>
        !n.includes(".test.") &&
        !n.includes(".spec.") &&
        n !== "ExampleSlideLayoutTemplate.tsx",
    )
    .sort();

  const slides: BuiltinLayoutSlide[] = [];

  for (const file of tsxFiles) {
    const full = path.join(dir, file);
    const code = await fs.readFile(full, "utf8");
    const compiled = compileTemplateSchema(code);
    if (!compiled) {
      continue;
    }
    const qualifiedLayoutId = compiled.layoutId.includes(":")
      ? compiled.layoutId
      : `${group}:${compiled.layoutId}`;
    slides.push({
      id: qualifiedLayoutId,
      name: compiled.layoutName,
      description: compiled.layoutDescription,
      json_schema: compiled.schemaJSON,
    });
  }

  if (slides.length === 0) {
    return null;
  }

  return { name: group, ordered, slides };
}
