import Link from "next/link";
import { Brand } from "../form-bits";
import { VerifyForm } from "./form";

export const metadata = { title: "Enter your code · Rimbers AI Resume Maker" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string; type?: string; next?: string }> }) {
  const { email, type, next } = await searchParams;
  const kind = type === "email" ? "email" : "signup";
  const safeEmail = typeof email === "string" && email.length <= 254 ? email : "";
  return (
    <main className="shell">
      <section className="card" aria-labelledby="t">
        <Brand />
        <h1 id="t">Enter your code</h1>
        <p className="sub">{safeEmail ? <>We sent a 6-digit code to <strong>{safeEmail}</strong>. It expires in about an hour.</> : "We sent you a 6-digit code."}</p>
        <VerifyForm email={safeEmail} type={kind} next={next ?? "/dashboard"} />
        <p className="row muted"><Link href={kind === "signup" ? "/sign-up" : "/sign-in"}>← Use a different email</Link></p>
      </section>
    </main>
  );
}
