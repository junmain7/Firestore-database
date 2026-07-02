import jwt from "jsonwebtoken";
import { authenticateRequest } from "../../../../lib/apiKeyAuth";

// Client apps redirect their user's browser to:
//   /api/auth/google/start?apiKey=fbgw_live_xxx&projectId=your-project-id&redirect_uri=https://their-app.com/auth/done
//
// projectId is required now: one API key can reach every registered
// Firebase project, so the client has to say which project's Auth the
// signed-in user should land in.
//
// This is the ONLY place a Google "Authorized redirect URI" is needed,
// and it points at THIS gateway, not at the client app. So client apps
// never need to be added to Google Cloud Console.

export default async function handler(req, res) {
  const { apiKey, redirect_uri, projectId } = req.query;
  if (!apiKey || !redirect_uri) {
    return res.status(400).send("Missing apiKey or redirect_uri query params.");
  }
  if (!projectId) {
    return res.status(400).send("Missing projectId query param — say which registered Firebase project this login is for.");
  }

  // Validate key (rate-limited too) before starting the OAuth dance.
  const fakeReq = { headers: { "x-api-key": apiKey }, query: {} };
  const auth = await authenticateRequest(fakeReq, { requireCapability: "allowAuth" });
  if (!auth.ok) {
    return res.status(auth.status).send(auth.message);
  }

  const state = jwt.sign(
    { apiKey, redirect_uri, projectId },
    process.env.OAUTH_STATE_SECRET,
    { expiresIn: "10m" }
  );

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  res.redirect(302, googleUrl.toString());
}
