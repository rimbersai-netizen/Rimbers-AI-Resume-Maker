"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client (anon key + user session cookie). Used only for direct-to-storage uploads; RLS applies. */
export const createClient = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
