import Link from "next/link";
import { Brand } from "../form-bits";
import { SignUpForm } from "./form";

export default function SignUpPage() {
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Create your account</h1>
        <p className="sub">One profile. Multiple resumes. Global formats.</p>
        <SignUpForm />
        <p className="row muted">Already have an account? <Link href="/sign-in">Sign in</Link></p>
      </section>
    </main>
  );
}
