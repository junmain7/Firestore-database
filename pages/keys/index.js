import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../lib/useAuth";

export default function ApiKeys() {
  const { authorized, authedFetch, role, user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [keyName, setKeyName] = useState("");
  const [lastGeneratedKey, setLastGeneratedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setErr("");
    try {
      const k = await authedFetch("/api/admin/keys");
      setKeys(k.keys || []);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (authorized) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  async function generateKey() {
    setBusy(true);
    setErr("");
    try {
      const result = await authedFetch("/api/admin/keys", {
        method: "POST",
        body: JSON.stringify({ name: keyName }),
      });
      setLastGeneratedKey(result.apiKey);
      setKeyName("");
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function revoke(keyHash) {
    if (!confirm("Revoke this key? Apps using it stop working immediately.")) return;
    setBusy(true);
    try {
      await authedFetch("/api/admin/keys", { method: "DELETE", body: JSON.stringify({ keyHash }) });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  const isAdmin = role === "admin";

  return (
    <Layout active="keys" title="API">
      {err && <div className="alert">{err}</div>}

      <div className="card">
        <h3>Generate API key</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>
          No project selection needed — this key works across every Firebase project registered on this gateway, so give it a name that says which app will use it.
        </p>
        <input
          className="field"
          placeholder="Key name — e.g. Rang Tarang app"
          value={keyName}
          onChange={(e) => setKeyName(e.target.value)}
        />
        <button className="btn" disabled={busy} onClick={generateKey}>Generate key</button>
        {lastGeneratedKey && (
          <div className="keybox">
            <span className="label">Copy now — shown once only</span>
            {lastGeneratedKey}
          </div>
        )}
      </div>

      <div className="card">
        <h3>{isAdmin ? "All API keys" : "Your API keys"}</h3>
        {!isAdmin && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>
            You only see keys you created — everyone's keys are kept separate.
          </p>
        )}
        {!loading && keys.length === 0 && <div className="empty">No keys yet.</div>}
        {keys.map((k) => (
          <div className="row" key={k.keyHash}>
            <div>
              <div className="row-title">{k.name}</div>
              <div className="row-sub">
                {isAdmin ? (k.ownerEmail === user?.email?.toLowerCase() ? "you" : k.ownerEmail || "unknown") : "you"}
              </div>
            </div>
            {k.revoked ? (
              <span className="badge off">revoked</span>
            ) : (
              <button className="btn danger-ghost" onClick={() => revoke(k.keyHash)}>Revoke</button>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
