import { useEffect, useState } from "react";

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
    if (!secret) return;
    localStorage.setItem("gw_admin_secret", secret);
    setUnlocked(true);
  }

  function lock() {
    localStorage.removeItem("gw_admin_secret");
    setUnlocked(false);
    setSecret("");
  }

  async function addProject() {
    if (!newProjectName || !newSaJson) return setErr("Name and service account JSON are required.");
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
    if (!confirm(`Remove ${id}? This only unregisters it here — the Firebase project itself is untouched.`)) return;
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
    if (!confirm("Revoke this key? Apps using it stop working immediately.")) return;
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
      <div className="wrap">
        <div className="topbar">
          <span className="dot" />
          <span className="brand">firebase-gateway</span>
        </div>
        <div className="card">
          <h3>Unlock dashboard</h3>
          <input
            className="field mono"
            type="password"
            placeholder="Admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          <button className="btn" onClick={unlock}>Unlock</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <span className="dot" />
        <span className="brand">firebase-gateway</span>
        <span className="brand-sub">
          {projects.length} project{projects.length !== 1 ? "s" : ""} · {keys.filter((k) => !k.revoked).length} active key{keys.filter((k) => !k.revoked).length !== 1 ? "s" : ""}
        </span>
      </div>

      {err && <div className="alert">{err}</div>}

      <div className="card">
        <h3>Register a Firebase project</h3>
        <input className="field" placeholder="Display name — e.g. Joysiddhi Puja" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
        <textarea className="field mono" placeholder="Paste service account JSON" value={newSaJson} onChange={(e) => setNewSaJson(e.target.value)} />
        <input className="field mono" placeholder="Web API key (optional — enables Google login)" value={newWebApiKey} onChange={(e) => setNewWebApiKey(e.target.value)} />
        <button className="btn" disabled={busy} onClick={addProject}>Register project</button>
      </div>

      <div className="card">
        <h3>Registered projects</h3>
        {projects.length === 0 && <div className="empty">Nothing registered yet.</div>}
        {projects.map((p) => (
          <div className="row" key={p.id}>
            <div>
              <div className="row-title">{p.name}</div>
              <div className="row-sub">{p.id}</div>
            </div>
            <button className="btn danger-ghost" onClick={() => removeProject(p.id)}>Remove</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Generate API key</h3>
        <select className="field" value={keyProjectId} onChange={(e) => setKeyProjectId(e.target.value)}>
          <option value="">Select project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input className="field" placeholder="Key name — e.g. Rang Tarang app" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
        <button className="btn" disabled={busy || !keyProjectId} onClick={generateKey}>Generate key</button>
        {lastGeneratedKey && (
          <div className="keybox">
            <span className="label">Copy now — shown once only</span>
            {lastGeneratedKey}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Active keys</h3>
        {keys.length === 0 && <div className="empty">No keys yet.</div>}
        {keys.map((k) => (
          <div className="row" key={k.keyHash}>
            <div>
              <div className="row-title">{k.name}</div>
              <div className="row-sub">{k.projectId}</div>
            </div>
            {k.revoked ? (
              <span className="badge off">revoked</span>
            ) : (
              <button className="btn danger-ghost" onClick={() => revoke(k.keyHash)}>Revoke</button>
            )}
          </div>
        ))}
      </div>

      <button className="btn ghost" onClick={lock}>Lock dashboard</button>
    </div>
  );
}
