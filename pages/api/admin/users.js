import { verifyAdmin } from "../../../lib/adminAuth";
import { listAdminDocs, addAdminDoc, removeAdminDoc, setUserKeyAccess, setUserDisabled } from "../../../lib/controlPlane";

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  if (auth.role !== "admin") {
    return res.status(403).json({ error: "Only admins can view or manage dashboard members." });
  }

  try {
    const envAllowList = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (req.method === "GET") {
      const dbAdmins = await listAdminDocs();
      const envUsers = envAllowList.map((email) => ({ email, source: "env", role: "admin", keyAccess: true, disabled: false }));
      const dbUsers = dbAdmins
        .filter((a) => !envAllowList.includes((a.email || "").toLowerCase()))
        .map((a) => ({
          email: a.email,
          source: "firestore",
          role: a.role === "user" ? "user" : "admin",
          keyAccess: a.role === "user" ? !!a.keyAccess : true,
          disabled: !!a.disabled,
          addedBy: a.addedBy || null,
          createdAt: a.createdAt || null,
        }));
      return res.status(200).json({ users: [...envUsers, ...dbUsers] });
    }

    if (req.method === "POST") {
      const { email, role } = req.body || {};
      if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });
      const normalized = email.trim().toLowerCase();
      const normalizedRole = role === "admin" ? "admin" : "user";
      if (envAllowList.includes(normalized)) {
        return res.status(400).json({ error: "This email is already an admin (set via ADMIN_EMAILS)." });
      }
      const result = await addAdminDoc({ email: normalized, addedBy: auth.email, role: normalizedRole });
      return res.status(201).json(result);
    }

    if (req.method === "PATCH") {
      const { email, keyAccess, disabled } = req.body || {};
      if (!email) return res.status(400).json({ error: "email required." });
      const normalized = email.trim().toLowerCase();
      if (envAllowList.includes(normalized)) {
        return res.status(400).json({ error: "This admin is managed via ADMIN_EMAILS and can't be toggled here." });
      }
      if (typeof keyAccess === "boolean") await setUserKeyAccess(normalized, keyAccess);
      if (typeof disabled === "boolean") await setUserDisabled(normalized, disabled);
      return res.status(200).json({ email: normalized, keyAccess, disabled });
    }

    if (req.method === "DELETE") {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "email required." });
      const normalized = email.trim().toLowerCase();
      if (envAllowList.includes(normalized)) {
        return res.status(400).json({ error: "This admin is managed via ADMIN_EMAILS on the server and can't be removed here." });
      }
      if (normalized === auth.email.toLowerCase()) {
        return res.status(400).json({ error: "You can't remove yourself." });
      }
      await removeAdminDoc(normalized);
      return res.status(200).json({ removed: true, email: normalized });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
