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
  const scopeToSelf = !isAdmin; // "user" role: only ever sees/manages their own keys

  try {
    if (req.method === "GET") {
      const keys = await listApiKeys(scopeToSelf ? auth.email : undefined);
      return res.status(200).json({ keys });
    }

    if (req.method === "POST") {
      if (scopeToSelf && !auth.keyAccess) {
        return res.status(403).json({ error: "Ask an admin to grant key access first (Users tab)." });
      }

      const { name, ownerEmail, permissions, rateLimitPerMinute } = req.body || {};

      // A "user" can only ever create a key for themselves — admins can
      // assign to anyone (e.g. an external customer without a login).
      const finalOwner = scopeToSelf ? auth.email : ownerEmail || auth.email;

      const plainKey = generateApiKey();
      const keyHash = sha256Hex(plainKey);

      await createApiKey({
        keyHash,
        name,
        ownerEmail: finalOwner,
        permissions: permissions || {
          collections: ["*"],
          allowAuth: true,
          allowStorage: true,
        },
        rateLimitPerMinute,
      });

      return res.status(201).json({ apiKey: plainKey, name });
    }

    if (req.method === "PATCH") {
      const { keyHash, apiKey, enabled } = req.body || {};
      const hash = keyHash || (apiKey ? sha256Hex(apiKey) : null);
      if (!hash) return res.status(400).json({ error: "apiKey or keyHash required." });
      if (typeof enabled !== "boolean") return res.status(400).json({ error: "enabled (boolean) required." });

      if (scopeToSelf) {
        const existing = await listApiKeys(auth.email);
        const owns = existing.some((k) => k.keyHash === hash);
        if (!owns) return res.status(403).json({ error: "You can only manage your own API keys." });
      }

      await setKeyEnabled(hash, enabled);
      return res.status(200).json({ disabled: !enabled });
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
