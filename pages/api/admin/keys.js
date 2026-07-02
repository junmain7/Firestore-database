const { generateApiKey, sha256Hex } = require("../../../lib/crypto");
const { verifyAdmin } = require("../../../lib/adminAuth");
const {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} = require("../../../lib/controlPlane");

module.exports = async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    if (req.method === "GET") {
      const keys = await listApiKeys();
      return res.status(200).json({ keys });
    }

    if (req.method === "POST") {
      const { projectId, name, permissions, rateLimitPerMinute } = req.body || {};
      if (!projectId) return res.status(400).json({ error: "projectId required." });

      const plainKey = generateApiKey();
      const keyHash = sha256Hex(plainKey);

      await createApiKey({
        keyHash,
        projectId,
        name,
        permissions: permissions || {
          collections: ["*"],
          allowAuth: true,
          allowStorage: true,
        },
        rateLimitPerMinute,
      });

      // The plaintext key is only ever shown ONCE, right here.
      return res.status(201).json({ apiKey: plainKey, projectId, name });
    }

    if (req.method === "DELETE") {
      const { apiKey, keyHash } = req.body || {};
      const hash = keyHash || (apiKey ? sha256Hex(apiKey) : null);
      if (!hash) return res.status(400).json({ error: "apiKey or keyHash required." });
      await revokeApiKey(hash);
      return res.status(200).json({ revoked: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
