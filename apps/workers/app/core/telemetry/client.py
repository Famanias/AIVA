import time
import structlog
from typing import Dict, Any, Generator
from contextlib import contextmanager

from app.models.telemetry import TelemetryContext, Span, Event, Metric, ProviderResponseMetadata
from app.core.telemetry.repositories import TelemetryRepository

logger = structlog.get_logger(__name__)

class TelemetryClient:
    """
    The only telemetry class business logic interacts with.
    Guarantees non-blocking execution via strict try/except wrapping.
    """
    
    @staticmethod
    @contextmanager
    def track_span(name: str, context: TelemetryContext, attributes: Dict[str, Any] = None) -> Generator[Span, None, None]:
        span = Span(
            name=name,
            start_time=time.time(),
            context=context,
            attributes=attributes or {}
        )
        
        try:
            yield span
        except Exception as e:
            # We do not swallow the exception for the pipeline, but we safely record the span
            span.attributes["error"] = True
            span.attributes["error_message"] = str(e)
            raise e
        finally:
            try:
                span.end_time = time.time()
                TelemetryRepository.save_span(span)
            except Exception as inner_e:
                logger.warning("telemetry_span_save_failed", error=str(inner_e))

    @staticmethod
    def record_event(name: str, context: TelemetryContext, attributes: Dict[str, Any] = None):
        try:
            event = Event(name=name, context=context, attributes=attributes or {})
            TelemetryRepository.save_event(event)
        except Exception as e:
            logger.warning("telemetry_event_save_failed", error=str(e))

    @staticmethod
    def record_metric(name: str, value: float, unit: str, context: TelemetryContext, attributes: Dict[str, Any] = None):
        try:
            metric = Metric(name=name, value=value, unit=unit, context=context, attributes=attributes or {})
            TelemetryRepository.save_metric(metric)
        except Exception as e:
            logger.warning("telemetry_metric_save_failed", error=str(e))
