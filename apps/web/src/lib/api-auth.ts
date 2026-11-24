import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/** CORS for token-authenticated API (no cookies are used, so a wildcard origin does not expose sessions). */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const preflight = () => new Response(null, { status: 204, headers: CORS });

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

/** Supabase client acting as the caller (their JWT, RLS applies). Returns null when the token is missing/invalid. */
export async function bearerAuth(req: Request): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = /^Bearer (.+)$/i.exec(header)?.[1];
  if (!token) return null;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export const unauthorized = () => json({ ok: false, kind: "auth", message: "Please sign in again." }, 401);
