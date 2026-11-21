import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// User-scoped tables (RLS limits every query to the signed-in user).
const TABLES = [
  "profiles", "master_profiles", "personal_details", "work_experiences", "education_records", "skills", "certifications",
  "languages", "projects", "resume_documents", "resume_versions", "resume_sections", "job_descriptions", "ats_results",
  "cover_letters", "uploaded_documents", "document_exports", "ai_jobs", "subscriptions", "payments", "entitlements",
  "usage_quotas", "support_requests", "deletion_requests",
] as const;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), user: { id: user.id, email: user.email, created_at: user.created_at } };
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*").limit(10_000);
    out[t] = error ? { error: "unavailable" } : data;
  }
  await supabase.rpc("write_audit_log", { p_action: "account.data_exported", p_entity_type: "user", p_entity_id: user.id, p_metadata: {} });
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="resume-studio-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
