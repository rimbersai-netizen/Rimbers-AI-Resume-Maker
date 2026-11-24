import Link from "next/link";

const FEATURES = [
  ["✨", "AI that never invents facts", "Suggestions use only what you entered. You accept, edit or reject every change."],
  ["📊", "ATS analysis & job match", "Explainable scores with matched and missing keywords — an estimate, never a guarantee."],
  ["🌍", "Made for your country", "CV conventions for 30 countries, 12 resume languages, Arabic and Urdu included."],
  ["💼", "Jobs, tailored", "Swipe real openings, see your match, then tailor a resume for each role."],
];

export default function Home() {
  return (
    <main className="home">
      <section className="ai-banner" style={{ margin: "8px 0 28px", padding: "40px 28px" }} aria-labelledby="t">
        <div>
          <span aria-hidden>✦</span>
          <h1 id="t" style={{ color: "#fff", fontSize: "2.2rem", margin: "8px 0" }}>Build a better career with AI</h1>
          <p style={{ fontSize: "1.05rem" }}>Create professional CVs and resumes in seconds with modern templates, PDF and editable Word export.</p>
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn" href="/sign-up" style={{ background: "#fff", color: "#0B2A7A", maxWidth: 220 }}>Get started →</Link>
            <Link href="/sign-in" style={{ color: "#fff", fontWeight: 600 }}>Sign in</Link>
          </div>
        </div>
        <span className="bot" aria-hidden>📄</span>
      </section>
      <div className="tools-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {FEATURES.map(([ico, title, text]) => (
          <div key={title} className="tool" style={{ justifyItems: "start", textAlign: "start" }}>
            <span className="ico" aria-hidden>{ico}</span>{title}<small>{text}</small>
          </div>
        ))}
      </div>
    </main>
  );
}
