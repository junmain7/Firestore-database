const { encrypt } = require("../../../lib/crypto");
const { verifyAdmin } = require("../../../lib/adminAuth");
const {
  createProject,
  listProjects,
  deleteProject,
} = require("../../../lib/controlPlane");

module.exports = async function handler(req, res) {
  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  try {
    if (req.method === "GET") {
      const projects = await listProjects();
      return res.status(200).json({ projects });
    }

    if (req.method === "POST") {
      const { name, serviceAccountJson, webApiKey } = req.body || {};
      if (!name || !serviceAccountJson) {
        return res.status(400).json({ error: "name and serviceAccountJson are required." });
      }
      let parsed;
      try {
        parsed = typeof serviceAccountJson === "string" ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      } catch (e) {
        return res.status(400).json({ error: "serviceAccountJson is not valid JSON." });
      }
      const id = parsed.project_id;
      if (!id) return res.status(400).json({ error: "Service account JSON missing project_id." });

      const encrypted = encrypt(JSON.stringify(parsed));
      const result = await createProject({ id, name, encryptedServiceAccount: encrypted, webApiKey });
      return res.status(201).json(result);
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "id required." });
      await deleteProject(id);
      return res.status(200).json({ deleted: true, id });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
