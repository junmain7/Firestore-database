const { getControlApp, listAdminDocs } = require("./controlPlane");

/**
 * Verifies the Firebase idToken sent by the dashboard (Authorization: Bearer <idToken>),
 * checks the signed-in email against the ADMIN_EMAILS allowlist.
 * This is real Firebase Authentication, not a shared secret string.
 */
async function verifyAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return { ok: false, status: 401, message: "Missing sign-in token." };
  }

  let decoded;
  try {
    decoded = await getControlApp().auth().verifyIdToken(idToken, true); // checkRevoked = true
  } catch (e) {
    return { ok: false, status: 401, message: "Session expired or invalid. Please sign in again." };
  }

  if (!decoded.email || !decoded.email_verified) {
    return { ok: false, status: 403, message: "Email not verified." };
  }

  const rawEnv = process.env.ADMIN_EMAILS || "";
  const envAllowList = rawEnv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let dbAdmins = [];
  let dbAllowList = [];
  let dbError = null;
  try {
    dbAdmins = await listAdminDocs();
    dbAllowList = dbAdmins.map((a) => (a.email || "").toLowerCase()).filter(Boolean);
  } catch (e) {
    // If the admins collection can't be read, fall back to the env allowlist only.
    dbAdmins = [];
    dbAllowList = [];
    dbError = e.message;
  }

  if (envAllowList.length === 0 && dbAllowList.length === 0) {
    return { ok: false, status: 500, message: "ADMIN_EMAILS is not configured on the server." };
  }

  const email = decoded.email.toLowerCase();
  if (!envAllowList.includes(email) && !dbAllowList.includes(email)) {
    // ---- TEMP DEBUG ---- remove this block once login works ----
    const debug = {
      signedInEmail: email,
      signedInEmailLength: email.length,
      signedInEmailCharCodes: Array.from(email).map((c) => c.charCodeAt(0)),
      rawAdminEmailsEnv: rawEnv,
      rawAdminEmailsEnvLength: rawEnv.length,
      parsedEnvAllowList: envAllowList,
      parsedEnvAllowListCharCodes: envAllowList.map((e) => Array.from(e).map((c) => c.charCodeAt(0))),
      dbAllowList,
      dbError,
    };
    return {
      ok: false,
      status: 403,
      message: `${decoded.email} is not an authorized admin. DEBUG: ${JSON.stringify(debug)}`,
    };
    // ---- END TEMP DEBUG ----
  }

  // Role resolution: env-managed emails (ADMIN_EMAILS) are always full admins.
  // Everyone else's role comes from their _meta_admins doc; missing role
  // (older invites, before roles existed) defaults to "admin" so nobody who
  // already had access silently loses it.
  let role = "admin";
  if (!envAllowList.includes(email)) {
    const dbEntry = dbAdmins.find((a) => (a.email || "").toLowerCase() === email);
    role = dbEntry?.role === "user" ? "user" : "admin";
  }

  return { ok: true, email: decoded.email, uid: decoded.uid, envManaged: envAllowList.includes(email), role };
}

module.exports = { verifyAdmin };
