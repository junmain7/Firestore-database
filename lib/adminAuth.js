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

  const envAllowList = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let dbAllowList = [];
  try {
    const admins = await listAdminDocs();
    dbAllowList = admins.map((a) => (a.email || "").toLowerCase()).filter(Boolean);
  } catch (e) {
    // If the admins collection can't be read, fall back to the env allowlist only.
    dbAllowList = [];
  }

  if (envAllowList.length === 0 && dbAllowList.length === 0) {
    return { ok: false, status: 500, message: "ADMIN_EMAILS is not configured on the server." };
  }

  const email = decoded.email.toLowerCase();
  if (!envAllowList.includes(email) && !dbAllowList.includes(email)) {
    return { ok: false, status: 403, message: `${decoded.email} is not an authorized admin.` };
  }

  return { ok: true, email: decoded.email, uid: decoded.uid, envManaged: envAllowList.includes(email) };
}

module.exports = { verifyAdmin };
