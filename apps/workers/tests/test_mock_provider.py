import pytest

from app.providers.llm.base import ModelInfo
from app.providers.llm.mock_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_mock_provider_generate_text():
    provider = MockLLMProvider()
    res = await provider.generate_text(prompt="Hello")
    assert isinstance(res, str)
    assert len(res) > 0


@pytest.mark.asyncio
async def test_mock_provider_generate_json():
    provider = MockLLMProvider()
    
    # Research outline schema
    outline_res = await provider.generate_json(
        prompt="Outline",
        system_prompt="Schema",
        json_schema={"properties": {"outline": {}}},
    )
    assert "outline" in outline_res

    # Script scenes schema
    scenes_res = await provider.generate_json(
        prompt="Scenes",
        system_prompt="Schema",
        json_schema={"properties": {"scenes": {}}},
    )
    assert "scenes" in scenes_res


@pytest.mark.asyncio
async def test_mock_provider_generate_stream():
    provider = MockLLMProvider()
    tokens = []
    async for chunk in provider.generate_stream(prompt="Stream test"):
        tokens.append(chunk)
    
    combined = "".join(tokens)
    assert "deterministic mock streaming response" in combined


@pytest.mark.asyncio
async def test_mock_provider_list_models():
    provider = MockLLMProvider()
    models = await provider.list_models()
    assert len(models) == 1
    assert models[0] == ModelInfo(id="mock-model", owned_by="aiva-mock")
