const { sha256Hex } = require("./crypto");
const { getApiKey, checkAndIncrementRateLimit } = require("./controlPlane");

/**
 * Validates the x-api-key header against the control plane.
 * Returns { ok: true, keyRecord } or { ok: false, status, message }.
 */
async function authenticateRequest(req, { requireCollection, requireCapability } = {}) {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  if (!apiKey || typeof apiKey !== "string") {
    return { ok: false, status: 401, message: "Missing x-api-key header." };
  }

  const keyHash = sha256Hex(apiKey);
  const keyRecord = await getApiKey(keyHash);

  if (!keyRecord || keyRecord.revoked) {
    return { ok: false, status: 401, message: "Invalid or revoked API key." };
  }

  const allowed = await checkAndIncrementRateLimit(
    keyHash,
    keyRecord.rateLimitPerMinute || 300
  );
  if (!allowed) {
    return { ok: false, status: 429, message: "Rate limit exceeded." };
  }

  const perms = keyRecord.permissions || {};

  if (requireCapability && perms[requireCapability] === false) {
    return {
      ok: false,
      status: 403,
      message: `This API key is not permitted to use: ${requireCapability}`,
    };
  }

  if (requireCollection) {
    const allowedCollections = perms.collections || ["*"];
    const isAllowed =
      allowedCollections.includes("*") ||
      allowedCollections.includes(requireCollection);
    if (!isAllowed) {
      return {
        ok: false,
        status: 403,
        message: `This API key cannot access collection: ${requireCollection}`,
      };
    }
  }

  return { ok: true, keyRecord };
}

function setCors(res) {
  // API-key based auth means we don't need to restrict by origin/domain.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
}

module.exports = { authenticateRequest, setCors };
