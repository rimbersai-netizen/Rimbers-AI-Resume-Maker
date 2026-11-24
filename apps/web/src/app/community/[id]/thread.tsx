"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Comment, Post } from "@/lib/services/community";
import { like, removeComment, removePost, reply, reportContent } from "../actions";
import { KIND_LABEL } from "../feed";
import { ago } from "../../jobs/bits";

export function Thread({ post, initialComments }: { post: Post; initialComments: Comment[] }) {
  const router = useRouter();
  const [p, setP] = useState(post);
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await reply(p.id, { body: text });
    setBusy(false);
    if (!r.ok) return setMsg(r.message);
    setComments((c) => [...c, r.value.comment]); setText("");
  };
  const flag = async (target: { postId?: string; commentId?: string }) => {
    const reason = prompt("What is wrong with this? (a few words)");
    if (!reason) return;
    const r = await reportContent({ ...target, reason });
    setMsg(r.ok ? "Thanks — we’ll review it." : r.message);
  };

  return (
    <article className="card wide" style={{ marginTop: 12 }}>
      <div className="muted small"><span className="badge">{KIND_LABEL[p.kind]}</span> {p.handle} · {ago(p.createdAt)}</div>
      <h1>{p.title}</h1>
      <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
      <div className="row">
        <button type="button" className={`pill${p.liked ? " on" : ""}`} aria-pressed={p.liked} onClick={async () => {
          setP({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) });
          const r = await like(p.id); if (!r.ok) setP(p);
        }}>👍 {p.likes}</button>
        {p.mine ? <button type="button" className="link danger" onClick={async () => { if (confirm("Delete this post?") && (await removePost(p.id))) { router.push("/community"); router.refresh(); } }}>Delete</button>
          : <button type="button" className="link" onClick={() => flag({ postId: p.id })}>Report</button>}
      </div>
      <h2 className="jobs-h2">Replies <span className="badge">{comments.length}</span></h2>
      <ul className="jobs-rows">
        {comments.map((c) => (
          <li key={c.id} className="jobs-row">
            <div className="muted small">{c.handle}{c.mine ? " (you)" : ""} · {ago(c.createdAt)}</div>
            <p style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{c.body}</p>
            {c.mine ? <button type="button" className="link danger small" onClick={async () => { if (await removeComment(c.id)) setComments((xs) => xs.filter((x) => x.id !== c.id)); }}>Delete</button>
              : <button type="button" className="link small" onClick={() => flag({ commentId: c.id })}>Report</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={send}>
        <label htmlFor="reply">Add a reply</label>
        <textarea id="reply" rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} required />
        {msg && <p className="alert error" role="alert">{msg}</p>}
        <button className="btn" disabled={busy || !text.trim()} style={{ maxWidth: 200 }}>{busy ? "Sending…" : "Reply"}</button>
      </form>
    </article>
  );
}
