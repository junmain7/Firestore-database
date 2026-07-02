import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../lib/useAuth";

export default function Login() {
  const router = useRouter();
  const { user, authLoading, checkingAuthz, authorized, forbidden, loginWithGoogle, logout } = useAuth();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && user && !checkingAuthz && authorized) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, checkingAuthz, authorized, router]);

  async function handleLogin() {
    setErr("");
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const resolving = authLoading || (user && checkingAuthz);

  return (
    <div className="wrap">
      <div className="topbar">
        <span className="dot" />
        <span className="brand">firebase-gateway</span>
      </div>

      <div className="card">
        <h3>Admin sign-in</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          This dashboard is protected by Firebase Authentication. Only allow-listed emails can manage projects, keys, and users.
        </p>

        {resolving && <div className="empty">Checking session…</div>}

        {!resolving && user && !authorized && (
          <>
            <div className="alert">{forbidden || `${user.email} is not an authorized admin.`}</div>
            <button className="btn ghost" onClick={logout}>Sign out and try a different account</button>
          </>
        )}

        {!resolving && !user && (
          <>
            {err && <div className="alert">{err}</div>}
            <button className="btn" disabled={busy} onClick={handleLogin}>
              {busy ? "Signing in…" : "Sign in with Google"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
