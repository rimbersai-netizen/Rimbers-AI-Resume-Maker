"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/dashboard", "Home"],
  ["/templates", "Templates"],
  ["/jobs", "Jobs"],
  ["/community", "Community"],
  ["/pricing", "Plans"],
  ["/profile", "Profile"],
] as const;

/** Top navigation, mirrors the mobile bottom bar (Home · Templates · + · Jobs · Profile). */
export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname() ?? "";
  const brand = (
    <Link href={signedIn ? "/dashboard" : "/"} className="brand" aria-label="Rimbers AI Resume Maker home">
      {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/r-logo.png" alt="" className="brand-r" width={46} height={34} />Rimbers <span className="brand-sub">AI Resume Maker</span>
    </Link>
  );
  return (
    <header className="sitenav">
      <div className="sitenav-in">
        {brand}
        {signedIn ? (
          <>
            <nav aria-label="Main">
              {LINKS.map(([href, label]) => (
                <Link key={href} href={href} aria-current={path === href || (href !== "/dashboard" && path.startsWith(href)) ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
            <Link className="cta" href="/resumes/new">+ New resume</Link>
          </>
        ) : (
          <>
            <nav aria-label="Main" />
            <Link href="/sign-in" style={{ fontWeight: 600 }}>Sign in</Link>
            <Link className="cta" href="/sign-up">Get started</Link>
          </>
        )}
      </div>
    </header>
  );
}
