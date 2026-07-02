import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "../lib/useAuth";
import { DashboardIcon, CloudIcon, UsersIcon, KeyIcon, LogoutIcon } from "./icons";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", Icon: DashboardIcon, adminOnly: false },
  { key: "firebase", label: "Firebase", href: "/firebase", Icon: CloudIcon, adminOnly: true },
  { key: "keys", label: "API", href: "/keys", Icon: KeyIcon, adminOnly: false },
  { key: "users", label: "Users", href: "/users", Icon: UsersIcon, adminOnly: true },
];

function initialsOf(email) {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

export default function Layout({ active, title, children }) {
  const router = useRouter();
  const { user, authLoading, checkingAuthz, authorized, forbidden, role, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  }

  // ---- Resolving firebase session ----
  if (authLoading || !user) {
    return (
      <div className="wrap">
        <div className="topbar">
          <span className="dot" />
          <span className="brand">firebase-gateway</span>
        </div>
        <div className="empty">Checking session…</div>
      </div>
    );
  }

  // ---- Verifying admin allowlist ----
  if (checkingAuthz) {
    return (
      <div className="wrap">
        <div className="topbar">
          <span className="dot" />
          <span className="brand">firebase-gateway</span>
        </div>
        <div className="empty">Verifying access…</div>
      </div>
    );
  }

  // ---- Signed in but not on the allowlist ----
  if (!authorized) {
    return (
      <div className="wrap">
        <div className="topbar">
          <span className="dot" style={{ background: "var(--danger)", boxShadow: "0 0 8px var(--danger)" }} />
          <span className="brand">firebase-gateway</span>
        </div>
        <div className="card">
          <h3>Access denied</h3>
          <p style={{ fontSize: 14 }}>{forbidden || "This account isn't authorized to use this dashboard."}</p>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Signed in as <b>{user.email}</b>. Ask an existing admin to add this email under Users, or set it in <code>ADMIN_EMAILS</code> on the server.
          </p>
          <button className="btn ghost" onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    );
  }

  // ---- Authorized: full app shell ----
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="dot" />
          <span className="brand">firebase-gateway</span>
        </div>
        <nav className="nav-list">
          {visibleNavItems.map(({ key, label, href, Icon }) => (
            <Link key={key} href={href} className={`nav-item${active === key ? " active" : ""}`}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item nav-item-btn" onClick={handleLogout}>
            <LogoutIcon />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="app-topbar">
          <span className="page-title">{title || "Dashboard"}</span>
          <div className="profile-wrap" ref={menuRef}>
            <button className="profile-btn" onClick={() => setMenuOpen((v) => !v)}>
              {user.photoURL ? (
                <img className="avatar avatar-img" src={user.photoURL} alt={user.email} referrerPolicy="no-referrer" />
              ) : (
                <span className="avatar">{initialsOf(user.email)}</span>
              )}
            </button>
            {menuOpen && (
              <div className="profile-dropdown">
                <div className="email">{user.email}</div>
                <button onClick={handleLogout}>
                  <LogoutIcon /> <span style={{ marginLeft: 8 }}>Logout</span>
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {visibleNavItems.map(({ key, label, href, Icon }) => (
          <Link key={key} href={href} className={active === key ? "active" : ""}>
            <span className="icon"><Icon width={20} height={20} /></span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
