import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM

/**
 * Derives a 32-byte (256-bit) Buffer key from an arbitrary secret string.
 */
function deriveKey(secret?: string): Buffer {
  const masterSecret = secret || process.env.APP_SECRET || "aiva_default_local_master_secret_2026";
  return crypto.createHash("sha256").update(masterSecret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: "iv_hex:auth_tag_hex:encrypted_hex"
 */
export function encryptSecret(plainText: string, secret?: string): string {
  if (!plainText) return "";
  
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a cipher string formatted as "iv_hex:auth_tag_hex:encrypted_hex".
 */
export function decryptSecret(cipherText: string, secret?: string): string {
  if (!cipherText) return "";
  
  // If plain unencrypted value is passed or format doesn't match expected pattern
  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    // If string does not match AES-GCM output pattern, log warning and return raw value
    console.warn(`[Crypto] Value does not match encrypted format (iv:tag:ct). Returning as plaintext fallback.`);
    return cipherText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  try {
    const key = deriveKey(secret);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error(`[Crypto] Failed to decrypt secret payload: ${(error as Error).message}`);
    throw new Error(`Failed to decrypt secret payload: ${(error as Error).message}`);
  }
}
