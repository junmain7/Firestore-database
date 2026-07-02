import { generateApiKey, sha256Hex } from "../../../lib/crypto";
import { verifyAdmin } from "../../../lib/adminAuth";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  setKeyEnabled,
} from "../../../lib/controlPlane";

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const isAdmin = auth.role === "admin";

  try {
    if (req.method === "GET") {
      // Only admins manage keys. Everyone else gets an empty list —
      // key creation/enable/disable is an admin-only control panel.
      if (!isAdmin) return res.status(200).json({ keys: [] });
      const keys = await listApiKeys();
      return res.status(200).json({ keys });
    }

    if (req.method === "POST") {
      if (!isAdmin) return res.status(403).json({ error: "Only admins can create API keys." });

      const { name, ownerEmail, permissions, rateLimitPerMinute } = req.body || {};

      const plainKey = generateApiKey();
      const keyHash = sha256Hex(plainKey);

      await createApiKey({
        keyHash,
        name,
        ownerEmail: ownerEmail || auth.email,
        permissions: permissions || {
          collections: ["*"],
          allowAuth: true,
          allowStorage: true,
        },
        rateLimitPerMinute,
      });

      // The plaintext key is only ever shown ONCE, right here.
      return res.status(201).json({ apiKey: plainKey, name });
    }

    if (req.method === "PATCH") {
      if (!isAdmin) return res.status(403).json({ error: "Only admins can enable/disable API keys." });

      const { keyHash, apiKey, enabled } = req.body || {};
      const hash = keyHash || (apiKey ? sha256Hex(apiKey) : null);
      if (!hash) return res.status(400).json({ error: "apiKey or keyHash required." });
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required." });

      await setKeyEnabled(hash, enabled);
      return res.status(200).json({ disabled: !enabled });
    }

    if (req.method === "DELETE") {
      if (!isAdmin) return res.status(403).json({ error: "Only admins can revoke API keys." });

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
}
