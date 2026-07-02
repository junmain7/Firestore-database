import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../lib/useAuth";

function emptyForm() {
  return {
    name: "",
    mode: "json", // "json" | "fields"
    serviceAccountJson: "",
    saFields: { project_id: "", private_key_id: "", private_key: "", client_email: "", client_id: "" },
    webApiKey: "",
  };
}

function buildServiceAccountJson(f) {
  if (f.mode === "json") return f.serviceAccountJson;
  const { project_id, private_key_id, private_key, client_email, client_id } = f.saFields;
  if (!project_id || !private_key || !client_email) return "";
  return JSON.stringify({
    type: "service_account",
    project_id,
    private_key_id,
    private_key: private_key.replace(/\\n/g, "\n"),
    client_email,
    client_id,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  });
}

export default function FirebaseProjects() {
  const { authorized, authedFetch } = useAuth();
  const [projects, setProjects] = useState([]);
  const [keys, setKeys] = useState([]);
  const [forms, setForms] = useState([emptyForm()]); // supports adding multiple projects at once
  const [keyProjectId, setKeyProjectId] = useState("");
  const [keyName, setKeyName] = useState("");
  const [lastGeneratedKey, setLastGeneratedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setErr("");
    try {
      const [p, k] = await Promise.all([authedFetch("/api/admin/projects"), authedFetch("/api/admin/keys")]);
      setProjects(p.projects || []);
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

  function updateForm(i, field, value) {
    setForms((prev) => prev.map((f, idx) => (idx === i ? { ...f, [field]: value } : f)));
  }

  function updateSaField(i, field, value) {
    setForms((prev) => prev.map((f, idx) => (idx === i ? { ...f, saFields: { ...f.saFields, [field]: value } } : f)));
  }

  function setMode(i, mode) {
    setForms((prev) => prev.map((f, idx) => (idx === i ? { ...f, mode } : f)));
  }

  function addFormRow() {
    setForms((prev) => [...prev, emptyForm()]);
  }

  function removeFormRow(i) {
    setForms((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function registerAll() {
    const rows = forms
      .map((f) => ({ name: f.name, webApiKey: f.webApiKey, sa: buildServiceAccountJson(f) }))
      .filter((r) => r.name && r.sa);
    if (rows.length === 0) return setErr("Add a name and service account details (JSON or fields) for at least one project.");
    setBusy(true);
    setErr("");
    try {
      for (const r of rows) {
        // eslint-disable-next-line no-await-in-loop
        await authedFetch("/api/admin/projects", {
          method: "POST",
          body: JSON.stringify({ name: r.name, serviceAccountJson: r.sa, webApiKey: r.webApiKey }),
        });
      }
      setForms([emptyForm()]);
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
      await authedFetch("/api/admin/projects", { method: "DELETE", body: JSON.stringify({ id }) });
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
      const result = await authedFetch("/api/admin/keys", {
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
      await authedFetch("/api/admin/keys", { method: "DELETE", body: JSON.stringify({ keyHash }) });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <Layout active="firebase" title="Firebase">
      {err && <div className="alert">{err}</div>}

      <div className="card">
        <h3>Register Firebase project(s)</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>
          Add one or more projects at once — tap "Add another" to queue more before submitting.
        </p>
        {forms.map((f, i) => (
          <div key={i} style={{ paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? "1px solid var(--border)" : "none", marginTop: i > 0 ? 10 : 0 }}>
            <input
              className="field"
              placeholder="Display name — e.g. Joysiddhi Puja"
              value={f.name}
              onChange={(e) => updateForm(i, "name", e.target.value)}
            />

            <div className="mode-toggle">
              <button
                type="button"
                className={`mode-btn${f.mode === "json" ? " active" : ""}`}
                onClick={() => setMode(i, "json")}
              >
                Paste JSON
              </button>
              <button
                type="button"
                className={`mode-btn${f.mode === "fields" ? " active" : ""}`}
                onClick={() => setMode(i, "fields")}
              >
                Enter values separately
              </button>
            </div>

            {f.mode === "json" ? (
              <textarea
                className="field mono"
                placeholder="Paste service account JSON"
                value={f.serviceAccountJson}
                onChange={(e) => updateForm(i, "serviceAccountJson", e.target.value)}
              />
            ) : (
              <>
                <input
                  className="field mono"
                  placeholder="project_id"
                  value={f.saFields.project_id}
                  onChange={(e) => updateSaField(i, "project_id", e.target.value)}
                />
                <input
                  className="field mono"
                  placeholder="client_email — xxx@xxx.iam.gserviceaccount.com"
                  value={f.saFields.client_email}
                  onChange={(e) => updateSaField(i, "client_email", e.target.value)}
                />
                <textarea
                  className="field mono"
                  placeholder="private_key — paste including BEGIN/END PRIVATE KEY lines"
                  value={f.saFields.private_key}
                  onChange={(e) => updateSaField(i, "private_key", e.target.value)}
                />
                <input
                  className="field mono"
                  placeholder="private_key_id (optional)"
                  value={f.saFields.private_key_id}
                  onChange={(e) => updateSaField(i, "private_key_id", e.target.value)}
                />
                <input
                  className="field mono"
                  placeholder="client_id (optional)"
                  value={f.saFields.client_id}
                  onChange={(e) => updateSaField(i, "client_id", e.target.value)}
                />
              </>
            )}

            <input
              className="field mono"
              placeholder="Web API key (optional — enables Google login)"
              value={f.webApiKey}
              onChange={(e) => updateForm(i, "webApiKey", e.target.value)}
            />
            {forms.length > 1 && (
              <button className="btn danger-ghost" onClick={() => removeFormRow(i)}>Remove this row</button>
            )}
          </div>
        ))}
        <div className="quick-actions" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={addFormRow}>+ Add another project</button>
          <button className="btn" disabled={busy} onClick={registerAll}>
            {forms.length > 1
              ? `Register ${forms.filter((f) => f.name && buildServiceAccountJson(f)).length} projects`
              : "Register project"}
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Registered projects</h3>
        {!loading && projects.length === 0 && <div className="empty">Nothing registered yet.</div>}
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
        {!loading && keys.length === 0 && <div className="empty">No keys yet.</div>}
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
    </Layout>
  );
}
