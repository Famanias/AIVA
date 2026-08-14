import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.providers.llm.base import LLMProviderError, ModelInfo
from app.providers.llm.ollama_provider import OllamaProvider


@pytest.fixture
def ollama_provider():
    return OllamaProvider(base_url="http://localhost:11434", model="llama3.2")


@pytest.mark.asyncio
async def test_ollama_generate_text(ollama_provider):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"response": "Local response from llama"}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await ollama_provider.generate_text(
            prompt="Hello Ollama", system_prompt="Be concise"
        )

        assert result == "Local response from llama"
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["model"] == "llama3.2"
        assert "Be concise\n\nHello Ollama" in call_kwargs["json"]["prompt"]


@pytest.mark.asyncio
async def test_ollama_generate_json(ollama_provider):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "response": "```json\n{\"key\": \"val\"}\n```"
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await ollama_provider.generate_json(
            prompt="Generate JSON",
            system_prompt="Return strict JSON",
            json_schema={},
        )

        assert result == {"key": "val"}


@pytest.mark.asyncio
async def test_ollama_generate_stream(ollama_provider):
    lines = [
        json.dumps({"response": "Streaming "}),
        json.dumps({"response": "from "}),
        json.dumps({"response": "Ollama."}),
    ]

    async def fake_aiter_lines():
        for line in lines:
            yield line

    mock_stream_resp = MagicMock()
    mock_stream_resp.raise_for_status = MagicMock()
    mock_stream_resp.aiter_lines = fake_aiter_lines

    class FakeStreamContext:
        async def __aenter__(self):
            return mock_stream_resp

        async def __aexit__(self, *args):
            pass

    with patch("httpx.AsyncClient.stream", return_value=FakeStreamContext()):
        tokens = []
        async for chunk in ollama_provider.generate_stream(prompt="Stream test"):
            tokens.append(chunk)

        assert "".join(tokens) == "Streaming from Ollama."


@pytest.mark.asyncio
async def test_ollama_list_models(ollama_provider):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "models": [
            {"name": "llama3.2:latest"},
            {"name": "mistral:latest"},
        ]
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_resp

        models = await ollama_provider.list_models()

        assert len(models) == 2
        assert models[0] == ModelInfo(id="llama3.2:latest", owned_by="ollama")
        assert models[1] == ModelInfo(id="mistral:latest", owned_by="ollama")


@pytest.mark.asyncio
async def test_ollama_list_models_fallback(ollama_provider):
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = Exception("Connection refused")

        models = await ollama_provider.list_models()

        assert len(models) == 1
        assert models[0] == ModelInfo(id="llama3.2", owned_by="ollama")
