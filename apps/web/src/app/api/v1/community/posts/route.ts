import { preflight, json } from "@/lib/api-auth";
import { body, result, route } from "@/lib/api-route";
import { createPost, listPosts } from "@/lib/services/community";

export const OPTIONS = preflight;

export const GET = route(async ({ supabase, user, query }) => json({ ok: true, posts: await listPosts(supabase, user, { kind: query.get("kind") ?? undefined, before: query.get("before") ?? undefined }) }));
export const POST = route(async ({ req, supabase, user }) => result(await createPost(supabase, user, await body(req))));
