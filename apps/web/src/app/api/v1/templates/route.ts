import { TEMPLATES, TEMPLATE_CATEGORIES } from "@gars/template-engine";
import { json, preflight } from "@/lib/api-auth";

export const OPTIONS = preflight;

/** Public template catalogue metadata (no user data). */
export function GET() {
  return json({
    categories: TEMPLATE_CATEGORIES,
    templates: TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, premium: Boolean(t.premium), columns: t.ats.columns })),
  });
}
