const crypto = require("crypto");

function getKey() {
  const raw = process.env.MASTER_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "MASTER_ENCRYPTION_KEY missing or too short. Generate with: openssl rand -hex 32"
    );
  }
  // Use first 32 bytes of the hex-decoded (or utf8) key for AES-256
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(plainText) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Store iv + authTag + ciphertext together, base64
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(payloadB64) {
  const key = getKey();
  const buf = Buffer.from(payloadB64, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generateApiKey() {
  // Format: fbgw_live_<40 hex chars>
  const random = crypto.randomBytes(24).toString("hex");
  return `fbgw_live_${random}`;
}

module.exports = { encrypt, decrypt, sha256Hex, generateApiKey };
