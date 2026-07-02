import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getClientAuth, googleProvider } from "./firebaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true); // firebase auth state resolving
  const [checkingAuthz, setCheckingAuthz] = useState(false); // verifying against admin allowlist
  const [authorized, setAuthorized] = useState(false);
  const [forbidden, setForbidden] = useState("");
  const [envManaged, setEnvManaged] = useState(false);

  const authedFetch = useCallback(async (path, opts = {}) => {
    const auth = getClientAuth();
    if (!auth.currentUser) throw new Error("Not signed in.");
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(path, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) setForbidden(data.error);
      throw new Error(data.error || "Request failed");
    }
    return data;
  }, []);

  const checkAuthorization = useCallback(async () => {
    setCheckingAuthz(true);
    setForbidden("");
    try {
      const me = await authedFetch("/api/admin/me");
      setAuthorized(true);
      setEnvManaged(!!me.envManaged);
    } catch (e) {
      setAuthorized(false);
    }
    setCheckingAuthz(false);
  }, [authedFetch]);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      setAuthorized(false);
      setForbidden("");
      if (u) checkAuthorization();
    });
    return unsub;
  }, [checkAuthorization]);

  async function loginWithGoogle() {
    setForbidden("");
    await signInWithPopup(getClientAuth(), googleProvider);
  }

  async function logout() {
    await signOut(getClientAuth());
    setAuthorized(false);
    setForbidden("");
  }

  const value = {
    user,
    authLoading,
    checkingAuthz,
    authorized,
    forbidden,
    envManaged,
    loginWithGoogle,
    logout,
    authedFetch,
    refreshAuthorization: checkAuthorization,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
