from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class MediaReference(BaseModel):
    id: str
    type: str = Field(description="'video', 'audio', 'subtitle', 'image'")
    storage_key: str
    duration: float
    codec: Optional[str] = None
    mime_type: str

class EncodingProfile(BaseModel):
    codec: str = "h264"
    hardware_acceleration: str = Field(default="auto", description="'nvenc', 'x264', 'auto'")
    bitrate: str = "8M"
    preset: str = "fast"
    resolution: str = "1080x1920"
    fps: int = 30

class CompositionModel(BaseModel):
    job_id: str
    # Visually transparent overlays (e.g., from Remotion)
    overlay_track: Optional[MediaReference] = None
    
    # Base background tracks (e.g., B-roll video or AI Images)
    background_tracks: List[MediaReference] = Field(default_factory=list)
    
    # Audio
    voice_track: Optional[MediaReference] = None
    music_track: Optional[MediaReference] = None
    sfx_tracks: List[MediaReference] = Field(default_factory=list)
    
    # Subtitles
    word_timings: List[Dict[str, Any]] = Field(default_factory=list)

    output_settings: EncodingProfile = Field(default_factory=EncodingProfile)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CompositionResult(BaseModel):
    output_reference: MediaReference
    render_time_ms: int
    warnings: List[str] = Field(default_factory=list)
    manifest_url: Optional[str] = None
