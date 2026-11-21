import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/validation";

/** Email links (verification, recovery, email change) land here with token_hash or code. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing token") };
  return NextResponse.redirect(new URL(error ? "/sign-in?error=link_invalid" : next, url.origin));
}
