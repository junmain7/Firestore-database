/**
 * Firebase Gateway client SDK.
 * Drop this file into any app (React, plain JS, React Native, etc).
 * No Firebase SDK, no domain whitelisting needed.
 *
 * Usage:
 *   const gw = new GatewayClient({
 *     baseUrl: "https://your-gateway.vercel.app",
 *     apiKey: "fbgw_live_xxx",
 *     projectId: "your-registered-project-id", // which Firebase project this app talks to
 *   });
 *
 *   const { results } = await gw.collection("users").get();
 *   const { id } = await gw.collection("users").add({ name: "Ishwar" });
 *   await gw.doc("users/abc123").set({ name: "Updated" }); // merge
 *   const { data } = await gw.doc("users/abc123").get();
 *   await gw.doc("users/abc123").delete();
 *
 *   // Google login (redirect flow)
 *   gw.signInWithGoogleRedirect("https://your-app.com/auth/done");
 *   // on the /auth/done page, read ?customToken= from the URL, then:
 *   const session = await gw.exchangeCustomToken(customTokenFromUrl);
 *   // session.idToken / session.refreshToken / session.uid
 *
 *   // Storage
 *   const { url } = await gw.upload("photos/me.jpg", base64String, "image/jpeg");
 */

class QueryRef {
  constructor(client, path) {
    this.client = client;
    this.path = path;
    this.params = new URLSearchParams();
  }

  where(field, op, value) {
    const existing = this.params.get("whereJson");
    const clauses = existing ? JSON.parse(existing) : [];
    clauses.push([field, op, value]);
    this.params.set("whereJson", JSON.stringify(clauses));
    return this;
  }

  orderBy(field, dir = "asc") {
    this.params.set("orderBy", field);
    this.params.set("orderDir", dir);
    return this;
  }

  limit(n) {
    this.params.set("limit", String(n));
    return this;
  }

  async get() {
    const qs = this.params.toString();
    return this.client._request("GET", `db/${this.path}${qs ? `?${qs}` : ""}`);
  }

  async add(data) {
    return this.client._request("POST", `db/${this.path}`, data);
  }
}

class DocRef {
  constructor(client, path) {
    this.client = client;
    this.path = path;
  }
  get() {
    return this.client._request("GET", `db/${this.path}`);
  }
  set(data) {
    return this.client._request("PUT", `db/${this.path}`, data);
  }
  create(data) {
    return this.client._request("POST", `db/${this.path}`, data);
  }
  delete() {
    return this.client._request("DELETE", `db/${this.path}`);
  }
}

class GatewayClient {
  constructor({ baseUrl, apiKey, projectId }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.projectId = projectId;
  }

  async _request(method, path, body) {
    const res = await fetch(`${this.baseUrl}/api/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "x-project-id": this.projectId,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  collection(path) {
    return new QueryRef(this, path);
  }

  doc(path) {
    return new DocRef(this, path);
  }

  // ---- Auth ----
  signInWithGoogleRedirect(redirectUri) {
    const url = new URL(`${this.baseUrl}/api/auth/google/start`);
    url.searchParams.set("apiKey", this.apiKey);
    url.searchParams.set("projectId", this.projectId);
    url.searchParams.set("redirect_uri", redirectUri);
    if (typeof window !== "undefined") window.location.href = url.toString();
    return url.toString();
  }

  exchangeCustomToken(customToken) {
    return this._request("POST", "auth/exchange", { customToken });
  }

  refreshSession(refreshToken) {
    return this._request("POST", "auth/refresh", { refreshToken });
  }

  // ---- Storage ----
  upload(path, base64, contentType) {
    return this._request("POST", `storage/${path}`, { base64, contentType });
  }
  getFileUrl(path) {
    return this._request("GET", `storage/${path}`);
  }
  deleteFile(path) {
    return this._request("DELETE", `storage/${path}`);
  }
}

module.exports = { GatewayClient };
