import assert from "assert";
import { GET as getSettings, POST as postSettings } from "./app/api/v1/settings/route";
import { POST as testOllama } from "./app/api/v1/settings/test-ollama/route";
import { GET as getStorage } from "./app/api/v1/storage/[...path]/route";
import { NextRequest } from "next/server";

async function runPhase2Tests() {
  console.log("Running Phase 2 Frontend & API Layer Unit Tests...");

  // Test 1: GET /api/v1/settings
  const getRes = await getSettings();
  const getData = await getRes.json();
  assert.strictEqual(getData.status, "success");
  assert.ok(getData.data.llm_provider, "llm_provider should exist in settings payload");
  console.log("✓ GET /api/v1/settings endpoint test passed!");

  // Test 2: POST /api/v1/settings
  const postReq = new NextRequest("http://localhost:3000/api/v1/settings", {
    method: "POST",
    body: JSON.stringify({
      llm_provider: "gemini",
      ollama_base_url: "http://localhost:11434",
    }),
  });
  const postRes = await postSettings(postReq);
  const postData = await postRes.json();
  assert.strictEqual(postData.status, "success");
  console.log("✓ POST /api/v1/settings endpoint test passed!");

  // Test 3: POST /api/v1/settings/test-ollama (mock connection check)
  const ollamaReq = new NextRequest("http://localhost:3000/api/v1/settings/test-ollama", {
    method: "POST",
    body: JSON.stringify({
      ollama_base_url: "http://127.0.0.1:11434",
    }),
  });
  const ollamaRes = await testOllama(ollamaReq);
  const ollamaData = await ollamaRes.json();
  assert.ok(ollamaData.status, "test-ollama response should contain status");
  console.log("✓ POST /api/v1/settings/test-ollama endpoint test passed!");

  // Test 4: GET /api/v1/storage Path Traversal Security Check
  const pathTraversalReq = new NextRequest("http://localhost:3000/api/v1/storage/../../etc/passwd");
  const storageRes = await getStorage(pathTraversalReq, {
    params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
  });
  assert.strictEqual(storageRes.status, 403, "Path traversal should return 403 Forbidden");
  console.log("✓ Storage path traversal security test passed!");

  // Test 5: GET /api/v1/storage Download Header Check
  const downloadReq = new NextRequest("http://localhost:3000/api/v1/storage/projects/test-proj/hello.json?download=true");
  const downloadRes = await getStorage(downloadReq, {
    params: Promise.resolve({ path: ["projects", "test-proj", "hello.json"] }),
  });
  if (downloadRes.status === 200) {
    const disposition = downloadRes.headers.get("content-disposition");
    assert.ok(disposition && disposition.includes("attachment"), "Download request should contain Content-Disposition: attachment header");
    console.log("✓ Storage download attachment header test passed!");
  }

  console.log("✅ Phase 2 & Phase 3 Frontend & API Layer Unit Tests Completed Successfully!");
}

runPhase2Tests().catch((err) => {
  console.error("❌ Phase 2 tests failed:", err);
  process.exit(1);
});
