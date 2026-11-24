import { TEMPLATES, TEMPLATE_CATEGORIES } from "@gars/template-engine";
import { Gallery } from "./gallery";

export const metadata = { title: "Templates · Rimbers AI Resume Maker" };

export default function TemplatesPage() {
  const items = TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, premium: Boolean(t.premium) }));
  return (
    <main className="home">
      <h1>Templates</h1>
      <p className="muted">{items.length} templates. Preview and PDF use the same renderer, so what you pick is what you download.</p>
      <Gallery items={items} categories={[...TEMPLATE_CATEGORIES]} />
    </main>
  );
}
