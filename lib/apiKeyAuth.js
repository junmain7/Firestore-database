const { sha256Hex } = require("./crypto");
const { getApiKey, getUserDoc, checkAndIncrementRateLimit } = require("./controlPlane");

/**
 * Pulls the target Firebase project id off the request. A key now has
 * access to every registered project, so each call has to say which one
 * it means — via the x-project-id header, a projectId query param, or a
 * projectId field in the JSON body.
 */
function resolveProjectId(req) {
  return (
    req.headers["x-project-id"] ||
    req.query.projectId ||
    (req.body && req.body.projectId) ||
    null
  );
}

/**
 * Validates the x-api-key header against the control plane.
 * Returns { ok: true, keyRecord, projectId } or { ok: false, status, message }.
 */
async function authenticateRequest(req, { requireCollection, requireCapability, requireProject = false } = {}) {
  const apiKey = req.headers["x-api-key"] || req.query.apiKey;
  if (!apiKey || typeof apiKey !== "string") {
    return { ok: false, status: 401, message: "Missing x-api-key header." };
  }

  const keyHash = sha256Hex(apiKey);
  const keyRecord = await getApiKey(keyHash);

  if (!keyRecord || keyRecord.revoked) {
    return { ok: false, status: 401, message: "Invalid or revoked API key." };
  }

  if (keyRecord.disabled) {
    return { ok: false, status: 403, message: "This API key is disabled." };
  }

  if (keyRecord.ownerEmail) {
    const ownerDoc = await getUserDoc(keyRecord.ownerEmail);
    if (ownerDoc?.disabled) {
      return { ok: false, status: 403, message: "Access disabled by admin." };
    }
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

  const projectId = resolveProjectId(req);
  if (requireProject && !projectId) {
    return {
      ok: false,
      status: 400,
      message:
        "Missing target project. Send it as an x-project-id header (or projectId query/body field) — one key now works across every registered Firebase project, so each request has to say which one it means.",
    };
  }

  return { ok: true, keyRecord, projectId };
}

function setCors(res) {
  // API-key based auth means we don't need to restrict by origin/domain.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
}

module.exports = { authenticateRequest, setCors };
