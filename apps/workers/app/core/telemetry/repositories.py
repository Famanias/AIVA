import structlog
from typing import List, Dict, Any
from app.models.telemetry import Span, Event, Metric
# In a real implementation, this would import the Supabase client
# from app.core.database import get_supabase_client

logger = structlog.get_logger(__name__)

class TelemetryRepository:
    """
    Abstracts the storage backend for telemetry data.
    Ensures that telemetry storage is decoupled from the client.
    """
    
    @staticmethod
    def save_span(span: Span):
        """Persists a Span to the database."""
        # supabase = get_supabase_client()
        # supabase.table("telemetry_spans").insert(span.dict()).execute()
        logger.debug("telemetry_span_saved", span_name=span.name, duration_ms=span.duration_ms)

    @staticmethod
    def save_event(event: Event):
        """Persists a lifecycle Event to the job_events table."""
        logger.debug("telemetry_event_saved", event_name=event.name)
        
    @staticmethod
    def save_metric(metric: Metric):
        """Persists a numeric Metric to the metrics table."""
        logger.debug("telemetry_metric_saved", metric_name=metric.name, value=metric.value)


class CostRepository:
    """
    Abstracts the storage backend for cost ledger entries.
    """
    
    @staticmethod
    def record_cost_entry(
        job_id: str, 
        project_id: str, 
        provider: str, 
        model: str, 
        cost_usd: float, 
        metadata: Dict[str, Any]
    ):
        """Persists computed financial costs to cost_ledger_entries."""
        # supabase.table("cost_ledger_entries").insert({...}).execute()
        logger.info("cost_ledger_entry_saved", job_id=job_id, provider=provider, cost_usd=cost_usd)
