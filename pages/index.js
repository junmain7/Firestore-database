import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "../lib/useAuth";

export default function Home() {
  const router = useRouter();
  const { user, authLoading, checkingAuthz, authorized } = useAuth();

  useEffect(() => {
    if (authLoading) return; // still resolving firebase session
    if (!user) {
      router.replace("/login");
      return;
    }
    if (checkingAuthz) return; // still verifying admin allowlist
    router.replace(authorized ? "/dashboard" : "/login");
  }, [authLoading, user, checkingAuthz, authorized, router]);

  return (
    <div className="wrap">
      <div className="topbar">
        <span className="dot" />
        <span className="brand">firebase-gateway</span>
      </div>
      <div className="empty">Loading…</div>
    </div>
  );
}
