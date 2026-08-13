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

