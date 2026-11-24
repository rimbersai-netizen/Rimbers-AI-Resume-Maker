import Link from "next/link";
import type { MatchLabel } from "@gars/ats-engine";

export const LABELS: Record<MatchLabel, string> = { strong: "Strong match", good: "Good match", stretch: "Stretch match" };

export function ago(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

/** 0–100 estimate shown as a red→amber→green bar with a marker. Accessible text alternative included. */
export function ScoreBar({ score, label }: { score: number; label: MatchLabel }) {
  return (
    <div className="jobs-score" role="img" aria-label={`Estimated match ${score} out of 100, ${LABELS[label]}`}>
      <div className="jobs-score-head"><strong>{score}</strong><span className={`jobs-label ${label}`}>{LABELS[label]}</span><span className="muted small">of 100</span></div>
      <div className="jobs-bar"><i style={{ insetInlineStart: `${score}%` }} /></div>
    </div>
  );
}

export function JobsNav({ active, counts }: { active: "discover" | "saved" | "applied" | "preferences"; counts?: Record<string, number> }) {
  const tabs = [
    ["discover", "/jobs", "Discover", 0],
    ["saved", "/jobs/saved", "Saved", counts?.saved ?? 0],
    ["applied", "/jobs/applied", "Applications", (counts?.ready ?? 0) + (counts?.applying ?? 0) + (counts?.applied ?? 0) + (counts?.needs_you ?? 0)],
    ["preferences", "/jobs/preferences", "Preferences", 0],
  ] as const;
  return (
    <nav className="jobs-tabs" aria-label="Jobs">
      {tabs.map(([id, href, label, n]) => (
        <Link key={id} href={href} aria-current={active === id ? "page" : undefined}>{label}{n ? <span className="badge">{n}</span> : null}</Link>
      ))}
    </nav>
  );
}
