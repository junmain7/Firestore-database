const jwt = require("jsonwebtoken");
const { getAuthFor } = require("../../../../lib/firebaseInstances");

module.exports = async function handler(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).send(`Google auth error: ${error}`);
  }
  if (!code || !state) {
    return res.status(400).send("Missing code or state.");
  }

  let statePayload;
  try {
    statePayload = jwt.verify(state, process.env.OAUTH_STATE_SECRET);
  } catch (e) {
    return res.status(400).send("Invalid or expired state.");
  }
  const { redirect_uri, projectId } = statePayload;

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.id_token) {
      console.error("Token exchange failed:", tokenData);
      return res.status(400).send("Failed to exchange code for token.");
    }

    // Decode id_token payload (Google-signed, we trust it came straight from Google's token endpoint over HTTPS)
    const idTokenPayload = JSON.parse(
      Buffer.from(tokenData.id_token.split(".")[1], "base64").toString("utf8")
    );
    const { email, name, picture, sub: googleUid } = idTokenPayload;

    // Find or create the user in the TARGET Firebase project's Auth
    const targetAuth = await getAuthFor(projectId);
    let userRecord;
    try {
      userRecord = await targetAuth.getUserByEmail(email);
    } catch (e) {
      userRecord = await targetAuth.createUser({
        email,
        displayName: name,
        photoURL: picture,
        emailVerified: true,
      });
    }

    // Mint a Firebase custom token for that user in the target project
    const customToken = await targetAuth.createCustomToken(userRecord.uid, {
      provider: "google",
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("customToken", customToken);
    redirectUrl.searchParams.set("uid", userRecord.uid);
    redirectUrl.searchParams.set("email", email);

    return res.redirect(302, redirectUrl.toString());
  } catch (err) {
    console.error(err);
    return res.status(500).send("Auth broker error: " + err.message);
  }
};
