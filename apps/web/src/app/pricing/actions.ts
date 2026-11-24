"use server";

import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin-client";
import { createClient } from "@/lib/supabase/server";
import { startCheckout } from "@/lib/services/billing";

export async function checkout(plan: string, period: string): Promise<{ message: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/pricing");
  if (user.is_anonymous) return { message: "Create an account before upgrading so your plan is saved." };
  const r = await startCheckout(supabase, adminClient(), user, { plan, period });
  if (!r.ok) return { message: r.message };
  redirect(r.value.url);
}
