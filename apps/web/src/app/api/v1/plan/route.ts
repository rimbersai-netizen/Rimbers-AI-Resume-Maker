import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { DEFAULT_PLAN_LIMITS } from "@gars/subscriptions";
import { entitlement } from "@/lib/entitlements";
import { loadPlanPrices } from "@/lib/services/billing";

export const OPTIONS = preflight;

/** GET -> what the signed-in user's plan currently allows (UI hints only; actions are enforced server-side) + plan prices. */
export async function GET(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const features = ["create_resume", "ai_request", "export_pdf", "export_docx", "premium_template"] as const;
  const [resume, ai, pdf, docx, premium] = await Promise.all(features.map((f) => entitlement(auth.supabase, f)));
  const prices = await loadPlanPrices(auth.supabase);
  return json({ plan: resume!.plan, canCreateResume: resume!.allowed, canUseAi: ai!.allowed, canExportPdf: pdf!.allowed, canExportDocx: docx!.allowed, premiumTemplates: premium!.allowed, limits: DEFAULT_PLAN_LIMITS, prices });
}
