import { signInWithGoogle } from "./auth-actions";

/** "Continue with Google": server action starts Supabase OAuth (PKCE); /auth/callback finishes it. */
export function GoogleButton({ next }: { next?: string }) {
  return (
    <>
      <p className="muted small center" style={{ margin: "14px 0 8px" }}>or continue with</p>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <button type="submit" className="btn secondary" style={{ width: "100%" }}>
          <span aria-hidden style={{ fontWeight: 800, color: "#4285F4", marginInlineEnd: 8 }}>G</span>Continue with Google
        </button>
      </form>
    </>
  );
}
