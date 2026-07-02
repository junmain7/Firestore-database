import { generateApiKey, sha256Hex } from "../../../lib/crypto";
import { verifyAdmin } from "../../../lib/adminAuth";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../../../lib/controlPlane";

export default async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    // Admins can see every key (for oversight); a "user" only ever sees
    // and manages the keys they personally created — each person's keys
    // are their own, separate from everyone else's.
    const scopeToSelf = auth.role !== "admin";

    if (req.method === "GET") {
      const keys = await listApiKeys(scopeToSelf ? auth.email : undefined);
      return res.status(200).json({ keys });
    }

    if (req.method === "POST") {
      const { name, permissions, rateLimitPerMinute } = req.body || {};

      const plainKey = generateApiKey();
      const keyHash = sha256Hex(plainKey);

      await createApiKey({
        keyHash,
        name,
        ownerEmail: auth.email,
        permissions: permissions || {
          collections: ["*"],
          allowAuth: true,
          allowStorage: true,
        },
        rateLimitPerMinute,
      });

      // The plaintext key is only ever shown ONCE, right here.
      // It works across every registered Firebase project — no project
      // selection needed at creation time.
      return res.status(201).json({ apiKey: plainKey, name });
    }

    if (req.method === "DELETE") {
      const { apiKey, keyHash } = req.body || {};
      const hash = keyHash || (apiKey ? sha256Hex(apiKey) : null);
      if (!hash) return res.status(400).json({ error: "apiKey or keyHash required." });

      if (scopeToSelf) {
        const existing = await listApiKeys(auth.email);
        const owns = existing.some((k) => k.keyHash === hash);
        if (!owns) return res.status(403).json({ error: "You can only revoke your own API keys." });
      }

      await revokeApiKey(hash);
      return res.status(200).json({ revoked: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
