import { authenticateRequest, setCors } from "../../../lib/apiKeyAuth";
import { getProjectRaw } from "../../../lib/controlPlane";

// POST /api/auth/refresh   body: { refreshToken }
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const auth = await authenticateRequest(req, { requireCapability: "allowAuth" });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: "Missing refreshToken." });

  const project = await getProjectRaw(auth.keyRecord.projectId);
  if (!project?.webApiKey) {
    return res.status(400).json({ error: "This project has no webApiKey registered." });
  }

  try {
    const resp = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${project.webApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(400).json({ error: data.error?.message || "Refresh failed." });
    }
    return res.status(200).json({
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      uid: data.user_id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
