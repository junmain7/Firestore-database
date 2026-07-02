import { useEffect, useState } from "react";

const box = { border: "1px solid #333", borderRadius: 10, padding: 14, marginBottom: 14, background: "#111" };
const input = { width: "100%", padding: 10, marginBottom: 8, borderRadius: 6, border: "1px solid #444", background: "#000", color: "#fff", boxSizing: "border-box" };
const btn = { padding: "10px 14px", borderRadius: 6, border: "none", background: "#4f7cff", color: "#fff", fontWeight: 600, marginTop: 4 };
const page = { maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif", background: "#000", color: "#fff", minHeight: "100vh" };

export default function Dashboard() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [projects, setProjects] = useState([]);
  const [keys, setKeys] = useState([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newSaJson, setNewSaJson] = useState("");
  const [newWebApiKey, setNewWebApiKey] = useState("");
  const [keyProjectId, setKeyProjectId] = useState("");
  const [keyName, setKeyName] = useState("");
  const [lastGeneratedKey, setLastGeneratedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("gw_admin_secret");
    if (saved) {
      setSecret(saved);
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (unlocked) refresh();
    // eslint-disable-next-line
  }, [unlocked]);

  async function call(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", "x-admin-secret": secret, ...(opts.headers || {}) },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function refresh() {
    setErr("");
    try {
      const [p, k] = await Promise.all([call("/api/admin/projects"), call("/api/admin/keys")]);
      setProjects(p.projects || []);
      setKeys(k.keys || []);
    } catch (e) {
      setErr(e.message);
    }
  }

  function unlock() {
    localStorage.setItem("gw_admin_secret", secret);
    setUnlocked(true);
  }

  async function addProject() {
    setBusy(true);
    setErr("");
    try {
      await call("/api/admin/projects", {
        method: "POST",
        body: JSON.stringify({ name: newProjectName, serviceAccountJson: newSaJson, webApiKey: newWebApiKey }),
      });
      setNewProjectName("");
      setNewSaJson("");
      setNewWebApiKey("");
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function removeProject(id) {
    if (!confirm(`Delete project ${id}? This does not delete the Firebase project itself, only unregisters it here.`)) return;
    setBusy(true);
    try {
      await call("/api/admin/projects", { method: "DELETE", body: JSON.stringify({ id }) });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function generateKey() {
    setBusy(true);
    setErr("");
    try {
      const result = await call("/api/admin/keys", {
        method: "POST",
        body: JSON.stringify({ projectId: keyProjectId, name: keyName }),
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
    if (!confirm("Revoke this key? Apps using it will stop working immediately.")) return;
    setBusy(true);
    try {
      await call("/api/admin/keys", { method: "DELETE", body: JSON.stringify({ keyHash }) });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  if (!unlocked) {
    return (
      <div style={page}>
        <h2>🔐 Gateway Dashboard</h2>
        <div style={box}>
          <input style={input} type="password" placeholder="Admin secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
          <button style={btn} onClick={unlock}>Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <h2>🔥 Firebase Gateway</h2>
      {err && <div style={{ ...box, borderColor: "#ff4f4f", color: "#ff8a8a" }}>{err}</div>}

      <div style={box}>
        <h3>➕ Register a Firebase project</h3>
        <input style={input} placeholder="Display name (e.g. Joysiddhi Puja)" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
        <textarea style={{ ...input, height: 100 }} placeholder="Paste service account JSON here" value={newSaJson} onChange={(e) => setNewSaJson(e.target.value)} />
        <input style={input} placeholder="Web API key (optional, enables Google login token exchange)" value={newWebApiKey} onChange={(e) => setNewWebApiKey(e.target.value)} />
        <button style={btn} disabled={busy} onClick={addProject}>Register project</button>
      </div>

      <div style={box}>
        <h3>📦 Registered projects</h3>
        {projects.length === 0 && <p>None yet.</p>}
        {projects.map((p) => (
          <div key={p.id} style={{ padding: 8, borderBottom: "1px solid #333" }}>
            <b>{p.name}</b> <span style={{ color: "#888" }}>({p.id})</span>
            <button style={{ ...btn, background: "#552222", marginLeft: 8, padding: "4px 8px" }} onClick={() => removeProject(p.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div style={box}>
        <h3>🔑 Generate API key</h3>
        <select style={input} value={keyProjectId} onChange={(e) => setKeyProjectId(e.target.value)}>
          <option value="">Select project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input style={input} placeholder="Key name (e.g. Rang Tarang app)" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
        <button style={btn} disabled={busy || !keyProjectId} onClick={generateKey}>Generate key</button>
        {lastGeneratedKey && (
          <div style={{ marginTop: 10, padding: 10, background: "#052", borderRadius: 6, wordBreak: "break-all" }}>
            ⚠️ Copy now, shown only once:<br /><code>{lastGeneratedKey}</code>
          </div>
        )}
      </div>

      <div style={box}>
        <h3>📋 Active keys</h3>
        {keys.length === 0 && <p>None yet.</p>}
        {keys.map((k) => (
          <div key={k.keyHash} style={{ padding: 8, borderBottom: "1px solid #333", opacity: k.revoked ? 0.4 : 1 }}>
            <b>{k.name}</b> → {k.projectId} {k.revoked && "(revoked)"}
            {!k.revoked && (
              <button style={{ ...btn, background: "#552222", marginLeft: 8, padding: "4px 8px" }} onClick={() => revoke(k.keyHash)}>Revoke</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
