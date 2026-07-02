import { verifyAdmin } from "../../../lib/adminAuth";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed." });

  const auth = await verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  return res.status(200).json({ email: auth.email, uid: auth.uid, envManaged: auth.envManaged, role: auth.role });
}
