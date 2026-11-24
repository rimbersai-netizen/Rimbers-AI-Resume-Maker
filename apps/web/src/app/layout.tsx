import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveAppLocale, textDirection } from "@gars/localization";
import { createClient } from "@/lib/supabase/server";
import { SiteNav } from "./site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rimbers AI Resume Maker",
  description: "Create professional, country-ready CVs and resumes with AI.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // First paint uses the browser's languages; a saved manual choice (profiles.app_locale) overrides once signed in.
  const accept = (await headers()).get("accept-language") ?? "";
  const deviceLocales = accept.split(",").map((s) => s.split(";")[0]!.trim()).filter(Boolean);
  const { locale } = resolveAppLocale({ deviceLocales });
  const { data: { user } } = await (await createClient()).auth.getUser();
  return (
    <html lang={locale} dir={textDirection(locale)}>
      <body>
        <SiteNav signedIn={Boolean(user)} />
        {children}
      </body>
    </html>
  );
}
