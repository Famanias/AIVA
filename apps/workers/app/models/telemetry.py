from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import time
import uuid

class TelemetryContext(BaseModel):
    """Shared context automatically inherited by all spans and metrics."""
    job_id: str
    project_id: Optional[str] = None
    stage: str
    provider: Optional[str] = None
    worker_id: str
    correlation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    attempt: int = 1
    retry_count: int = 0
    backoff_duration_ms: int = 0

class ProviderResponseMetadata(BaseModel):
    """Standardized metadata from any external provider (LLM, TTS, etc)."""
    provider_name: str
    model_name: str
    latency_ms: float
    request_id: Optional[str] = None
    status_code: int = 200
    cache_hit: bool = False
    finish_reason: Optional[str] = None
    
    # Crucial for Prompt Version Tracking
    prompt_id: Optional[str] = None
    prompt_version: Optional[str] = None

class Event(BaseModel):
    """Something that happened (immutable lifecycle event)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    timestamp: float = Field(default_factory=time.time)
    context: TelemetryContext
    attributes: Dict[str, Any] = Field(default_factory=dict)

class Metric(BaseModel):
    """Numeric observation (tokens, characters, cost, etc)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    value: float
    unit: str
    timestamp: float = Field(default_factory=time.time)
    context: TelemetryContext
    attributes: Dict[str, Any] = Field(default_factory=dict)

class Span(BaseModel):
    """Tracks the execution duration of an operation."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    start_time: float
    end_time: Optional[float] = None
    context: TelemetryContext
    attributes: Dict[str, Any] = Field(default_factory=dict)
    events: List[Event] = Field(default_factory=list)
    
    @property
    def duration_ms(self) -> float:
        if self.end_time is None:
            return 0.0
        return (self.end_time - self.start_time) * 1000
