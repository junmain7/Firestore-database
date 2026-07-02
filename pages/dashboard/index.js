import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../../components/Layout";
import { useAuth } from "../../lib/useAuth";

export default function Dashboard() {
  const { user, authorized, authedFetch, role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [keys, setKeys] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!authorized || !role) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        if (isAdmin) {
          const [p, k, u] = await Promise.all([
            authedFetch("/api/admin/projects"),
            authedFetch("/api/admin/keys"),
            authedFetch("/api/admin/users"),
          ]);
          if (cancelled) return;
          setProjects(p.projects || []);
          setKeys(k.keys || []);
          setUsers(u.users || []);
        } else {
          const k = await authedFetch("/api/admin/keys");
          if (cancelled) return;
          setKeys(k.keys || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authorized, role, isAdmin, authedFetch]);

  const activeKeys = keys.filter((k) => !k.revoked).length;

  return (
    <Layout active="dashboard" title="Dashboard">
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="row-title">Welcome back</div>
          <div className="row-sub">{user?.email}</div>
        </div>
      </div>

      {err && <div className="alert">{err}</div>}

      {isAdmin ? (
        <div className="stat-grid">
          <Link href="/firebase" className="stat-card">
            <div className="stat-value">{loading ? "…" : projects.length}</div>
            <div className="stat-label">Firebase projects</div>
          </Link>
          <Link href="/keys" className="stat-card">
            <div className="stat-value">{loading ? "…" : activeKeys}</div>
            <div className="stat-label">Active API keys</div>
          </Link>
          <Link href="/users" className="stat-card">
            <div className="stat-value">{loading ? "…" : users.length}</div>
            <div className="stat-label">Members</div>
          </Link>
        </div>
      ) : (
        <div className="stat-grid" style={{ gridTemplateColumns: "1fr" }}>
          <Link href="/keys" className="stat-card">
            <div className="stat-value">{loading ? "…" : activeKeys}</div>
            <div className="stat-label">Your active API keys</div>
          </Link>
        </div>
      )}

      <div className="card">
        <h3>Quick actions</h3>
        <div className="quick-actions">
          {isAdmin && <Link href="/firebase" className="btn ghost">+ Add Firebase project</Link>}
          <Link href="/keys" className="btn ghost">+ Generate API key</Link>
          {isAdmin && <Link href="/users" className="btn ghost">+ Invite member</Link>}
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <h3>Recently registered projects</h3>
          {!loading && projects.length === 0 && <div className="empty">Nothing registered yet.</div>}
          {projects.slice(0, 5).map((p) => (
            <div className="row" key={p.id}>
              <div>
                <div className="row-title">{p.name}</div>
                <div className="row-sub">{p.id}</div>
              </div>
            </div>
          ))}
          {projects.length > 0 && (
            <Link href="/firebase" style={{ fontSize: 13, display: "inline-block", marginTop: 8 }}>
              Manage all →
            </Link>
          )}
        </div>
      )}
    </Layout>
  );
}
