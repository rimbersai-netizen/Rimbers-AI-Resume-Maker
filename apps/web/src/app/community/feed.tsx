"use client";

import Link from "next/link";
import { useState } from "react";
import type { Post } from "@/lib/services/community";
import { like, newPost } from "./actions";
import { ago } from "../jobs/bits";

export const KIND_LABEL = { win: "Win", question: "Question", discussion: "Discussion", roast: "Feedback" } as const;

export function Feed({ initial }: { initial: Post[] }) {
  const [posts, setPosts] = useState(initial);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Post["kind"]>("discussion");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await newPost({ kind, title, body: text });
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    // Reload the list from the server so the post shows with its real handle and counts.
    window.location.reload();
  };

  const toggle = async (p: Post) => {
    setPosts((xs) => xs.map((x) => (x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)));
    const r = await like(p.id);
    if (!r.ok) setPosts((xs) => xs.map((x) => (x.id === p.id ? p : x)));
  };

  return (
    <>
      {!open ? <button type="button" className="btn" style={{ maxWidth: 260 }} onClick={() => setOpen(true)}>+ New post</button> : (
        <form className="card wide" onSubmit={submit} aria-label="New post">
          <label>Type
            <select value={kind} onChange={(e) => setKind(e.target.value as Post["kind"])}>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label htmlFor="post-title">Title</label>
          <input id="post-title" type="text" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
          <label htmlFor="post-body">What’s on your mind?</label>
          <textarea id="post-body" rows={5} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} required />
          <p className="muted small">Don’t include links, emails or phone numbers. Posts are public to all members.</p>
          {err && <p className="alert error" role="alert">{err}</p>}
          <div className="row"><button className="btn" disabled={busy}>{busy ? "Posting…" : "Post"}</button><button type="button" className="link" onClick={() => setOpen(false)}>Cancel</button></div>
        </form>
      )}
      {posts.length === 0 ? <p className="empty" style={{ marginTop: 16 }}>Nothing here yet — be the first to post.</p> : (
        <ul className="jobs-rows" style={{ marginTop: 16 }}>
          {posts.map((p) => (
            <li key={p.id} className="jobs-row post">
              <div className="muted small"><span className="badge">{KIND_LABEL[p.kind]}</span> {p.handle} · {ago(p.createdAt)}</div>
              <h2 className="post-title"><Link href={`/community/${p.id}`}>{p.title}</Link></h2>
              <p className="post-body">{p.body.length > 240 ? `${p.body.slice(0, 240)}…` : p.body}</p>
              <div className="row">
                <button type="button" className={`pill${p.liked ? " on" : ""}`} aria-pressed={p.liked} onClick={() => toggle(p)}>👍 {p.likes}</button>
                <Link className="pill" href={`/community/${p.id}`}>💬 {p.comments}</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
