import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../lib/useAuth";

export default function Users() {
  const { user, authorized, authedFetch, refreshAuthorization, role } = useAuth();
  const [users, setUsers] = useState([]);
  const [emails, setEmails] = useState([""]); // supports adding multiple people at once
  const [inviteRole, setInviteRole] = useState("user"); // "user" | "admin"
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setErr("");
    try {
      const u = await authedFetch("/api/admin/users");
      setUsers(u.users || []);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authorized && role === "admin") refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, role]);

  if (authorized && role && role !== "admin") {
    return (
      <Layout active="users" title="Users">
        <div className="card">
          <h3>Admins only</h3>
          <p style={{ fontSize: 14 }}>Inviting or managing dashboard members is limited to admins.</p>
        </div>
      </Layout>
    );
  }

  function updateEmail(i, value) {
    setEmails((prev) => prev.map((e, idx) => (idx === i ? value : e)));
  }

  function addEmailRow() {
    setEmails((prev) => [...prev, ""]);
  }

  function removeEmailRow(i) {
    setEmails((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function addAll() {
    const valid = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
    if (valid.length === 0) return setErr("Enter at least one valid email.");
    setBusy(true);
    setErr("");
    try {
      for (const email of valid) {
        // eslint-disable-next-line no-await-in-loop
        await authedFetch("/api/admin/users", { method: "POST", body: JSON.stringify({ email, role: inviteRole }) });
      }
      setEmails([""]);
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function removeUser(email) {
    if (!confirm(`Remove admin access for ${email}?`)) return;
    setBusy(true);
    setErr("");
    try {
      await authedFetch("/api/admin/users", { method: "DELETE", body: JSON.stringify({ email }) });
      await refresh();
      refreshAuthorization();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <Layout active="users" title="Users">
      {err && <div className="alert">{err}</div>}

      <div className="card">
        <h3>Add member(s)</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>
          Add one or more Google emails at once — they'll be able to sign in to this dashboard with the role you pick below.
        </p>

        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-btn${inviteRole === "user" ? " active" : ""}`}
            onClick={() => setInviteRole("user")}
          >
            Invite as User
          </button>
          <button
            type="button"
            className={`mode-btn${inviteRole === "admin" ? " active" : ""}`}
            onClick={() => setInviteRole("admin")}
          >
            Invite as Admin
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -6, marginBottom: 12 }}>
          {inviteRole === "admin"
            ? "Admins can register Firebase projects, manage members, and create API keys."
            : "Users can only open the API section to create and manage their own API keys."}
        </p>

        {emails.map((email, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              className="field"
              style={{ marginBottom: 0 }}
              placeholder="teammate@gmail.com"
              value={email}
              onChange={(e) => updateEmail(i, e.target.value)}
            />
            {emails.length > 1 && (
              <button className="btn danger-ghost" onClick={() => removeEmailRow(i)}>✕</button>
            )}
          </div>
        ))}
        <div className="quick-actions">
          <button className="btn ghost" onClick={addEmailRow}>+ Add another email</button>
          <button className="btn" disabled={busy} onClick={addAll}>
            {emails.length > 1 ? "Add all" : `Add ${inviteRole}`}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Members</h3>
        {!loading && users.length === 0 && <div className="empty">No members found.</div>}
        {users.map((u) => (
          <div className="row" key={u.email}>
            <div>
              <div className="row-title">{u.email}{u.email === user?.email?.toLowerCase() ? " (you)" : ""}</div>
              <div className="row-sub">{u.source === "env" ? "set via ADMIN_EMAILS" : "added from dashboard"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="badge">{u.role === "user" ? "user" : "admin"}</span>
              {u.source !== "env" && (
                <button className="btn danger-ghost" onClick={() => removeUser(u.email)}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
