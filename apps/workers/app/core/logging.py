"""
Structured logging configuration for AIVA workers.

All logs include a trace_id so requests can be correlated end-to-end.
See EDD §41 — structured JSON logs, traceable by trace_id.
"""
import structlog


def configure_logging(json_logs: bool = True) -> None:
    """Configure structlog with JSON output and common processors."""
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if json_logs:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO level
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def bind_trace_id(trace_id: str) -> None:
    """Bind a trace_id to the current context so all subsequent logs include it."""
    structlog.contextvars.bind_contextvars(trace_id=trace_id)


def clear_trace_id() -> None:
    """Clear the trace_id from the current context."""
    structlog.contextvars.clear_contextvars()
