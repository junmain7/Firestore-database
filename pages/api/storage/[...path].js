const { authenticateRequest, setCors } = require("../../../lib/apiKeyAuth");
const { getStorageFor } = require("../../../lib/firebaseInstances");

// Usage from client:
//   POST   /api/storage/photos/me.jpg   body: { base64, contentType }  -> uploads, returns public signed URL
//   GET    /api/storage/photos/me.jpg                                  -> returns a fresh signed download URL
//   DELETE /api/storage/photos/me.jpg                                  -> deletes the file

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  if (!pathParts || !pathParts[0]) {
    return res.status(400).json({ error: "Missing file path." });
  }
  const filePath = pathParts.join("/");

  const auth = await authenticateRequest(req, { requireCapability: "allowStorage" });
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  try {
    const storage = await getStorageFor(auth.keyRecord.projectId);
    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    if (req.method === "POST") {
      const { base64, contentType } = req.body || {};
      if (!base64) {
        return res.status(400).json({ error: "Missing base64 file content." });
      }
      const buffer = Buffer.from(base64, "base64");
      await file.save(buffer, {
        contentType: contentType || "application/octet-stream",
        resumable: false,
      });
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
      });
      return res.status(200).json({ path: filePath, url });
    }

    if (req.method === "GET") {
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ error: "File not found." });
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      });
      return res.status(200).json({ path: filePath, url });
    }

    if (req.method === "DELETE") {
      await file.delete();
      return res.status(200).json({ deleted: true, path: filePath });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal error." });
  }
};
