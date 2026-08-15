import pytest
import os
import tempfile
from app.models.composition import (
    CompositionModel,
    MediaReference,
    EncodingProfile,
)
from app.core.composition.audio_mixer import AudioMixer
from app.core.composition.subtitle_generator import SubtitleGenerator
from app.core.composition.graph_builder import FilterGraphBuilder
from app.pipelines.stage_handlers import handle_subtitle_extraction_stage

@pytest.mark.asyncio
async def test_subtitle_extraction_word_timings():
    scene_voiceovers = [
        {
            "sequence_number": 1,
            "duration_sec": 3.0,
            "word_timings": [
                {"word": "Hello", "start": 0.0, "end": 1.0},
                {"word": "world", "start": 1.0, "end": 2.5},
            ]
        },
        {
            "sequence_number": 2,
            "duration_sec": 2.5,
            "word_timings": [
                {"word": "Next", "start": 0.2, "end": 1.0},
                {"word": "scene", "start": 1.0, "end": 2.2},
            ]
        }
    ]

    result = await handle_subtitle_extraction_stage("test_job_1", scene_voiceovers)
    
    assert len(result["subtitles"]) == 2
    assert len(result["global_word_timings"]) == 4
    
    # Check that second scene timings are offset by scene 1 duration (3.0s)
    assert result["global_word_timings"][2]["word"] == "Next"
    assert result["global_word_timings"][2]["start"] == 3.2
    assert result["global_word_timings"][3]["word"] == "scene"
    assert result["global_word_timings"][3]["end"] == 5.2

def test_audio_mixer_ducking_graph():
    model = CompositionModel(
        job_id="test_duck_job",
        voice_track=MediaReference(id="v1", type="audio", storage_key="voice.mp3", duration=5.0, mime_type="audio/mp3"),
        music_track=MediaReference(id="m1", type="audio", storage_key="music.mp3", duration=10.0, mime_type="audio/mp3"),
        word_timings=[],
        output_settings=EncodingProfile()
    )

    graph, pad, next_idx = AudioMixer.build_audio_graph(model, input_offset=0)
    
    assert "sidechaincompress" in graph
    assert "amix" in graph
    assert pad == "[outa]"

def test_srt_generation():
    word_timings = [
        {"word": "Aviation", "start": 0.0, "end": 1.2},
        {"word": "History", "start": 1.2, "end": 2.5}
    ]
    with tempfile.NamedTemporaryFile(suffix=".srt", delete=False) as tmp:
        srt_path = tmp.name

    try:
        SubtitleGenerator.generate_srt(word_timings, srt_path)
        assert os.path.exists(srt_path)
        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()
            assert "Aviation" in content
            assert "00:00:00,000 --> 00:00:01,200" in content
    finally:
        if os.path.exists(srt_path):
            os.remove(srt_path)

def test_composition_engine_ducking_e2e():
    from app.core.composition.engine import CompositionEngine
    import subprocess
    import shutil

    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    temp_dir = tempfile.mkdtemp()

    try:
        bg_video = os.path.join(temp_dir, "test_bg.mp4")
        voice_audio = os.path.join(temp_dir, "test_voice.mp3")
        music_audio = os.path.join(temp_dir, "test_music.mp3")

        # Generate 2s dummy video
        subprocess.run([
            ffmpeg_bin, "-y", "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", bg_video
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        # Generate 2s dummy voice audio
        subprocess.run([
            ffmpeg_bin, "-y", "-f", "lavfi", "-i", "sine=f=440:d=2",
            "-c:a", "libmp3lame", voice_audio
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        # Generate 2s dummy music audio
        subprocess.run([
            ffmpeg_bin, "-y", "-f", "lavfi", "-i", "sine=f=220:d=2",
            "-c:a", "libmp3lame", music_audio
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        model = CompositionModel(
            job_id="test_duck_e2e",
            background_tracks=[
                MediaReference(id="bg1", type="video", storage_key=bg_video, duration=2.0, mime_type="video/mp4")
            ],
            voice_track=MediaReference(id="v1", type="audio", storage_key=voice_audio, duration=2.0, mime_type="audio/mp3"),
            music_track=MediaReference(id="m1", type="audio", storage_key=music_audio, duration=2.0, mime_type="audio/mp3"),
            word_timings=[
                {"word": "Testing", "start": 0.0, "end": 1.0},
                {"word": "Ducking", "start": 1.0, "end": 2.0},
            ],
            output_settings=EncodingProfile(
                width=320,
                height=240,
                resolution="320x240",
                hardware_acceleration="x264"
            ),
            metadata={"project_id": "test_duck_proj"}
        )

        result = CompositionEngine.run(model)
        assert result.output_reference.storage_key is not None
        assert os.path.exists(result.output_reference.storage_key)
        assert os.path.getsize(result.output_reference.storage_key) > 0

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_handle_voiceover_stage_multi_scene_concatenation():
    import shutil
    import subprocess
    from unittest.mock import AsyncMock, patch
    from app.pipelines.stage_handlers import handle_voiceover_stage
    from app.providers.tts.base import TTSSynthesisResult, WordTiming

    mock_tts = AsyncMock()
    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    
    # Create two dummy audio files using FFmpeg sine waves
    temp_dir = tempfile.mkdtemp()
    try:
        f1 = os.path.join(temp_dir, "s1.mp3")
        f2 = os.path.join(temp_dir, "s2.mp3")
        subprocess.run([ffmpeg_bin, "-y", "-f", "lavfi", "-i", "sine=f=440:d=1", "-c:a", "libmp3lame", f1], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        subprocess.run([ffmpeg_bin, "-y", "-f", "lavfi", "-i", "sine=f=880:d=1", "-c:a", "libmp3lame", f2], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        mock_tts.synthesize.side_effect = [
            TTSSynthesisResult(audio_url=f1, word_timings=[WordTiming(word="one", start=0, end=1)], duration_sec=1.0),
            TTSSynthesisResult(audio_url=f2, word_timings=[WordTiming(word="two", start=0, end=1)], duration_sec=1.0),
        ]

        scenes = [
            {"sequence_number": 1, "scriptSegment": "Scene one text"},
            {"sequence_number": 2, "scriptSegment": "Scene two text"},
        ]

        with patch("app.pipelines.stage_handlers.get_tts_provider_async", return_value=mock_tts):
            res = await handle_voiceover_stage("test_multi_job", scenes, project_id="test_multi_proj")
            
            assert "master_audio_url" in res
            assert res["master_audio_url"] is not None
            assert os.path.exists(res["master_audio_url"])
            assert len(res["voiceovers"]) == 2
            assert "master_duration_sec" in res
            assert res["master_duration_sec"] > 0
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.mark.asyncio
async def test_fallback_asset_provider():
    from app.providers.fallback_provider import LocalSolidFallbackProvider
    provider = LocalSolidFallbackProvider()
    candidates = await provider.search("Historical aviation breakthrough")
    assert len(candidates) == 1
    cand = candidates[0]
    assert cand.score == 1.0
    assert cand.provider == "local_fallback"
    assert os.path.exists(cand.raw_metadata["url"])

def test_subtitle_phrase_chunking():
    word_timings = [
        {"word": "The", "start": 0.0, "end": 0.3},
        {"word": "quick", "start": 0.3, "end": 0.6},
        {"word": "brown", "start": 0.6, "end": 0.9},
        {"word": "fox", "start": 0.9, "end": 1.2},
        {"word": "jumps", "start": 1.5, "end": 1.8},
        {"word": "over", "start": 1.8, "end": 2.1},
    ]
    chunks = SubtitleGenerator._chunk_words(word_timings, max_words=4)
    assert len(chunks) == 2
    assert chunks[0]["text"] == "The quick brown fox"
    assert chunks[1]["text"] == "jumps over"
    assert chunks[0]["start"] == 0.0

def test_filter_graph_synthetic_fallback_when_backgrounds_empty():
    model = CompositionModel(
        job_id="test_synthetic_bg",
        background_tracks=[],
        overlay_track=MediaReference(id="ov1", type="video", storage_key="overlay.webm", duration=10.0, mime_type="video/webm"),
        voice_track=MediaReference(id="v1", type="audio", storage_key="voice.mp3", duration=10.0, mime_type="audio/mp3"),
        word_timings=[],
        output_settings=EncodingProfile(width=1080, height=1920, fps=30)
    )
    inputs, filter_complex, v_pad, a_pad = FilterGraphBuilder.build(model)
    assert "bg_synthetic" in filter_complex
    assert "eof_action=pass" in filter_complex

@pytest.mark.asyncio
async def test_asset_downloader_local_and_file_urls():
    from app.services.asset_downloader import AssetDownloader
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(b"dummy image data")
        tmp_path = tmp.name

    try:
        # Test raw path
        p1 = await AssetDownloader.download(tmp_path)
        assert os.path.exists(p1)
        assert os.path.getsize(p1) > 0

        # Test file:// URL
        file_url = f"file:///{tmp_path.replace(os.sep, '/')}"
        p2 = await AssetDownloader.download(file_url)
        assert os.path.exists(p2)
        assert os.path.getsize(p2) > 0
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_dynamic_ass_subtitle_generation():
    word_timings = [
        {"word": "Dynamic", "start": 0.0, "end": 1.0},
        {"word": "Subtitles", "start": 1.0, "end": 2.0}
    ]
    # Test vertical 9:16 (1080x1920)
    ass_916 = SubtitleGenerator.generate(word_timings, "test_job_916", width=1080, height=1920, aspect_ratio="9:16")
    try:
        assert os.path.exists(ass_916)
        with open(ass_916, "r", encoding="utf-8") as f:
            content = f.read()
            assert "PlayResX: 1080" in content
            assert "PlayResY: 1920" in content
            assert ",280,1" in content # MarginV = 280
    finally:
        if os.path.exists(ass_916):
            os.remove(ass_916)

    # Test horizontal 16:9 (1920x1080)
    ass_169 = SubtitleGenerator.generate(word_timings, "test_job_169", width=1920, height=1080, aspect_ratio="16:9")
    try:
        assert os.path.exists(ass_169)
        with open(ass_169, "r", encoding="utf-8") as f:
            content = f.read()
            assert "PlayResX: 1920" in content
            assert "PlayResY: 1080" in content
            assert ",90,1" in content # MarginV = 90
    finally:
        if os.path.exists(ass_169):
            os.remove(ass_169)

@pytest.mark.asyncio
async def test_asset_strategy_visual_type_routing():
    from app.services.asset_strategy import AssetSelectionStrategy
    from app.repositories.asset_repository import LocalCacheRepository
    from app.models.asset import AssetConfig
    import tempfile
    import shutil

    tmp_storage = tempfile.mkdtemp()
    try:
        repo = LocalCacheRepository(base_dir=tmp_storage)
        strategy = AssetSelectionStrategy(repository=repo)
        cfg = AssetConfig(max_candidates=1, semantic_threshold=0.0)



        # 1. Test AI image routing resolves without error
        candidate_ai = await strategy.resolve_for_scene(
            scene_text="Glowing human brain firing neurons",
            query="caffeine neural activity",
            config=cfg,
            visual_type="ai_image",
            visual_prompt="Hyperdetailed cinematic 3d render of human synapses firing neon blue"
        )
        assert candidate_ai is not None
        assert candidate_ai.reference is not None

        # 2. Test B-Roll stock video routing resolves without error
        candidate_broll = await strategy.resolve_for_scene(
            scene_text="Pouring hot espresso into glass",
            query="espresso coffee beans pour",
            config=cfg,
            visual_type="broll"
        )
        assert candidate_broll is not None
        assert candidate_broll.reference is not None
    finally:
        shutil.rmtree(tmp_storage, ignore_errors=True)

def test_build_script_director_prompt_dynamic():
    from app.prompts import build_script_director_prompt
    rendered = build_script_director_prompt(
        topic="Caffeine and sleep",
        language="en",
        outline="1. Hook\n2. Science\n3. Solution",
    )
    assert "You are an elite video scriptwriter and visual director" in rendered.system_prompt
    assert "visual_type" in rendered.system_prompt
    assert "broll_search_keywords" in rendered.system_prompt
    assert "visual_prompt" in rendered.system_prompt
    assert "stickman_animation" not in rendered.user_prompt





