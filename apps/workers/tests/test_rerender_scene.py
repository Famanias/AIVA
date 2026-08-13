import pytest
import uuid
import json
from unittest.mock import AsyncMock, patch, MagicMock
from app.pipeline.rerender_scene import rerender_single_scene
from app.providers.tts.base import TTSSynthesisResult, WordTiming

@pytest.mark.asyncio
async def test_rerender_single_scene_flow():
    proj_id = str(uuid.uuid4())
    scene_id = str(uuid.uuid4())
    version_id = str(uuid.uuid4())

    mock_row = {
        "id": scene_id,
        "sequence_number": 1,
        "duration": 4.0,
        "voiceover_url": "/tmp/old_voice.mp3",
        "script_segment": "Updated script text for scene 1",
        "visual_type": "character_animation",
        "visual_prompt": "new aircraft in flight",
        "background_broll_url": None,
    }

    mock_all_scenes = [
        {
            "id": scene_id,
            "sequence_number": 1,
            "duration": 4.5,
            "voiceover_url": "/tmp/new_voice.mp3",
            "voiceover_word_timings": json.dumps([{"word": "Updated", "start": 0.0, "end": 1.0}]),
            "script_segment": "Updated script text for scene 1",
            "visual_type": "character_animation",
            "visual_prompt": "new aircraft in flight",
            "background_broll_url": None,
        }
    ]

    mock_conn = AsyncMock()
    mock_conn.fetchrow.return_value = mock_row
    mock_conn.fetch.return_value = mock_all_scenes
    mock_conn.execute.return_value = None

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn
    mock_pool.acquire.return_value.__aexit__.return_value = None

    mock_tts = AsyncMock()
    mock_tts.synthesize.return_value = TTSSynthesisResult(
        audio_url="/tmp/new_voice.mp3",
        word_timings=[
            WordTiming(word="Updated", start=0.0, end=0.8),
            WordTiming(word="script", start=0.8, end=1.5),
        ],
        duration_sec=3.5,
    )

    with patch("app.pipeline.rerender_scene.get_db_pool", return_value=mock_pool), \
         patch("app.pipeline.rerender_scene.get_tts_provider_async", return_value=mock_tts):
        
        result = await rerender_single_scene(proj_id, scene_id, revision=1)
        
        assert result["status"] == "success"
        assert result["project_id"] == proj_id
        assert result["scene_id"] == scene_id
        assert result["sequence_number"] == 1
        assert result["duration"] == 3.5
        assert result["voiceover_url"] == "/tmp/new_voice.mp3"

        # Verify DB updates were called
        assert mock_conn.execute.called
