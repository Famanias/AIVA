from typing import Dict, Any, Optional
from app.models.telemetry import ProviderResponseMetadata
from app.core.telemetry.pricing import CostCalculator

class ProviderUsageCollector:
    """
    Extracts, normalizes, and routes provider usage metrics to the CostCalculator.
    Never calculates prices itself.
    """
    
    @staticmethod
    def extract_and_record_llm(
        job_id: str,
        project_id: str,
        provider: str,
        model: str,
        raw_usage: Dict[str, Any],
        prompt_id: Optional[str] = None,
        prompt_version: Optional[str] = None
    ):
        """Extracts LLM tokens (gemini/openai formats)."""
        metrics = {}
        
        # Normalize Gemini format
        if "promptTokenCount" in raw_usage:
            metrics["input_token"] = raw_usage.get("promptTokenCount", 0)
            metrics["output_token"] = raw_usage.get("candidatesTokenCount", 0)
            
        # Normalize OpenAI format
        elif "prompt_tokens" in raw_usage:
            metrics["input_token"] = raw_usage.get("prompt_tokens", 0)
            metrics["output_token"] = raw_usage.get("completion_tokens", 0)
            
        metadata = {
            "prompt_id": prompt_id,
            "prompt_version": prompt_version,
            "raw_usage": raw_usage
        }
        
        CostCalculator.calculate_and_record(
            job_id=job_id,
            project_id=project_id,
            provider=provider,
            model=model,
            usage_metrics=metrics,
            metadata=metadata
        )

    @staticmethod
    def extract_and_record_tts(
        job_id: str,
        project_id: str,
        provider: str,
        model: str,
        character_count: int
    ):
        """Records TTS character usage."""
        CostCalculator.calculate_and_record(
            job_id=job_id,
            project_id=project_id,
            provider=provider,
            model=model,
            usage_metrics={"character": character_count},
            metadata={}
        )
