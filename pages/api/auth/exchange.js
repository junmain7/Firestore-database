const { authenticateRequest, setCors } = require("../../../lib/apiKeyAuth");
const { getProjectRaw } = require("../../../lib/controlPlane");

// POST /api/auth/exchange   body: { customToken }
// header: x-api-key
// Returns: { idToken, refreshToken, expiresIn, uid }
//
// Client apps use this instead of the Firebase Web SDK's
// signInWithCustomToken — plain REST, no SDK, no domain restrictions.

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const auth = await authenticateRequest(req, { requireCapability: "allowAuth" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const { customToken } = req.body || {};
  if (!customToken) return res.status(400).json({ error: "Missing customToken." });

  const project = await getProjectRaw(auth.keyRecord.projectId);
  if (!project?.webApiKey) {
    return res.status(400).json({
      error:
        "This project has no webApiKey registered. Add it via the dashboard to enable token exchange.",
    });
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${project.webApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(400).json({ error: data.error?.message || "Exchange failed." });
    }
    return res.status(200).json({
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      uid: data.localId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
