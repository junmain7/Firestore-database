export default function Home() {
  return (
    <div className="wrap">
      <div className="topbar">
        <span className="dot" />
        <span className="brand">firebase-gateway</span>
      </div>

      <div className="card">
        <h3>Status</h3>
        <p style={{ margin: "0 0 4px", fontSize: 14 }}>Gateway is running.</p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          One API for every Firebase project you've registered — Firestore, Auth, and Storage.
        </p>
      </div>

      <a href="/dashboard" className="btn" style={{ display: "block", textAlign: "center", textDecoration: "none", boxSizing: "border-box" }}>
        Open dashboard →
      </a>
    </div>
  );
}
