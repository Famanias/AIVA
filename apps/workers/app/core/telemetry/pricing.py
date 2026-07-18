from typing import Dict, Any
from app.core.telemetry.repositories import CostRepository

class PricingCatalog:
    """
    Abstracts pricing rates. In a real system, this might fetch from a database table
    or a configurable remote JSON to allow updating prices without touching code.
    """
    
    # Static fallback rates (USD)
    _RATES = {
        "gemini": {
            "gemini-1.5-flash": {
                "input_token": 0.000000075,  # $0.075 / 1M tokens
                "output_token": 0.0000003,   # $0.30 / 1M tokens
            }
        },
        "kokoro": {
            "kokoro-82m": {
                "character": 0.000015  # Compute cost estimate for self-hosting per char
            }
        },
        "pexels": {
            "api": {
                "call": 0.0001
            }
        }
    }

    @staticmethod
    def get_rate(provider: str, model: str, unit: str) -> float:
        try:
            return PricingCatalog._RATES.get(provider, {}).get(model, {}).get(unit, 0.0)
        except KeyError:
            return 0.0


class CostCalculator:
    """
    Converts raw usage metrics into financial cost and persists them via the CostRepository.
    """
    
    @staticmethod
    def calculate_and_record(
        job_id: str, 
        project_id: str,
        provider: str, 
        model: str, 
        usage_metrics: Dict[str, float],
        metadata: Dict[str, Any]
    ):
        total_cost = 0.0
        
        for unit, amount in usage_metrics.items():
            rate = PricingCatalog.get_rate(provider, model, unit)
            total_cost += (rate * amount)
            
        if total_cost > 0:
            CostRepository.record_cost_entry(
                job_id=job_id,
                project_id=project_id,
                provider=provider,
                model=model,
                cost_usd=total_cost,
                metadata=metadata
            )
