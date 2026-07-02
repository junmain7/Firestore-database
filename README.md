# 🔥 Firebase Gateway

Apna khud ka backend-as-a-service — ek hi API se apne saare Firebase projects (Firestore + Auth + Storage) use karo, kahin se bhi, bina har app mein alag Firebase config ya domain verification ke.

## Kaise kaam karta hai (short version)

- Ek **control-plane Firebase project** banega (sirf metadata ke liye — kaunse projects register hain, API keys, rate limits).
- Har real project (Joysiddhi, Mahadev Kirtan, Rang Tarang app, etc.) ka **service account JSON** encrypt karke control-plane mein store hota hai.
- Har client app ko ek **API key** milta hai jo ek specific project se linked hota hai.
- Client app is gateway ke REST endpoints ko call karta hai (`/api/db/...`, `/api/storage/...`, `/api/auth/...`) — seedha Firebase se baat nahi karta.
- Google login ek **central OAuth broker** se hota hai, isliye sirf **is gateway ka domain** Google Console mein verify karna padega — ek baar, hamesha ke liye. Naye client apps ko kabhi verify nahi karna.

## Setup steps

### 1. Control-plane Firebase project banao
- Firebase Console → New Project → naam kuch bhi (e.g. `my-gateway-control`)
- Firestore enable karo (Native mode)
- Project Settings → Service Accounts → Generate new private key → JSON download hoga

### 2. GitHub pe push karo
Is folder ko apne `Zip-unzipper-and-Pusher` app se GitHub repo mein push kar do.

### 3. Vercel pe deploy karo
- Vercel dashboard → New Project → GitHub repo import karo
- Environment variables set karo (Vercel → Settings → Environment Variables):

| Variable | Value |
|---|---|
| `CONTROL_FIREBASE_SERVICE_ACCOUNT` | control-plane wali service account JSON, **poori ek line mein** |
| `MASTER_ENCRYPTION_KEY` | `openssl rand -hex 32` se generate karo (ya kisi bhi random 32+ char string) |
| `ADMIN_SECRET` | `openssl rand -hex 24` se generate karo — ye dashboard login password hai |
| `OAUTH_STATE_SECRET` | koi bhi random 32+ char string |
| `GOOGLE_CLIENT_ID` | step 4 dekho |
| `GOOGLE_CLIENT_SECRET` | step 4 dekho |
| `GOOGLE_REDIRECT_URI` | `https://<tera-vercel-domain>.vercel.app/api/auth/google/callback` |

Openssl mobile pe nahi hai to koi bhi random string generator use kar sakta hai (kam se kam 32 characters, letters+numbers).

### 4. Google OAuth client banao (Google login ke liye — sirf ek baar)
- [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
- Create Credentials → OAuth Client ID → Web application
- Authorized redirect URI: `https://<tera-vercel-domain>.vercel.app/api/auth/google/callback`
- Client ID + Secret copy karke Vercel env vars mein daalo
- **Bas. Isके baad koi bhi naya app add karne pe Google Console mein kuch bhi verify nahi karna.**

### 5. Deploy ho jaye to dashboard kholo
`https://<tera-vercel-domain>.vercel.app/dashboard` → admin secret daal ke unlock karo.

### 6. Har real project register karo
Dashboard mein "Register a Firebase project" — us project ki service account JSON paste karo (Firebase Console → Project Settings → Service Accounts → Generate new key).

Agar Google login bhi chahiye us project ke liye, to **Web API key** bhi daalo (Firebase Console → Project Settings → General → Web API Key — ye public info hai, safe hai).

### 7. API key generate karo har app ke liye
Dashboard mein project select karo, key ka naam do (e.g. "Rang Tarang App"), generate karo. **Key sirf ek baar dikhega — turant copy kar lo.**

## Client app mein use kaise karega

`sdk/client.js` file apne kisi bhi app mein copy kar do:

```js
import { GatewayClient } from "./sdk/client";

const gw = new GatewayClient({
  baseUrl: "https://your-gateway.vercel.app",
  apiKey: "fbgw_live_xxx", // dashboard se mila hua
});

// Firestore jaisa hi feel
const { results } = await gw.collection("members").get();
const { id } = await gw.collection("members").add({ name: "Ishwar" });
await gw.doc("members/abc123").set({ status: "active" }); // merge update
const { data } = await gw.doc("members/abc123").get();
await gw.doc("members/abc123").delete();

// Query karna
const active = await gw
  .collection("members")
  .where("status", "==", "active")
  .orderBy("createdAt", "desc")
  .limit(20)
  .get();

// Google login — user ko redirect karo
gw.signInWithGoogleRedirect("https://your-app.com/auth/done");

// /auth/done page pe, URL se customToken nikal ke:
const session = await gw.exchangeCustomToken(customTokenFromUrl);
// session.idToken, session.refreshToken, session.uid ab tere paas hai

// File upload
const { url } = await gw.upload("photos/me.jpg", base64String, "image/jpeg");
```

## Security notes (zaroor padho)

- **API keys** SHA-256 hash karke store hote hain — plaintext kabhi database mein nahi jaata.
- **Service account JSONs** AES-256-GCM se encrypt hoke store hote hain, `MASTER_ENCRYPTION_KEY` se.
- Har API key ek specific project se locked hota hai — ek key doosre project ka data access nahi kar sakti.
- Rate limiting per-key hai (default 300 req/min, dashboard se change kar sakta hai `/api/admin/keys` endpoint se `rateLimitPerMinute` bhejke).
- `ADMIN_SECRET` kisi ke saath share mat karna — isse koi bhi naya project register kar sakta hai aur keys bana sakta hai.
- Firestore security rules Admin SDK ke through **bypass** ho jaate hain — matlab ab saari permission checking is gateway ke API key permissions system pe depend karti hai. Isliye per-key `collections` permission zaroor set karo agar sensitive data hai.
- Rate-limit counter documents (`_meta_ratelimits` collection) purane hote rehte hain — Firestore Console mein TTL policy laga do us collection pe field `expiresAt` pe, taaki auto-cleanup ho jaye.

## Folder structure

```
lib/               → core logic (crypto, control plane, api key auth, firebase instances)
pages/api/db/      → Firestore CRUD proxy
pages/api/storage/ → file upload/download/delete proxy
pages/api/auth/    → Google OAuth broker + token exchange/refresh
pages/api/admin/   → project & key management (admin-secret protected)
pages/dashboard/   → mobile-friendly admin UI
sdk/client.js      → drop-in client library for your other apps
```
