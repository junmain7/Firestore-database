const { authenticateRequest, setCors } = require("../../../lib/apiKeyAuth");
const { getFirestoreFor } = require("../../../lib/firebaseInstances");

// Usage from client:
//   GET    /api/db/users                -> list collection (supports ?where=, ?orderBy=, ?limit=)
//   GET    /api/db/users/abc123         -> get single doc
//   POST   /api/db/users                -> add doc (auto id) or /api/db/users/abc123 to set with id
//   PUT    /api/db/users/abc123         -> update (merge) doc
//   DELETE /api/db/users/abc123         -> delete doc

function getCollectionRoot(pathParts) {
  return pathParts[0];
}

function buildDocRef(db, pathParts) {
  // pathParts like ['users','abc123'] or ['users','abc123','orders','xyz']
  let ref = db.collection(pathParts[0]);
  for (let i = 1; i < pathParts.length; i += 2) {
    if (i + 1 < pathParts.length) {
      ref = ref.doc(pathParts[i]).collection(pathParts[i + 1]);
    } else {
      ref = ref.doc(pathParts[i]);
    }
  }
  return ref;
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path];
  if (!pathParts || !pathParts[0]) {
    return res.status(400).json({ error: "Missing collection path." });
  }
  const rootCollection = getCollectionRoot(pathParts);

  const auth = await authenticateRequest(req, { requireCollection: rootCollection });
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  try {
    const db = await getFirestoreFor(auth.keyRecord.projectId);
    const isEvenDepth = pathParts.length % 2 === 0; // even length = points to a document

    if (req.method === "GET") {
      if (isEvenDepth) {
        const docRef = buildDocRef(db, pathParts);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: "Not found." });
        return res.status(200).json({ id: doc.id, data: doc.data() });
      } else {
        let ref = buildDocRef(db, pathParts);

        if (req.query.where) {
          // ?where=field,op,value  (repeatable via where=a,b,c&where=d,e,f is not native in query parsing,
          // so we accept a JSON array via ?whereJson=[["field","==","value"]])
        }
        if (req.query.whereJson) {
          const clauses = JSON.parse(req.query.whereJson);
          for (const [field, op, value] of clauses) {
            ref = ref.where(field, op, value);
          }
        }
        if (req.query.orderBy) {
          const dir = req.query.orderDir === "desc" ? "desc" : "asc";
          ref = ref.orderBy(req.query.orderBy, dir);
        }
        if (req.query.limit) {
          ref = ref.limit(parseInt(req.query.limit, 10));
        }

        const snap = await ref.get();
        const results = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        return res.status(200).json({ results, count: results.length });
      }
    }

    if (req.method === "POST") {
      const body = req.body || {};
      if (isEvenDepth) {
        // explicit id given -> set()
        const docRef = buildDocRef(db, pathParts);
        await docRef.set(body);
        return res.status(200).json({ id: docRef.id, data: body });
      } else {
        const colRef = buildDocRef(db, pathParts);
        const docRef = await colRef.add(body);
        return res.status(201).json({ id: docRef.id, data: body });
      }
    }

    if (req.method === "PUT" || req.method === "PATCH") {
      if (!isEvenDepth) {
        return res.status(400).json({ error: "PUT requires a document path." });
      }
      const docRef = buildDocRef(db, pathParts);
      await docRef.set(req.body || {}, { merge: true });
      return res.status(200).json({ id: docRef.id, data: req.body });
    }

    if (req.method === "DELETE") {
      if (!isEvenDepth) {
        return res.status(400).json({ error: "DELETE requires a document path." });
      }
      const docRef = buildDocRef(db, pathParts);
      await docRef.delete();
      return res.status(200).json({ deleted: true, id: docRef.id });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Internal error." });
  }
};
