from dataclasses import dataclass
from typing import Any

# Phase 1 Short-Form defaults (mirrors SHORT_FORM_PROFILE in shared-types)
_SHORT_FORM_DEFAULT: dict[str, Any] = {
    "content_strategy": "short_form",
    "target_duration_seconds": 60,
    "min_duration_seconds": 30,
    "max_duration_seconds": 120,
    "pacing": {
        "visual_cut_interval_seconds": [2, 6],
        "hook_within_seconds": 3,
        "words_per_minute": 150,
    },
    "platform": {
        "platform": "youtube_shorts",
        "aspect_ratio": "9:16",
        "width": 1080,
        "height": 1920,
        "fps": 30,
        "subtitle_style": "center_karaoke",
        "cta_placement": "end_screen",
    },
    "narrative_style": "Fast-paced, hook-driven, high-retention. Lead with the most surprising fact. Every sentence must earn attention.",
}


@dataclass
class RenderedPrompt:
    system_prompt: str
    user_prompt: str


def _get_strategy_instructions(content_strategy: str) -> str:
    """Returns content strategy instructions to inject into prompts."""
    if content_strategy == "short_form":
        return (
            "CONTENT STRATEGY: ShortFormStrategy\n"
            "- Hook within the FIRST 3 SECONDS — open with the most surprising or counterintuitive fact.\n"
            "- Build a fast retention arc: Hook → Tension/Curiosity Gap → Resolution → CTA.\n"
            "- Every sentence must earn attention. Cut anything that doesn't advance the story.\n"
            "- No slow introductions. No 'In this video we will...' preamble.\n"
            "- Pacing: new visual or narrative beat every 2-6 seconds."
        )
    return (
        "CONTENT STRATEGY: LongFormStrategy\n"
        "- Open with a strong hook, then establish credibility and scope.\n"
        "- Build through research → outline → chapters → script.\n"
        "- Allow depth: historical context, multiple perspectives, data-driven analysis.\n"
        "- Pacing can be moderate; build tension over longer arcs."
    )


def build_research_synthesis_prompt(
    topic: str,
    sources_text: str,
    language: str,
    generation_profile: dict[str, Any] | None = None,
) -> RenderedPrompt:
    profile = generation_profile or _SHORT_FORM_DEFAULT
    strategy = _get_strategy_instructions(profile.get("content_strategy", "short_form"))

    system_prompt = (
        "You are an expert research assistant helping to produce a high-quality video script.\n"
        "Your task is to synthesize raw web search results into a cohesive research summary.\n"
        "Focus on facts, statistics, stories, and examples that would make compelling video content.\n"
        f"{strategy}\n"
        "Cite your sources clearly. Be concise and factual. Do not editorialize."
    )
    user_prompt = (
        f"Synthesize the following web search results for a video about \"{topic}\".\n\n"
        f"SOURCES:\n{sources_text}\n\n"
        f"Language: {language}\n\n"
        "Provide a comprehensive summary of key findings with supporting details. For each finding, include:\n"
        "- The key fact or story\n"
        "- Why it is relevant and engaging for a video audience\n"
        "- Any statistics, dates, or notable examples\n\n"
        "Format as a structured list. Be thorough but concise."
    )
    return RenderedPrompt(system_prompt=system_prompt, user_prompt=user_prompt)


def build_outline_prompt(
    topic: str,
    video_style: str,
    language: str,
    research_summary: str,
    generation_profile: dict[str, Any] | None = None,
    # Legacy fallback — only used if generation_profile is not supplied
    duration_target_minutes: int = 1,
) -> RenderedPrompt:
    profile = generation_profile or _SHORT_FORM_DEFAULT
    target_seconds: int = profile.get("target_duration_seconds", duration_target_minutes * 60)
    pacing: dict = profile.get("pacing", _SHORT_FORM_DEFAULT["pacing"])
    words_per_minute: int = pacing.get("words_per_minute", 150)
    hook_within: int = pacing.get("hook_within_seconds", 3)
    approx_words = round((target_seconds / 60) * words_per_minute)
    strategy = _get_strategy_instructions(profile.get("content_strategy", "short_form"))
    narrative_style: str = profile.get("narrative_style", _SHORT_FORM_DEFAULT["narrative_style"])

    style_guidance = {
        "stickman_animation": "Structure the outline around scene beats and emotional moments. Each point should describe a clear narrative beat (setup, conflict, resolution). Favor dramatic, relatable, story-driven structure.",
        "documentary": "Structure the outline chronologically or causally. Each point should cover a distinct chapter of the story — origins, development, consequences. Favor factual, educational flow.",
        "kinetic_typography": "Structure as a punchy listicle or fast-paced fact delivery. Each point should be a self-contained insight or revelation. Favor brevity and impact.",
        "avatar_narration": "Structure as a professional presentation. Each point should be a clear topic section with a defined takeaway. Favor clarity and authority.",
        "mixed_custom": "Structure freely based on what best serves the topic. No style constraints.",
    }
    guidance = style_guidance.get(video_style, style_guidance["stickman_animation"])

    system_prompt = (
        "You are an expert video scriptwriter and content strategist.\n"
        "Your task is to create a detailed, engaging video outline that will be used to write a full script.\n"
        "The outline must be appropriate for the specified video style and duration target.\n"
        f"{strategy}\n"
        "Output only valid JSON — no markdown, no preamble, no explanation."
    )

    user_prompt = (
        f"Create a video outline for the following topic.\n\n"
        f"TOPIC: {topic}\n"
        f"VIDEO STYLE: {video_style}\n"
        f"TARGET DURATION: {target_seconds} seconds (~{approx_words} words)\n"
        f"LANGUAGE: {language}\n"
        f"NARRATIVE STYLE: {narrative_style}\n\n"
        f"STYLE GUIDANCE: {guidance}\n\n"
        f"RESEARCH SUMMARY:\n{research_summary}\n\n"
        "Output a JSON object with this exact structure:\n"
        "{\n"
        '  "title": "string — engaging video title",\n'
        f'  "hook": "string — first 1-2 sentences that MUST capture attention within {hook_within} seconds",\n'
        '  "points": [\n'
        "    {\n"
        '      "index": 0,\n'
        '      "heading": "string — section title",\n'
        '      "keyPoints": ["string", "string", "string"]\n'
        "    }\n"
        "  ],\n"
        '  "conclusion": "string — 1-2 sentence call-to-action / closing"\n'
        "}\n\n"
        f"Include outline points appropriate for a {target_seconds}-second video. For short-form, keep it tight: 3-6 punchy points maximum."
    )
    return RenderedPrompt(system_prompt=system_prompt, user_prompt=user_prompt)


def build_script_director_prompt(
    topic: str,
    language: str,
    video_style: str,
    visual_type_weights: dict[str, float],
    allowed_templates: list[str],
    default_camera_pacing: str,
    rig_action_list: list[str],
    typography_template_list: list[str],
    outline: str,
    generation_profile: dict[str, Any] | None = None,
    # Legacy fallback
    duration_target_minutes: int = 1,
    approx_word_count: int | None = None,
) -> RenderedPrompt:
    profile = generation_profile or _SHORT_FORM_DEFAULT
    target_seconds: int = profile.get("target_duration_seconds", duration_target_minutes * 60)
    pacing: dict = profile.get("pacing", _SHORT_FORM_DEFAULT["pacing"])
    words_per_minute: int = pacing.get("words_per_minute", 150)
    min_cut, max_cut = pacing.get("visual_cut_interval_seconds", [2, 6])
    narrative_style: str = profile.get("narrative_style", _SHORT_FORM_DEFAULT["narrative_style"])
    platform: dict = profile.get("platform", _SHORT_FORM_DEFAULT["platform"])

    effective_word_count = approx_word_count or round((target_seconds / 60) * words_per_minute)
    strategy = _get_strategy_instructions(profile.get("content_strategy", "short_form"))
    weights_summary = ", ".join(f"{k}: {int(v * 100)}%" for k, v in visual_type_weights.items())

    system_prompt = (
        "You are a master video scriptwriter and visual director, specializing in high-retention narration.\n\n"
        "Your output must strictly conform to valid JSON following the schema provided.\n\n"
        f"{strategy}\n\n"
        "For every scene, in the SAME PASS as writing the narrative text, decide:\n"
        "- visual_type: constrained to the allowed types for the given style\n"
        "- The appropriate template parameter (animation_action, camera_style, or typography_template)\n"
        "- transition and emotional_tone\n\n"
        "Rules:\n"
        "- Never invent a template parameter not in the provided allowed lists.\n"
        "- Never include markdown code blocks or conversational preamble in your response.\n"
        "- Output only the raw JSON object.\n"
        f"- Each scene narration should be tight and punchy — suitable for {min_cut}-{max_cut} second visual cuts.\n"
        f"- Total word count across all scenes must reach approximately {effective_word_count} words."
    )

    allowed_templates_str = ", ".join(allowed_templates)
    rig_action_str = f"Animation actions (for character_animation scenes): {', '.join(rig_action_list)}" if rig_action_list else ""
    typography_str = f"Typography templates (for kinetic_typography scenes): {', '.join(typography_template_list)}" if typography_template_list else ""
    platform_str = f"{platform.get('platform', 'generic')} ({platform.get('aspect_ratio', '9:16')}, {platform.get('width', 1080)}x{platform.get('height', 1920)})"

    user_prompt = (
        "Write a complete video script with visual direction for the following:\n\n"
        f"TOPIC: {topic}\n"
        f"LANGUAGE: {language}\n"
        f"VIDEO STYLE: {video_style}\n"
        f"TARGET DURATION: {target_seconds} seconds (~{effective_word_count} words total)\n"
        f"CAMERA PACING: {default_camera_pacing}\n"
        f"NARRATIVE STYLE: {narrative_style}\n"
        f"PLATFORM: {platform_str}\n\n"
        f"VISUAL TYPE DISTRIBUTION (approximate):\n{weights_summary}\n\n"
        "AVAILABLE TEMPLATES:\n"
        f"Allowed visual types: {allowed_templates_str}\n"
        f"{rig_action_str}\n"
        f"{typography_str}\n"
        "Camera styles (for broll/ai_image scenes): pan_left_slow, pan_right_slow, zoom_in_slow, zoom_out_slow, static_hold\n\n"
        f"OUTLINE TO FOLLOW:\n{outline}\n\n"
        "Output a JSON object with this exact structure:\n"
        "{\n"
        '  "title": "string",\n'
        '  "scenes": [\n'
        "    {\n"
        '      "sequence_number": 1,\n'
        '      "script_segment": "string — narration text for this scene",\n'
        '      "visual_type": "character_animation | broll | ai_image | kinetic_typography",\n'
        '      "animation_action": "string | null — only for character_animation",\n'
        '      "camera_style": "string | null — only for broll or ai_image",\n'
        '      "typography_template": "string | null — only for kinetic_typography",\n'
        '      "background_broll_url": null,\n'
        '      "transition": "fade | cut | wipe",\n'
        '      "emotional_tone": "string",\n'
        '      "broll_search_keywords": "string | null — comma-separated keywords for stock search",\n'
        '      "visual_prompt": "string | null — only for ai_image, detailed generation prompt"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"Divide the script into scenes where each scene represents a distinct visual beat ({min_cut}-{max_cut} seconds of content)."
    )

    return RenderedPrompt(system_prompt=system_prompt, user_prompt=user_prompt)
