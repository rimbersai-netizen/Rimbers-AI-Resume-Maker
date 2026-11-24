"use client";

import Link from "next/link";
import { useState } from "react";

type Item = { id: string; name: string; category: string; premium: boolean };
const ACCENTS = ["#1F5FE0", "#0E7490", "#334155", "#6D28D9", "#047857"];
const accent = (cat: string) => ACCENTS[[...cat].reduce((a, c) => a + c.charCodeAt(0), 0) % ACCENTS.length]!;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, " ");

/** Stylised paper stand-ins (no template images are shipped); selection carries through to the new-resume flow. */
export function Gallery({ items, categories }: { items: Item[]; categories: string[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const list = items.filter((t) => (cat === "all" || t.category === cat) && (!q.trim() || `${t.name} ${t.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <>
      <label className="visually-hidden" htmlFor="tpl-q">Search templates</label>
      <input id="tpl-q" type="text" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="jobs-tabs" role="group" aria-label="Category" style={{ borderRadius: 16 }}>
        {["all", ...categories].map((c) => (
          <a key={c} href="#" role="button" aria-current={cat === c ? "page" : undefined} onClick={(e) => { e.preventDefault(); setCat(c); }}>{cap(c)}</a>
        ))}
      </div>
      {list.length === 0 ? <p className="empty">No templates found. Try another search or category.</p> : (
        <div className="tpl-gallery">
          {list.map((t) => {
            const a = accent(t.category);
            const side = a.length % 2 === 0 || [...t.category].length % 2 === 0;
            return (
              <button key={t.id} type="button" className="tpl-card" aria-pressed={sel === t.id} onClick={() => setSel(t.id)} aria-label={`${t.name}${t.premium ? " (premium)" : ""}`}>
                <div className="paper-thumb" style={{ ["--acc" as string]: a }}>
                  {side && <div className="pt-side" />}
                  <div className="pt-main"><div className="pt-h" /><div className="pt-l" /><div className="pt-l" style={{ width: "85%" }} /><div className="pt-s" /><div className="pt-l" /><div className="pt-l" style={{ width: "70%" }} /><div className="pt-s" /><div className="pt-l" /><div className="pt-l" style={{ width: "80%" }} /></div>
                  {sel === t.id && <span className="tick" aria-hidden>✓</span>}
                  {t.premium && <span className="pro">PRO</span>}
                </div>
                <strong>{t.name}</strong>
                <span className="muted small">{cap(t.category)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="sticky-cta">
        {sel ? <Link className="btn" href={`/resumes/new?template=${encodeURIComponent(sel)}`}>Use This Template</Link> : <span className="btn" aria-disabled="true" style={{ opacity: 0.55 }}>Select a template</span>}
      </div>
    </>
  );
}
