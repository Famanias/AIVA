"""
Research Agent

Gathers web sources for each outline point using the configured search provider.
Called during the 'research' job_step.
See EDD §16.1.
"""
from dataclasses import dataclass

import structlog

from app.providers.llm.base import ILLMProvider
from app.providers.search.base import ISearchProvider, SearchResult

logger = structlog.get_logger(__name__)


@dataclass
class ResearchOutput:
    topic: str
    sources: list[SearchResult]
    summary: str  # LLM-synthesized summary of all sources


class ResearchAgent:
    """
    Gathers and synthesizes research sources for a given topic.

    Workflow:
    1. Run web search queries for the topic and key sub-topics
    2. Collect top results
    3. Ask LLM to synthesize findings into a concise research summary
    """

    def __init__(self, llm: ILLMProvider, search: ISearchProvider) -> None:
        self._llm = llm
        self._search = search

    async def run(self, topic: str, language: str = "en") -> ResearchOutput:
        logger.info("research_agent_start", topic=topic)

        # Run multiple targeted searches to gather diverse sources
        queries = self._build_queries(topic)
        all_results: list[SearchResult] = []

        for query in queries:
            results = await self._search.search(query, max_results=5)
            all_results.extend(results)

        # Deduplicate by URL
        seen_urls: set[str] = set()
        unique_results: list[SearchResult] = []
        for r in all_results:
            if r.url not in seen_urls:
                seen_urls.add(r.url)
                unique_results.append(r)

        logger.info("research_agent_sources_gathered", count=len(unique_results))

        # Synthesize into a structured summary
        summary = await self._synthesize(topic, unique_results, language)

        return ResearchOutput(
            topic=topic,
            sources=unique_results,
            summary=summary,
        )

    def _build_queries(self, topic: str) -> list[str]:
        """Generate multiple search queries to cover the topic from different angles."""
        return [
            topic,
            f"{topic} history facts",
            f"{topic} interesting stories",
            f"{topic} statistics data",
        ]

    async def _synthesize(
        self,
        topic: str,
        sources: list[SearchResult],
        language: str,
    ) -> str:
        """Ask the LLM to synthesize the collected sources into a usable summary."""
        from app.prompts import build_research_synthesis_prompt

        source_text = "\n\n".join(
            f"[{i+1}] {s.title}\nURL: {s.url}\n{s.excerpt}"
            for i, s in enumerate(sources[:15])  # cap to avoid context overflow
        )

        prompt = build_research_synthesis_prompt(topic=topic, sources_text=source_text, language=language)
        summary = await self._llm.generate_text(
            prompt=prompt.user_prompt,
            system_prompt=prompt.system_prompt,
        )

        logger.info("research_agent_synthesis_complete", summary_chars=len(summary))
        return summary
