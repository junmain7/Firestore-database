const admin = require("firebase-admin");

let controlApp;

function getControlApp() {
  if (controlApp) return controlApp;

  const raw = process.env.CONTROL_FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("CONTROL_FIREBASE_SERVICE_ACCOUNT env var is missing.");
  }
  const serviceAccount = JSON.parse(raw);

  const existing = admin.apps.find((a) => a.name === "control-plane");
  if (existing) {
    controlApp = existing;
    return controlApp;
  }

  controlApp = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    },
    "control-plane"
  );
  return controlApp;
}

function controlDb() {
  return getControlApp().firestore();
}

// ---- Registered project (a Firebase project the gateway can reach) ----
const PROJECTS_COL = "_meta_projects";
const KEYS_COL = "_meta_apikeys";
const RATELIMIT_COL = "_meta_ratelimits";

async function createProject({ id, name, encryptedServiceAccount, webApiKey }) {
  const db = controlDb();
  await db.collection(PROJECTS_COL).doc(id).set({
    id,
    name,
    encryptedServiceAccount,
    webApiKey: webApiKey || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id, name };
}

async function listProjects() {
  const db = controlDb();
  const snap = await db.collection(PROJECTS_COL).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: data.id, name: data.name, createdAt: data.createdAt };
  });
}

async function getProjectRaw(id) {
  const db = controlDb();
  const doc = await db.collection(PROJECTS_COL).doc(id).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function deleteProject(id) {
  const db = controlDb();
  await db.collection(PROJECTS_COL).doc(id).delete();
}

// ---- API keys ----
async function createApiKey({
  keyHash,
  projectId,
  name,
  permissions,
  rateLimitPerMinute,
}) {
  const db = controlDb();
  await db.collection(KEYS_COL).doc(keyHash).set({
    keyHash,
    projectId,
    name: name || "unnamed key",
    permissions: permissions || { collections: ["*"], allowAuth: true, allowStorage: true },
    rateLimitPerMinute: rateLimitPerMinute || 300,
    revoked: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function getApiKey(keyHash) {
  const db = controlDb();
  const doc = await db.collection(KEYS_COL).doc(keyHash).get();
  if (!doc.exists) return null;
  return doc.data();
}

async function listApiKeys() {
  const db = controlDb();
  const snap = await db.collection(KEYS_COL).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      keyHash: data.keyHash,
      projectId: data.projectId,
      name: data.name,
      permissions: data.permissions,
      revoked: data.revoked,
      createdAt: data.createdAt,
    };
  });
}

async function revokeApiKey(keyHash) {
  const db = controlDb();
  await db.collection(KEYS_COL).doc(keyHash).update({ revoked: true });
}

// ---- Rate limiting (fixed 1-minute bucket counter) ----
async function checkAndIncrementRateLimit(keyHash, limitPerMinute) {
  const db = controlDb();
  const bucket = Math.floor(Date.now() / 60000); // current minute
  const docId = `${keyHash}_${bucket}`;
  const ref = db.collection(RATELIMIT_COL).doc(docId);

  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const current = doc.exists ? doc.data().count : 0;
    if (current >= limitPerMinute) {
      return false;
    }
    tx.set(
      ref,
      {
        count: current + 1,
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 120000),
      },
      { merge: true }
    );
    return true;
  });

  return result; // true = allowed, false = rate limited
}

module.exports = {
  admin,
  controlDb,
  createProject,
  listProjects,
  getProjectRaw,
  deleteProject,
  createApiKey,
  getApiKey,
  listApiKeys,
  revokeApiKey,
  checkAndIncrementRateLimit,
};
