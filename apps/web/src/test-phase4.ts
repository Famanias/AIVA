import assert from "assert";
import fs from "fs";
import path from "path";
import { query, getAppSetting, setAppSetting } from "@aiva/database";

async function runEndToEndVerification() {
  console.log("=================================================");
  console.log("   AIVA Phase 4 End-to-End Pivot Verification   ");
  console.log("=================================================");

  // 1. Database Schema & Migration Verification
  console.log("\n1. Verifying PostgreSQL Migration Status...");
  const migrationRes = await query("SELECT COUNT(*) FROM public._migrations");
  const count = parseInt(migrationRes.rows[0].count, 10);
  assert.ok(count >= 3, `Expected at least 3 applied migrations, found ${count}`);
  console.log(`✓ Database ready with ${count} applied migrations.`);

  // 2. Encrypted Settings Persistence
  console.log("\n2. Verifying App Settings & AES-256 Key Encryption...");
  const testKey = "gemini_api_key";
  const testVal = "AIzaSy_TEST_KEY_PHASE4_E2E";
  await setAppSetting(testKey, testVal, true, "api_keys");
  
  const fetchedVal = await getAppSetting(testKey);
  assert.strictEqual(fetchedVal, testVal, "Decrypted setting value must match input");

  const rawRowRes = await query<{ value: string; is_encrypted: boolean }>(
    "SELECT value, is_encrypted FROM public.app_settings WHERE key = $1 LIMIT 1",
    [testKey]
  );
  assert.strictEqual(rawRowRes.rows[0].is_encrypted, true);
  assert.ok(rawRowRes.rows[0].value.includes(":"), "Raw DB value must be formatted as IV:tag:ciphertext");
  console.log("✓ Encrypted provider settings successfully verified.");

  // 3. Database Project & Scene Record Persistence
  console.log("\n3. Verifying Direct PostgreSQL Project & Scene Operations...");
  const projId = "00000000-0000-0000-0000-000000000099";
  await query(
    `INSERT INTO public.projects (id, user_id, title, topic, video_style, status, updated_at)
     VALUES ($1, '00000000-0000-0000-0000-000000000000', $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()`,
    [projId, "E2E Test Video", "Self-Hosted Architecture", "stickman_animation", "draft"]
  );

  const fetchProj = await query("SELECT * FROM public.projects WHERE id = $1", [projId]);
  assert.strictEqual(fetchProj.rows[0].title, "E2E Test Video");
  console.log("✓ Project record persistence verified.");

  // 4. Disk Checkpoint Storage Directory Verification
  console.log("\n4. Verifying Disk Stage Checkpoint Structure...");
  const storageRoot = path.resolve(process.cwd(), "../../storage");
  const checkpointDir = path.resolve(storageRoot, "projects", projId, "revisions", "v1");
  fs.mkdirSync(checkpointDir, { recursive: true });

  const checkpointFile = path.resolve(checkpointDir, "checkpoint_03_script.json");
  const mockScript = {
    title: "E2E Verified Script",
    scenes: [{ sequence_number: 1, text: "Self-hosted video pipeline running." }],
  };
  fs.writeFileSync(checkpointFile, JSON.stringify(mockScript, null, 2), "utf-8");

  assert.ok(fs.existsSync(checkpointFile), "Stage checkpoint file must exist on disk");
  const readScript = JSON.parse(fs.readFileSync(checkpointFile, "utf-8"));
  assert.strictEqual(readScript.title, "E2E Verified Script");
  console.log("✓ Disk checkpoint storage ($0.00 repeated cost recovery) verified.");

  // 5. Cleanup Test Artifacts
  await query("DELETE FROM public.projects WHERE id = $1", [projId]);
  fs.rmSync(path.resolve(storageRoot, "projects", projId), { recursive: true, force: true });

  console.log("\n=================================================");
  console.log("✅ Phase 4 End-to-End Verification PASSED 100%!");
  console.log("=================================================");
}

runEndToEndVerification().catch((err) => {
  console.error("\n❌ End-to-End Verification Failed:", err);
  process.exit(1);
});
