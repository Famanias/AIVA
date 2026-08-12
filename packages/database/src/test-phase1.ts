import assert from "assert";
import { encryptSecret, decryptSecret } from "./crypto";
import { getDatabaseConnectionString } from "./local-db";

console.log("Running Phase 1 Database & Crypto Unit Tests...");

// Test 1: AES-256-GCM Crypto Encryption & Decryption
const testApiKey = "sk-proj-test-api-key-123456789";
const masterSecret = "test_custom_app_secret_key_32_bytes!!";

const encrypted = encryptSecret(testApiKey, masterSecret);
console.log("✓ Encrypted format test:", encrypted);
assert.notStrictEqual(encrypted, testApiKey);
assert.strictEqual(encrypted.split(":").length, 3, "Encrypted payload must contain iv:authTag:cipher text");

const decrypted = decryptSecret(encrypted, masterSecret);
assert.strictEqual(decrypted, testApiKey, "Decrypted payload must match original API key");
console.log("✓ Crypto roundtrip test passed!");

// Test 2: Connection String Resolution
process.env.POSTGRES_HOST = "localhost";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_DB = "aiva";
process.env.POSTGRES_USER = "postgres";
process.env.POSTGRES_PASSWORD = "postgres";

const connStr = getDatabaseConnectionString();
assert.strictEqual(connStr, "postgresql://postgres:postgres@localhost:5432/aiva");
console.log("✓ Connection string builder test passed!");

console.log("✅ Phase 1 Database & Crypto Unit Tests Completed Successfully!");
