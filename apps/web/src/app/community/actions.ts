"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/services/resumes";
import { addComment, createPost, deleteComment, deletePost, report, toggleLike, type Comment } from "@/lib/services/community";

const AUTH = { ok: false, kind: "auth", message: "Please sign in again." } as never;

async function authed() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

export async function newPost(input: unknown): Promise<ActionResult<{ id: string }>> {
  const a = await authed();
  return a ? createPost(a.supabase, a.user, input) : AUTH;
}
export async function removePost(id: string): Promise<boolean> {
  const a = await authed();
  return a ? deletePost(a.supabase, id) : false;
}
export async function reply(postId: string, input: unknown): Promise<ActionResult<{ comment: Comment }>> {
  const a = await authed();
  return a ? addComment(a.supabase, a.user, postId, input) : AUTH;
}
export async function removeComment(id: string): Promise<boolean> {
  const a = await authed();
  return a ? deleteComment(a.supabase, id) : false;
}
export async function like(postId: string): Promise<ActionResult<{ liked: boolean }>> {
  const a = await authed();
  return a ? toggleLike(a.supabase, a.user, postId) : AUTH;
}
export async function reportContent(input: { postId?: string; commentId?: string; reason: string }): Promise<ActionResult> {
  const a = await authed();
  return a ? report(a.supabase, a.user, input) : AUTH;
}
