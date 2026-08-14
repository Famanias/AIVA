import json
from unittest.mock import AsyncMock, MagicMock
import pytest
import tenacity

from app.providers.llm.base import LLMProviderError, ModelInfo
from app.providers.llm.openai_compatible_provider import OpenAICompatibleProvider


@pytest.fixture(autouse=True)
def fast_retry():
    OpenAICompatibleProvider.generate_text.retry.wait = tenacity.wait_none()
    OpenAICompatibleProvider.generate_text.retry.stop = tenacity.stop_after_attempt(2)
    OpenAICompatibleProvider.generate_json.retry.wait = tenacity.wait_none()
    OpenAICompatibleProvider.generate_json.retry.stop = tenacity.stop_after_attempt(2)
    yield
    OpenAICompatibleProvider.generate_text.retry.wait = tenacity.wait_exponential(multiplier=2, min=2, max=60)
    OpenAICompatibleProvider.generate_text.retry.stop = tenacity.stop_after_attempt(5)
    OpenAICompatibleProvider.generate_json.retry.wait = tenacity.wait_exponential(multiplier=2, min=2, max=60)
    OpenAICompatibleProvider.generate_json.retry.stop = tenacity.stop_after_attempt(5)


@pytest.fixture
def mock_openai_client():
    client = MagicMock()
    client.chat = MagicMock()
    client.chat.completions = MagicMock()
    client.chat.completions.create = AsyncMock()
    client.models = MagicMock()
    client.models.list = AsyncMock()
    return client


@pytest.fixture
def provider(mock_openai_client):
    def client_factory(*args, **kwargs):
        return mock_openai_client

    return OpenAICompatibleProvider(
        base_url="https://openrouter.ai/api/v1",
        api_key="test-key",
        model="google/gemini-flash-1.5",
        client_factory=client_factory,
    )


@pytest.mark.asyncio
async def test_generate_text_success(provider, mock_openai_client):
    mock_choice = MagicMock()
    mock_choice.message.content = "Generated story text"
    mock_response = MagicMock(choices=[mock_choice])
    mock_openai_client.chat.completions.create.return_value = mock_response

    result = await provider.generate_text(
        prompt="Tell me a story", system_prompt="You are an expert storyteller"
    )

    assert result == "Generated story text"
    mock_openai_client.chat.completions.create.assert_called_once_with(
        model="google/gemini-flash-1.5",
        messages=[
            {"role": "system", "content": "You are an expert storyteller"},
            {"role": "user", "content": "Tell me a story"},
        ],
    )


@pytest.mark.asyncio
async def test_generate_text_failure(provider, mock_openai_client):
    mock_openai_client.chat.completions.create.side_effect = RuntimeError("API Connection Error")

    with pytest.raises(LLMProviderError) as exc_info:
        await provider.generate_text(prompt="Hello")

    assert exc_info.value.provider == "openai_compatible"
    assert "generate_text failed" in str(exc_info.value)


@pytest.mark.asyncio
async def test_generate_json_success(provider, mock_openai_client):
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({"title": "Test Title", "scenes": []})
    mock_response = MagicMock(choices=[mock_choice])
    mock_openai_client.chat.completions.create.return_value = mock_response

    result = await provider.generate_json(
        prompt="Create scenes",
        system_prompt="Return JSON",
        json_schema={"type": "object"},
    )

    assert result == {"title": "Test Title", "scenes": []}
    mock_openai_client.chat.completions.create.assert_called_once_with(
        model="google/gemini-flash-1.5",
        messages=[
            {"role": "system", "content": "Return JSON"},
            {"role": "user", "content": "Create scenes"},
        ],
        response_format={"type": "json_object"},
    )


@pytest.mark.asyncio
async def test_generate_json_strips_markdown_fences(provider, mock_openai_client):
    mock_choice = MagicMock()
    mock_choice.message.content = "```json\n{\"status\": \"ok\"}\n```"
    mock_response = MagicMock(choices=[mock_choice])
    mock_openai_client.chat.completions.create.return_value = mock_response

    result = await provider.generate_json(
        prompt="Get status",
        system_prompt="Return JSON",
        json_schema={},
    )

    assert result == {"status": "ok"}


@pytest.mark.asyncio
async def test_generate_json_retry_fallback(provider, mock_openai_client):
    # First response: invalid JSON
    bad_choice = MagicMock()
    bad_choice.message.content = "Not a json response"
    bad_resp = MagicMock(choices=[bad_choice])

    # Second response: valid JSON
    good_choice = MagicMock()
    good_choice.message.content = json.dumps({"recovered": True})
    good_resp = MagicMock(choices=[good_choice])

    mock_openai_client.chat.completions.create.side_effect = [bad_resp, good_resp]

    result = await provider.generate_json(
        prompt="Produce data",
        system_prompt="Output schema",
        json_schema={},
    )

    assert result == {"recovered": True}
    assert mock_openai_client.chat.completions.create.call_count == 2


@pytest.mark.asyncio
async def test_generate_stream(provider, mock_openai_client):
    async def fake_stream():
        chunks = ["Hello", " ", "world", "!"]
        for c in chunks:
            mock_delta = MagicMock()
            mock_delta.choices = [MagicMock(delta=MagicMock(content=c))]
            yield mock_delta

    mock_openai_client.chat.completions.create.return_value = fake_stream()

    tokens = []
    async for chunk in provider.generate_stream(prompt="Stream me"):
        tokens.append(chunk)

    assert "".join(tokens) == "Hello world!"


@pytest.mark.asyncio
async def test_list_models_success(provider, mock_openai_client):
    mock_model_1 = MagicMock(id="model-a", owned_by="openai")
    mock_model_2 = MagicMock(id="model-b", owned_by="google")
    mock_openai_client.models.list.return_value = MagicMock(data=[mock_model_1, mock_model_2])

    models = await provider.list_models()

    assert len(models) == 2
    assert models[0] == ModelInfo(id="model-a", owned_by="openai")
    assert models[1] == ModelInfo(id="model-b", owned_by="google")


@pytest.mark.asyncio
async def test_list_models_fallback_on_error(provider, mock_openai_client):
    mock_openai_client.models.list.side_effect = Exception("404 Not Found")

    models = await provider.list_models()

    assert len(models) == 1
    assert models[0] == ModelInfo(id="google/gemini-flash-1.5", owned_by="unknown")
