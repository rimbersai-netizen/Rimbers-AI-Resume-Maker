import Link from "next/link";
import { Brand } from "../form-bits";
import { GoogleButton } from "../google-button";
import { SignInForm } from "./form";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Welcome back 👋</h1>
        <p className="sub">Sign in to continue</p>
        {error === "link_invalid" && <div className="alert error" role="alert">That link is invalid or has expired.</div>}
        {error === "guest_unavailable" && <div className="alert error" role="alert">Guest mode is unavailable right now.</div>}
        {error === "google_unavailable" && <div className="alert error" role="alert">Google sign-in is not available right now.</div>}
        <SignInForm next={next} />
        <p className="row muted" style={{ justifyContent: "center" }}><Link href={`/sign-in/code${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Email me a sign-in code instead</Link></p>
        <GoogleButton next={next} />
        <p className="row muted">Don’t have an account? <Link href="/sign-up">Sign up</Link></p>
      </section>
    </main>
  );
}
