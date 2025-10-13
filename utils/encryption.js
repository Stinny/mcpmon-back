import crypto from "crypto";

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-change-in-production-32b"; // Must be 32 bytes
const ALGORITHM = "aes-256-cbc";

// Ensure key is exactly 32 bytes
const getKey = () => {
  const key = Buffer.from(ENCRYPTION_KEY);
  if (key.length !== 32) {
    // Pad or truncate to 32 bytes
    const paddedKey = Buffer.alloc(32);
    key.copy(paddedKey);
    return paddedKey;
  }
  return key;
};

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted text in format: iv:encryptedData
 */
export function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Return IV and encrypted data separated by colon
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text in format: iv:encryptedData
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;

  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted) {
    throw new Error("Invalid encrypted text format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt auth configuration object
 * @param {string} authType - Type of authentication
 * @param {Object} authConfig - Authentication configuration
 * @returns {Object} - Encrypted auth configuration
 */
export function encryptAuthConfig(authType, authConfig) {
  if (!authConfig || authType === "none") {
    return null;
  }

  const encrypted = {};

  switch (authType) {
    case "api-key":
      encrypted.headerName = authConfig.headerName || "X-API-Key";
      encrypted.apiKey = encrypt(authConfig.apiKey);
      break;

    case "bearer-token":
      encrypted.token = encrypt(authConfig.token);
      break;

    case "custom-headers":
      encrypted.headers = {};
      if (authConfig.headers) {
        for (const [key, value] of Object.entries(authConfig.headers)) {
          encrypted.headers[key] = encrypt(value);
        }
      }
      break;

    default:
      return null;
  }

  return encrypted;
}

/**
 * Decrypt auth configuration object
 * @param {string} authType - Type of authentication
 * @param {Object} encryptedConfig - Encrypted authentication configuration
 * @returns {Object} - Decrypted auth configuration
 */
export function decryptAuthConfig(authType, encryptedConfig) {
  if (!encryptedConfig || authType === "none") {
    return null;
  }

  const decrypted = {};

  try {
    switch (authType) {
      case "api-key":
        decrypted.headerName = encryptedConfig.headerName || "X-API-Key";
        decrypted.apiKey = decrypt(encryptedConfig.apiKey);
        break;

      case "bearer-token":
        decrypted.token = decrypt(encryptedConfig.token);
        break;

      case "custom-headers":
        decrypted.headers = {};
        if (encryptedConfig.headers) {
          for (const [key, value] of Object.entries(encryptedConfig.headers)) {
            decrypted.headers[key] = decrypt(value);
          }
        }
        break;

      default:
        return null;
    }

    return decrypted;
  } catch (error) {
    console.error("Error decrypting auth config:", error.message);
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
