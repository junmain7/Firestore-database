import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../lib/useAuth";
import { CopyIcon } from "../../components/icons";

const TABS = ["Get Started", "Read", "Add", "Update", "Delete", "Query"];

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="codeblock">
      <button className="copy-btn" onClick={copy}>
        <CopyIcon width={14} height={14} /> {copied ? "Copied" : "Copy"}
      </button>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function DocsPanel({ baseUrl }) {
  const [tab, setTab] = useState("Get Started");
  const [copiedAll, setCopiedAll] = useState(false);

  const snippets = {
    "Get Started": `// 1. Copy sdk/client.js into your app
import { GatewayClient } from "./client";

const db = new GatewayClient({
  baseUrl: "${baseUrl}",
  apiKey: "YOUR_API_KEY",
  projectId: "YOUR_PROJECT_ID",
});

// works just like Firebase Firestore —
// db.collection("posts").get()
// db.doc("posts/abc123").get()`,

    "Read": `// Get all docs in a collection
const { results } = await db.collection("users").get();
results.forEach(({ id, data }) => console.log(id, data));

// Get a single doc
const { data } = await db.doc("users/abc123").get();`,

    "Add": `// Add doc with auto-generated id (like Firestore's .add())
const { id } = await db.collection("users").add({
  name: "Ishwar",
  active: true,
});

// Create/overwrite doc with a specific id (like .doc(id).set())
await db.doc("users/abc123").create({ name: "Ishwar" });`,

    "Update": `// Merge-update a doc (like Firestore's .update())
await db.doc("users/abc123").set({ active: false });`,

    "Delete": `// Delete a doc
await db.doc("users/abc123").delete();`,

    "Query": `// Filter, sort, limit — same idea as Firestore queries
const { results } = await db
  .collection("users")
  .where("active", "==", true)
  .orderBy("createdAt", "desc")
  .limit(10)
  .get();`,
  };

  const rawSnippets = {
    "Get Started": `curl "${baseUrl}/api/db/users" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "x-project-id: YOUR_PROJECT_ID"`,
    "Read": `GET ${baseUrl}/api/db/users
GET ${baseUrl}/api/db/users/abc123
Headers: x-api-key, x-project-id`,
    "Add": `POST ${baseUrl}/api/db/users
Headers: x-api-key, x-project-id, Content-Type: application/json
Body: { "name": "Ishwar" }
→ auto id. Use /api/db/users/abc123 to set a specific id.`,
    "Update": `PUT ${baseUrl}/api/db/users/abc123
Body: { "active": false }   // merges into existing doc`,
    "Delete": `DELETE ${baseUrl}/api/db/users/abc123`,
    "Query": `GET ${baseUrl}/api/db/users?whereJson=[["active","==",true]]&orderBy=createdAt&orderDir=desc&limit=10`,
  };

  function copyAll() {
    const all = TABS.map(
      (t) => `// ---- ${t} ----\n${snippets[t]}\n\n/* Raw HTTP */\n${rawSnippets[t]}`
    ).join("\n\n");
    navigator.clipboard.writeText(all);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  return (
    <div className="card">
      <h3>How to use</h3>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>
        Drop <code>sdk/client.js</code> into your app. It talks to Firestore through this gateway — collections, docs, get/add/set/delete — same feel as the Firebase SDK, no Firebase config needed on your app side.
      </p>
      <button className="btn ghost" style={{ marginBottom: 12 }} onClick={copyAll}>
        {copiedAll ? "Copied all ✓" : "Copy all (Get + Read + Add + Update + Delete + Query)"}
      </button>
      <div className="doc-tabs">
        {TABS.map((t) => (
          <button key={t} className={`doc-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="doc-tab-label">SDK style</div>
      <CodeBlock code={snippets[tab]} />
      <div className="doc-tab-label">Raw HTTP</div>
      <CodeBlock code={rawSnippets[tab]} />
    </div>
  );
}

export default function ApiKeys() {
  const { authorized, authedFetch, role, user, keyAccess } = useAuth();
  const [keys, setKeys] = useState([]);
  const [keyName, setKeyName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [lastGeneratedKey, setLastGeneratedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("keys"); // "keys" | "docs"
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const isAdmin = role === "admin";

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
        body: JSON.stringify({ name: keyName, ownerEmail: ownerEmail || undefined }),
      });
      setLastGeneratedKey(result.apiKey);
      setKeyName("");
      setOwnerEmail("");
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function revoke(keyHash) {
    if (!confirm("Revoke this key permanently? It can never be re-enabled.")) return;
    setBusy(true);
    try {
      await authedFetch("/api/admin/keys", { method: "DELETE", body: JSON.stringify({ keyHash }) });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function toggleEnabled(keyHash, currentlyDisabled) {
    setBusy(true);
    try {
      await authedFetch("/api/admin/keys", {
        method: "PATCH",
        body: JSON.stringify({ keyHash, enabled: currentlyDisabled }),
      });
      await refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <Layout active="keys" title="API">
      <div className="doc-tabs" style={{ marginBottom: 16 }}>
        <button className={`doc-tab${view === "keys" ? " active" : ""}`} onClick={() => setView("keys")}>Keys</button>
        <button className={`doc-tab${view === "docs" ? " active" : ""}`} onClick={() => setView("docs")}>Documentation</button>
      </div>

      {err && <div className="alert">{err}</div>}

      {view === "docs" ? (
        <DocsPanel baseUrl={baseUrl} />
      ) : !isAdmin && !keyAccess ? (
        <div className="card">
          <h3>Key access not granted yet</h3>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Ask an admin to grant key access from the Users tab — once granted, you can create your own API key here.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Generate API key</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -6 }}>
              {isAdmin
                ? "Works across every Firebase project registered on this gateway. Leave owner blank to keep it under your own name."
                : "This key will be created under your account — you can pause or revoke it anytime."}
            </p>
            <input
              className="field"
              placeholder="Key name — e.g. Rang Tarang app"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            {isAdmin && (
              <input
                className="field"
                placeholder="Owner / customer email (optional)"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            )}
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
            {!loading && keys.length === 0 && <div className="empty">No keys yet.</div>}
            {keys.map((k) => (
              <div className="row" key={k.keyHash}>
                <div>
                  <div className="row-title">{k.name}</div>
                  <div className="row-sub">{isAdmin ? (k.ownerEmail || "unassigned") : "you"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {k.revoked ? (
                    <span className="badge off">revoked</span>
                  ) : (
                    <>
                      <span className={`badge${k.disabled ? " off" : ""}`}>{k.disabled ? "disabled" : "active"}</span>
                      <button className="btn ghost" disabled={busy} onClick={() => toggleEnabled(k.keyHash, k.disabled)}>
                        {k.disabled ? "Enable" : "Disable"}
                      </button>
                      <button className="btn danger-ghost" disabled={busy} onClick={() => revoke(k.keyHash)}>Revoke</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  );
}
