import Link from "next/link";
import { Brand } from "../../form-bits";
import { CodeRequestForm } from "./form";

export const metadata = { title: "Sign in with a code · Rimbers AI Resume Maker" };

export default async function SignInWithCodePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Sign in with a code</h1>
        <p className="sub">We’ll email you a 6-digit code. No password needed.</p>
        <CodeRequestForm next={next} />
        <p className="row muted"><Link href="/sign-in">← Sign in with a password</Link></p>
      </section>
    </main>
  );
}
