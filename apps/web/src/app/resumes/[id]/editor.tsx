"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { listCountryRules } from "@gars/country-rules";
import { TEMPLATE_CATEGORIES, TEMPLATES, getTemplate, headingsFor, renderResumeHtml } from "@gars/template-engine";
import { toDraft } from "@/lib/profile-draft";
import {
  changeCountry, countryLabel, flag, localeLabel, override, overrideSections, recommendationNotes, RESUME_LOCALES,
  toResumeDocument, type ResumeLayout, type SectionSetting,
} from "@/lib/resume-settings";
import { saveLayout, type LoadedResume } from "../actions";

type Status = "idle" | "saving" | "saved" | "error" | "conflict";
const CAT_LABEL = (c: string) => c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()).replace("Ats", "ATS");

export function ResumeEditor({ initial, appLocale }: { initial: LoadedResume; appLocale: string }) {
  const [layout, setLayout] = useState<ResumeLayout>(initial.layout);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [catFilter, setCatFilter] = useState<string>("recommended");
  const updatedAt = useRef(initial.updatedAt);
  const dirty = useRef(false);
  const profile = useMemo(() => toDraft(initial.profile.profile), [initial.profile.profile]);
  const hasPhoto = Boolean(profile.personal.photoPath);
  const rule = listCountryRules().find((r) => r.countryCode === layout.countryCode);
  const template = getTemplate(layout.templateId) ?? TEMPLATES[0]!;

  const html = useMemo(() => {
    try {
      return renderResumeHtml(toResumeDocument(initial.id, layout, profile), template, { photoSrc: initial.photoUrl ?? undefined });
    } catch {
      return "<p style='font-family:sans-serif;padding:24px'>Preview unavailable — complete your profile (name is required).</p>";
    }
  }, [layout, profile, template, initial.id, initial.photoUrl]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(async () => {
      setStatus("saving");
      const r = await saveLayout(initial.id, layout, updatedAt.current).catch(() => null);
      if (r?.ok) { updatedAt.current = r.value.updatedAt; dirty.current = false; setStatus("saved"); setMessage("All changes saved"); }
      else if (r && r.kind === "conflict") { setStatus("conflict"); setMessage(r.message); }
      else { setStatus("error"); setMessage(r?.message ?? "You appear to be offline. Changes will save when you reconnect."); }
    }, 800);
    return () => clearTimeout(t);
  }, [layout, initial.id]);

  const set = (fn: (l: ResumeLayout) => ResumeLayout) => { dirty.current = true; setLayout(fn); };
  const moveSection = (i: number, to: number) => set((l) => {
    if (to < 0 || to >= l.sections.length) return l;
    const s = [...l.sections]; const [x] = s.splice(i, 1); s.splice(to, 0, x!);
    return overrideSections(l, s);
  });
  const toggleSection = (i: number) => set((l) => overrideSections(l, l.sections.map((s, j) => (j === i ? { ...s, visible: !s.visible } : s))));
  const toggleItem = (id: string) => set((l) => {
    const h = new Set(l.settings.hiddenItemIds);
    if (h.has(id)) h.delete(id); else h.add(id);
    return { ...l, settings: { ...l.settings, hiddenItemIds: [...h] } };
  });

  const suggested = rule?.suggestedResumeLocales.filter((l) => RESUME_LOCALES.includes(l)) ?? [];
  const recommendedCats = rule?.recommendedTemplateCategories ?? ["ats_minimal"];
  const shownTemplates = TEMPLATES.filter((t) => catFilter === "recommended" ? recommendedCats.includes(t.category) : catFilter === "all" || t.category === catFilter);
  const h = headingsFor(layout.locale);
  const sectionHasContent = (s: SectionSetting) => {
    const p = profile;
    switch (s.key) {
      case "summary": return Boolean(p.summary);
      case "custom": return p.customSections.length > 0;
      default: return (p[s.key] as unknown[]).length > 0;
    }
  };

  return (
    <div className="editor">
      <header className="editor-head">
        <Link href="/dashboard" className="muted">← Dashboard</Link>
        <input aria-label="Resume name" className="title-input" value={layout.title} maxLength={200} onChange={(e) => set((l) => ({ ...l, title: e.target.value }))} />
        <p className={`save-status ${status}`} role={status === "error" || status === "conflict" ? "alert" : "status"} aria-live="polite">
          {status === "saving" ? "Saving…" : message}
          {status === "conflict" && <button type="button" className="link" onClick={() => window.location.reload()}> Reload</button>}
        </p>
        <div className="seg" role="tablist" aria-label="Editor view">
          <button role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")}>Edit</button>
          <button role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>Preview</button>
        </div>
      </header>

      <div className={`editor-body show-${tab}`}>
        <aside className="panel" aria-label="Resume settings">
          <section>
            <h2>Country &amp; language</h2>
            <label htmlFor="country">Target country</label>
            <select id="country" value={layout.countryCode} onChange={(e) => set((l) => changeCountry(l, e.target.value, appLocale, { hasPhoto, premiumAllowed: initial.premiumAllowed }))}>
              {listCountryRules().map((r) => ({ code: r.countryCode, name: countryLabel(r.countryCode) })).sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => <option key={c.code} value={c.code}>{flag(c.code)} {c.name}</option>)}
            </select>
            <label htmlFor="locale">Resume language</label>
            <select id="locale" value={layout.locale} onChange={(e) => set((l) => override(l, "locale", e.target.value))}>
              <optgroup label="Common for this country">{suggested.map((l) => <option key={l} value={l}>{localeLabel(l)}</option>)}</optgroup>
              <optgroup label="All languages">{RESUME_LOCALES.filter((l) => !suggested.includes(l)).map((l) => <option key={l} value={l}>{localeLabel(l)}</option>)}</optgroup>
            </select>
            <p className="muted small">App language stays {localeLabel(appLocale)}. Your profile text is not translated automatically — the AI assistant can help with that later.</p>
            <details><summary>Conventions for {countryLabel(layout.countryCode)}</summary><ul className="notes">{recommendationNotes(layout.countryCode).map((n) => <li key={n}>{n}</li>)}</ul></details>
          </section>

          <section>
            <h2>Template</h2>
            <div className="chips-row" role="group" aria-label="Template categories">
              {["recommended", "all", ...TEMPLATE_CATEGORIES].map((c) => (
                <button key={c} type="button" className={`filter ${catFilter === c ? "on" : ""}`} aria-pressed={catFilter === c} onClick={() => setCatFilter(c)}>
                  {c === "recommended" ? "Recommended" : c === "all" ? "All" : CAT_LABEL(c)}
                </button>
              ))}
            </div>
            <ul className="tpl-grid" aria-label="Templates">
              {shownTemplates.map((t) => {
                const locked = t.premium && !initial.premiumAllowed;
                return (
                  <li key={t.id}>
                    <button type="button" className={`tpl ${t.id === layout.templateId ? "on" : ""}`} aria-pressed={t.id === layout.templateId} disabled={locked}
                      title={locked ? "Professional plan" : t.name} onClick={() => set((l) => override(l, "templateId", t.id))}>
                      <span className={`thumb cols-${t.layout.columns} head-${t.layout.header}`} style={{ ["--a" as string]: t.accent }} aria-hidden><i /><i /><i /><i /></span>
                      <span className="tpl-name">{t.name}</span>
                      <span className="tpl-meta">{t.ats.columns === 1 ? "ATS-friendly" : "2 columns"}{t.premium ? " · Pro" : ""}{locked ? " 🔒" : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2>Page &amp; photo</h2>
            <div className="seg" role="radiogroup" aria-label="Page size">
              {(["A4", "Letter"] as const).map((s) => (
                <button key={s} role="radio" aria-checked={layout.pageSize === s} onClick={() => set((l) => override(l, "pageSize", s))}>{s}</button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={layout.includePhoto} disabled={!hasPhoto} onChange={(e) => set((l) => override(l, "includePhoto", e.target.checked))} />
              <span>Include photo {!hasPhoto && <span className="muted">(add one in your profile)</span>}</span>
            </label>
            {template.layout.photo === "none" && layout.includePhoto && <p className="muted small">This template has no photo area; choose another template to show it.</p>}
          </section>

          <section>
            <h2>Sections</h2>
            <ol className="section-list">
              {layout.sections.map((s, i) => (
                <li key={`${s.key}-${i}`} className={s.visible ? "" : "off"}>
                  <label className="check"><input type="checkbox" checked={s.visible} onChange={() => toggleSection(i)} /> <span>{s.heading ?? h[s.key]}</span></label>
                  {!sectionHasContent(s) && <span className="muted small">empty</span>}
                  <span className="item-actions">
                    <button type="button" className="icon" aria-label={`Move ${h[s.key]} up`} disabled={i === 0} onClick={() => moveSection(i, i - 1)}>↑</button>
                    <button type="button" className="icon" aria-label={`Move ${h[s.key]} down`} disabled={i === layout.sections.length - 1} onClick={() => moveSection(i, i + 1)}>↓</button>
                  </span>
                </li>
              ))}
            </ol>
            {(profile.experience.length > 0 || profile.education.length > 0) && (
              <details>
                <summary>Show or hide individual entries</summary>
                {[...profile.experience.map((w) => ({ id: w.id, label: `${w.title} — ${w.employer}` })), ...profile.education.map((e) => ({ id: e.id, label: `${e.qualification} — ${e.institution}` }))]
                  .map((x) => (
                    <label className="check" key={x.id}><input type="checkbox" checked={!layout.settings.hiddenItemIds.includes(x.id)} onChange={() => toggleItem(x.id)} /> <span>{x.label}</span></label>
                  ))}
              </details>
            )}
            <p className="muted small">Content comes from your <Link href="/profile">profile</Link>. Changes there appear in every resume.</p>
          </section>
        </aside>

        <section className="preview" aria-label="Live preview">
          <div className={`paper ${layout.pageSize === "A4" ? "a4" : "letter"}`}>
            <iframe title={`Preview of ${layout.title}`} srcDoc={html} sandbox="allow-same-origin" />
          </div>
          <p className="muted small center">{template.name} · {layout.pageSize} · {localeLabel(layout.locale)}</p>
        </section>
      </div>
    </div>
  );
}
