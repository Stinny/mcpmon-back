import crypto from "crypto";

// Algorithm configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment variable
const getKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. Generate one using: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
    );
  }

  // Convert base64 key to buffer
  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes when base64 decoded`);
  }

  return keyBuffer;
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:tag:encryptedData (hex)
 */
export function encrypt(text) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Return IV, tag, and encrypted data separated by colons
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  } catch (error) {
    console.error("Encryption error:", error.message);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data using AES-256-GCM
 * @param {string} encryptedText - Encrypted text in format: iv:tag:encryptedData
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;

  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format");
    }

    const [ivHex, tagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error.message);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypt auth token
 * @param {string} authType - Type of authentication (none, bearer, apikey)
 * @param {string} token - Authentication token
 * @returns {string} - Encrypted token
 */
export function encryptAuthToken(authType, token) {
  if (!token || authType === "none") {
    return null;
  }
  return encrypt(token);
}

/**
 * Decrypt auth token
 * @param {string} authType - Type of authentication (none, bearer, apikey)
 * @param {string} encryptedToken - Encrypted token
 * @returns {string} - Decrypted token
 */
export function decryptAuthToken(authType, encryptedToken) {
  if (!encryptedToken || authType === "none") {
    return null;
  }
  try {
    return decrypt(encryptedToken);
  } catch (error) {
    console.error("Error decrypting auth token:", error.message);
    return null;
  }
}

/**
 * Mask sensitive value for display (show only last 4 characters)
 * @param {string} value - Sensitive value to mask
 * @returns {string} - Masked value
 */
export function maskValue(value) {
  if (!value || value.length <= 4) {
    return "****";
  }
  return "*".repeat(value.length - 4) + value.slice(-4);
}
