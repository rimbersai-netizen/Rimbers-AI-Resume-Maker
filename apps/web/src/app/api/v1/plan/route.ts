import { bearerAuth, json, preflight, unauthorized } from "@/lib/api-auth";
import { DEFAULT_PLAN_LIMITS } from "@gars/subscriptions";
import { entitlement } from "@/lib/entitlements";

export const OPTIONS = preflight;

/** GET -> what the signed-in user's plan currently allows (for UI hints only; actions are enforced server-side). */
export async function GET(req: Request) {
  const auth = await bearerAuth(req);
  if (!auth) return unauthorized();
  const [resume, ai, pdf, docx, premium] = await Promise.all(
    (["create_resume", "ai_request", "export_pdf", "export_docx", "premium_template"] as const).map((f) => entitlement(auth.supabase, f)));
  return json({ plan: resume.plan, canCreateResume: resume.allowed, canUseAi: ai.allowed, canExportPdf: pdf.allowed, canExportDocx: docx.allowed, premiumTemplates: premium.allowed, limits: DEFAULT_PLAN_LIMITS });
}
