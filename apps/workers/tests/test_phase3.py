import os
import json
import shutil
import pytest
import asyncio
from app.core.db import decrypt_secret, get_app_setting
from app.pipeline.checkpoint import load_checkpoint_or_run, get_checkpoint_filepath
from app.providers.llm.ollama_provider import OllamaProvider
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import hashlib


def test_aes256_decryption_compatibility():
    """Verify Python AES-256-GCM decrypt matching Node.js crypto.ts format (<iv>:<auth_tag>:<ciphertext>)"""
    secret = "test-secret-key-32bytes-length-ok!"
    os.environ["APP_SECRET"] = secret
    
    key = hashlib.sha256(secret.encode("utf-8")).digest()
    aesgcm = AESGCM(key)
    
    iv = os.urandom(12)
    plaintext = "sk-proj-super-secret-api-key-12345"
    ct_with_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
    
    ciphertext = ct_with_tag[:-16]
    auth_tag = ct_with_tag[-16:]
    
    formatted_encrypted_str = f"{iv.hex()}:{auth_tag.hex()}:{ciphertext.hex()}"
    
    decrypted = decrypt_secret(formatted_encrypted_str)
    assert decrypted == plaintext, f"Expected {plaintext}, got {decrypted}"
    print("✓ AES-256-GCM decryption compatibility test passed!")


@pytest.mark.asyncio
async def test_checkpoint_saving_and_recovery():
    """Verify load_checkpoint_or_run saves output on first run and loads cached checkpoint on second run without calling generator_fn"""
    storage_dir = os.path.abspath("../../storage")
    os.environ["STORAGE_DIR"] = storage_dir
    project_id = "test-project-123"
    revision = 1
    stage_name = "03_script"
    
    # Ensure test environment cleanliness
    proj_dir = os.path.join(storage_dir, "projects", project_id)
    if os.path.exists(proj_dir):
        shutil.rmtree(proj_dir)
    
    call_count = 0
    
    def generate_mock_script():
        nonlocal call_count
        call_count += 1
        return {
            "title": "Mock YouTube Short Script",
            "scenes": [{"id": 1, "text": "Hook scene visual"}]
        }
    
    # First invocation: Should run generator_fn (call_count = 1)
    res1 = await load_checkpoint_or_run(stage_name, project_id, revision, generate_mock_script)
    assert res1["title"] == "Mock YouTube Short Script"
    assert call_count == 1
    
    filepath = get_checkpoint_filepath(stage_name, project_id, revision)
    assert os.path.exists(filepath)
    
    # Second invocation: Should hit checkpoint cache (call_count stays 1)
    res2 = await load_checkpoint_or_run(stage_name, project_id, revision, generate_mock_script)
    assert res2["title"] == "Mock YouTube Short Script"
    assert call_count == 1, "Generator function should NOT be called on checkpoint hit!"
    
    print("✓ Stage checkpoint recovery test passed ($0.00 repeated cost verified)!")


def test_ollama_provider_init():
    """Verify OllamaProvider initialization"""
    provider = OllamaProvider(base_url="http://localhost:11434", model="llama3.2")
    assert provider._base_url == "http://localhost:11434"
    assert provider._model_name == "llama3.2"
    print("✓ OllamaProvider initialization test passed!")


if __name__ == "__main__":
    test_aes256_decryption_compatibility()
    asyncio.run(test_checkpoint_saving_and_recovery(pytest.importorskip("pathlib").Path("./tmp_test")))
    test_ollama_provider_init()
    print("✅ All Phase 3 Unit Tests Completed Successfully!")
