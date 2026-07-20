from dataclasses import dataclass

@dataclass
class RenderedPrompt:
    system_prompt: str
    user_prompt: str

def build_research_synthesis_prompt(topic: str, sources_text: str, language: str) -> RenderedPrompt:
    system_prompt = (
        "You are an expert research assistant helping to produce a high-quality YouTube video script.\n"
        "Your task is to synthesize raw web search results into a cohesive research summary.\n"
        "Focus on facts, statistics, stories, and examples that would make compelling video content.\n"
        "Cite your sources clearly. Be concise and factual. Do not editorialize."
    )
    user_prompt = (
        f"Synthesize the following web search results for a YouTube video about \"{topic}\".\n\n"
        f"SOURCES:\n{sources_text}\n\n"
        f"Language: {language}\n\n"
        "Provide a comprehensive summary of key findings with supporting details. For each finding, include:\n"
        "- The key fact or story\n"
        "- Why it is relevant and engaging for a YouTube audience\n"
        "- Any statistics, dates, or notable examples\n\n"
        "Format as a structured list. Be thorough but concise."
    )
    return RenderedPrompt(system_prompt=system_prompt, user_prompt=user_prompt)

def build_outline_prompt(topic: str, video_style: str, duration_target_minutes: int, language: str, research_summary: str) -> RenderedPrompt:
    style_guidance = {
        "stickman_animation": "Structure the outline around scene beats and emotional moments. Each point should describe a clear narrative beat (setup, conflict, resolution). Favor dramatic, relatable, story-driven structure.",
        "documentary": "Structure the outline chronologically or causally. Each point should cover a distinct chapter of the story — origins, development, consequences. Favor factual, educational flow.",
        "kinetic_typography": "Structure as a punchy listicle or fast-paced fact delivery. Each point should be a self-contained insight or revelation. Favor brevity and impact.",
        "avatar_narration": "Structure as a professional presentation. Each point should be a clear topic section with a defined takeaway. Favor clarity and authority.",
        "mixed_custom": "Structure freely based on what best serves the topic. No style constraints.",
    }
    
    guidance = style_guidance.get(video_style, style_guidance["stickman_animation"])

    system_prompt = (
        "You are an expert YouTube video scriptwriter and content strategist.\n"
        "Your task is to create a detailed, engaging video outline that will be used to write a full script.\n"
        "The outline must be appropriate for the specified video style and duration target.\n"
        "Output only valid JSON — no markdown, no preamble, no explanation."
    )

    user_prompt = (
        f"Create a video outline for the following topic.\n\n"
        f"TOPIC: {topic}\n"
        f"VIDEO STYLE: {video_style}\n"
        f"TARGET DURATION: {duration_target_minutes} minutes (~{duration_target_minutes * 150} words)\n"
        f"LANGUAGE: {language}\n\n"
        f"STYLE GUIDANCE: {guidance}\n\n"
        f"RESEARCH SUMMARY:\n{research_summary}\n\n"
        "Output a JSON object with this exact structure:\n"
        "{\n"
        '  "title": "string — engaging video title",\n'
        '  "hook": "string — 1-2 sentence hook for the opening scene",\n'
        '  "points": [\n'
        "    {\n"
        '      "index": 0,\n'
        '      "heading": "string — section title",\n'
        '      "keyPoints": ["string", "string", "string"]\n'
        "    }\n"
        "  ],\n"
        '  "conclusion": "string — 1-2 sentence call-to-action / closing"\n'
        "}\n\n"
        f"Include 8-12 outline points appropriate for a {duration_target_minutes}-minute video."
    )
    return RenderedPrompt(system_prompt=system_prompt, user_prompt=user_prompt)

def build_script_director_prompt(
    topic: str,
    language: str,
    video_style: str,
    visual_type_weights: dict[str, float],
    allowed_templates: list[str],
    default_camera_pacing: str,
    duration_target_minutes: int,
    approx_word_count: int,
    rig_action_list: list[str],
    typography_template_list: list[str],
    outline: str
) -> RenderedPrompt:
    
    weights_summary = ", ".join(f"{k}: {int(v * 100)}%" for k, v in visual_type_weights.items())
    
    system_prompt = (
        f"You are a master YouTube automation-channel scriptwriter and visual director, specializing in high-retention narration in the style requested.\n\n"
        "Your output must strictly conform to valid JSON following the schema provided.\n\n"
        "For every scene, in the SAME PASS as writing the narrative text, decide:\n"
        "- visual_type: constrained to the allowed types for the given style\n"
        "- The appropriate template parameter (animation_action, camera_style, or typography_template)\n"
        "- transition and emotional_tone\n\n"
        "Rules:\n"
        "- Never invent a template parameter not in the provided allowed lists.\n"
        "- Never include markdown code blocks or conversational preamble in your response.\n"
        "- Output only the raw JSON object.\n"
        "- Every scene must have a script_segment of at least 80 words.\n"
        f"- Total word count across all scenes must reach approximately {approx_word_count} words."
    )

    allowed_templates_str = ", ".join(allowed_templates)
    rig_action_str = f"Animation actions (for character_animation scenes): {', '.join(rig_action_list)}" if rig_action_list else ""
    typography_str = f"Typography templates (for kinetic_typography scenes): {', '.join(typography_template_list)}" if typography_template_list else ""

    user_prompt = (
        "Write a complete YouTube video script with visual direction for the following:\n\n"
        f"TOPIC: {topic}\n"
        f"LANGUAGE: {language}\n"
        f"VIDEO STYLE: {video_style}\n"
        f"TARGET DURATION: {duration_target_minutes} minutes (~{approx_word_count} words total)\n"
        f"CAMERA PACING: {default_camera_pacing}\n\n"
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
        '      "script_segment": "string — full narration text for this scene (minimum 80 words)",\n'
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
        "Divide the script into at least 15 granular scenes. Each scene should represent a distinct narrative beat."
    )
    
    return RenderedPrompt(system_prompt=system_prompt, user_prompt=user_prompt)
