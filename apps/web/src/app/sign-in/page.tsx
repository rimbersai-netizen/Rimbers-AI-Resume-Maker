import Link from "next/link";
import { continueAsGuest } from "../auth-actions";
import { Brand, Submit } from "../form-bits";
import { SignInForm } from "./form";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Sign in to your account</h1>
        <p className="sub">Continue and build your professional CV</p>
        {error === "link_invalid" && <div className="alert error" role="alert">That link is invalid or has expired.</div>}
        {error === "guest_unavailable" && <div className="alert error" role="alert">Guest mode is unavailable right now.</div>}
        <SignInForm next={next} />
        <form action={continueAsGuest}><Submit variant="secondary">Continue as guest</Submit></form>
        <p className="row muted">Don’t have an account? <Link href="/sign-up">Sign up</Link></p>
      </section>
    </main>
  );
}
