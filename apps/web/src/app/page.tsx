import Link from "next/link";
import { Brand } from "./form-bits";

export default function Home() {
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Create professional CVs &amp; resumes with AI</h1>
        <p className="sub">Build a job-winning resume for any country, in any language.</p>
        <Link className="btn" href="/sign-up">Get started <span className="arrow" aria-hidden>→</span></Link>
        <Link className="btn secondary" href="/sign-in">Sign in</Link>
      </section>
    </main>
  );
}
