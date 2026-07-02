const { admin, getProjectRaw } = require("./controlPlane");
const { decrypt } = require("./crypto");

// In-memory cache (persists across warm Vercel lambda invocations)
const instanceCache = new Map();

async function getTargetApp(projectId) {
  if (instanceCache.has(projectId)) {
    return instanceCache.get(projectId);
  }

  const projectDoc = await getProjectRaw(projectId);
  if (!projectDoc) {
    throw new Error(`Unknown project: ${projectId}`);
  }

  const serviceAccountJson = decrypt(projectDoc.encryptedServiceAccount);
  const serviceAccount = JSON.parse(serviceAccountJson);

  const appName = `target-${projectId}`;
  const existing = admin.apps.find((a) => a.name === appName);
  const app =
    existing ||
    admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        storageBucket: `${serviceAccount.project_id}.appspot.com`,
      },
      appName
    );

  instanceCache.set(projectId, app);
  return app;
}

async function getFirestoreFor(projectId) {
  const app = await getTargetApp(projectId);
  return app.firestore();
}

async function getAuthFor(projectId) {
  const app = await getTargetApp(projectId);
  return app.auth();
}

async function getStorageFor(projectId) {
  const app = await getTargetApp(projectId);
  return app.storage();
}

module.exports = { getTargetApp, getFirestoreFor, getAuthFor, getStorageFor };
