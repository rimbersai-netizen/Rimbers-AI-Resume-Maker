import { json, preflight } from "@/lib/api-auth";
import { defaultLayout } from "@/lib/resume-settings";

export const OPTIONS = preflight;

/** GET ?country=SA&locale=en&title=... -> recommended ResumeLayout (resume language independent of app language). */
export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const country = (q.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return json({ ok: false, message: "Unknown country" }, 400);
  const premium = q.get("premium") === "1";
  return json({ ok: true, layout: defaultLayout(country, q.get("locale") ?? "en", { title: q.get("title") ?? undefined, premiumAllowed: premium, hasPhoto: false }) });
}
