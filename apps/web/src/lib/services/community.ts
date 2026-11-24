import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import type { ActionResult } from "./resumes";

export const KINDS = ["win", "question", "discussion", "roast"] as const;
export type PostKind = (typeof KINDS)[number];

export interface Post { id: string; handle: string; kind: PostKind; title: string; body: string; createdAt: string; likes: number; comments: number; mine: boolean; liked: boolean }
export interface Comment { id: string; handle: string; body: string; createdAt: string; mine: boolean }

const uuid = z.string().uuid();
const PostInput = z.object({ kind: z.enum(KINDS), title: z.string().trim().min(3).max(140), body: z.string().trim().min(3).max(4000) });
const CommentInput = z.object({ body: z.string().trim().min(1).max(2000) });

/** Light content guard: contact details and links in posts invite spam and doxxing; keep the community text-only. */
const CONTACT = /(https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\+?\d[\d\s().-]{8,}\d/i;
export const containsContact = (s: string) => CONTACT.test(s);
const CONTACT_MSG = "Please remove links, emails and phone numbers — posts here are public.";

function friendly(error: { code?: string; message?: string }): string {
  if (error.code === "P0001") return "You've reached today's limit. Try again tomorrow.";
  if (error.code === "42501") return "You can't do that.";
  return "Something went wrong. Please try again.";
}

type Row = { id: string; handle: string; kind: PostKind; title: string; body: string; created_at: string; user_id: string; likes: { count: number }[]; comments: { count: number }[] };
const POST_COLS = "id,handle,kind,title,body,created_at,user_id,likes:community_reactions(count),comments:community_comments(count)";

async function decorate(supabase: SupabaseClient, user: User, rows: Row[]): Promise<Post[]> {
  const ids = rows.map((r) => r.id);
  const liked = new Set<string>();
  if (ids.length) {
    const { data } = await supabase.from("community_reactions").select("post_id").eq("user_id", user.id).in("post_id", ids);
    for (const r of data ?? []) liked.add(r.post_id);
  }
  return rows.map((r) => ({
    id: r.id, handle: r.handle, kind: r.kind, title: r.title, body: r.body, createdAt: r.created_at,
    likes: r.likes?.[0]?.count ?? 0, comments: r.comments?.[0]?.count ?? 0, mine: r.user_id === user.id, liked: liked.has(r.id),
  }));
}

export async function listPosts(supabase: SupabaseClient, user: User, opts: { kind?: string; before?: string } = {}): Promise<Post[]> {
  let q = supabase.from("community_posts").select(POST_COLS).order("created_at", { ascending: false }).limit(30);
  if (opts.kind && (KINDS as readonly string[]).includes(opts.kind)) q = q.eq("kind", opts.kind);
  if (opts.before && !Number.isNaN(Date.parse(opts.before))) q = q.lt("created_at", opts.before);
  const { data } = await q;
  return decorate(supabase, user, (data ?? []) as unknown as Row[]);
}

export async function getPost(supabase: SupabaseClient, user: User, id: string): Promise<{ post: Post; comments: Comment[] } | null> {
  if (!uuid.safeParse(id).success) return null;
  const { data } = await supabase.from("community_posts").select(POST_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const [post] = await decorate(supabase, user, [data as unknown as Row]);
  const { data: cs } = await supabase.from("community_comments").select("id,handle,body,created_at,user_id").eq("post_id", id).order("created_at").limit(200);
  return { post: post!, comments: (cs ?? []).map((c) => ({ id: c.id, handle: c.handle, body: c.body, createdAt: c.created_at, mine: c.user_id === user.id })) };
}

async function handle(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_community_handle");
  return error || typeof data !== "string" ? null : data;
}

export async function createPost(supabase: SupabaseClient, user: User, input: unknown): Promise<ActionResult<{ id: string }>> {
  const p = PostInput.safeParse(input);
  if (!p.success) return { ok: false, kind: "invalid", message: "Add a title (3+ characters) and some text." };
  if (containsContact(p.data.title) || containsContact(p.data.body)) return { ok: false, kind: "invalid", message: CONTACT_MSG };
  const h = await handle(supabase);
  if (!h) return { ok: false, kind: "error", message: "Could not set up your community name." };
  const { data, error } = await supabase.from("community_posts").insert({ user_id: user.id, handle: h, ...p.data }).select("id").single();
  return error || !data ? { ok: false, kind: "error", message: friendly(error ?? {}) } : { ok: true, value: { id: data.id } };
}

export async function deletePost(supabase: SupabaseClient, id: string): Promise<boolean> {
  if (!uuid.safeParse(id).success) return false;
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  return !error;
}

export async function addComment(supabase: SupabaseClient, user: User, postId: string, input: unknown): Promise<ActionResult<{ comment: Comment }>> {
  const p = CommentInput.safeParse(input);
  if (!uuid.safeParse(postId).success || !p.success) return { ok: false, kind: "invalid", message: "Write a reply first." };
  if (containsContact(p.data.body)) return { ok: false, kind: "invalid", message: CONTACT_MSG };
  const h = await handle(supabase);
  if (!h) return { ok: false, kind: "error", message: "Could not set up your community name." };
  const { data, error } = await supabase.from("community_comments").insert({ post_id: postId, user_id: user.id, handle: h, body: p.data.body }).select("id,handle,body,created_at").single();
  return error || !data ? { ok: false, kind: "error", message: friendly(error ?? {}) }
    : { ok: true, value: { comment: { id: data.id, handle: data.handle, body: data.body, createdAt: data.created_at, mine: true } } };
}

export async function deleteComment(supabase: SupabaseClient, id: string): Promise<boolean> {
  if (!uuid.safeParse(id).success) return false;
  const { error } = await supabase.from("community_comments").delete().eq("id", id);
  return !error;
}

export async function toggleLike(supabase: SupabaseClient, user: User, postId: string): Promise<ActionResult<{ liked: boolean }>> {
  if (!uuid.safeParse(postId).success) return { ok: false, kind: "invalid", message: "Invalid post." };
  const { data: existing } = await supabase.from("community_reactions").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("community_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
    return error ? { ok: false, kind: "error", message: friendly(error) } : { ok: true, value: { liked: false } };
  }
  const { error } = await supabase.from("community_reactions").insert({ post_id: postId, user_id: user.id });
  return error ? { ok: false, kind: "error", message: friendly(error) } : { ok: true, value: { liked: true } };
}

export async function report(supabase: SupabaseClient, user: User, input: { postId?: string; commentId?: string; reason: string }): Promise<ActionResult> {
  const reason = input.reason?.trim() ?? "";
  const target = input.postId && uuid.safeParse(input.postId).success ? { post_id: input.postId } : input.commentId && uuid.safeParse(input.commentId).success ? { comment_id: input.commentId } : null;
  if (!target || reason.length < 3 || reason.length > 500) return { ok: false, kind: "invalid", message: "Tell us briefly what is wrong." };
  const { error } = await supabase.from("community_reports").insert({ user_id: user.id, reason, ...target });
  if (error?.code === "23505") return { ok: true };
  return error ? { ok: false, kind: "error", message: "Could not send your report." } : { ok: true };
}
