// =============================================================================
// Prompt Template System
//
// Prompts are structured objects with typed variable slots.
// They are never hardcoded raw strings inside agent implementations.
// See RULES Rule 7 — Zero Hardcoding.
// =============================================================================

import type { VideoStyle } from '@aiva/shared-types';

// =============================================================================
// Template Types
// =============================================================================

/**
 * A rendered prompt ready to send to an LLM provider.
 */
export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Variables required by the Research Agent prompts.
 */
export interface ResearchPromptVars {
  topic: string;
  outlinePoint: string;
  language: string;
}

/**
 * Variables required by the Outline Agent prompts.
 */
export interface OutlinePromptVars {
  topic: string;
  videoStyle: VideoStyle;
  durationTargetMinutes: number;
  language: string;
  researchSummary: string;
}

/**
 * Variables required by the Script + Director Agent prompts.
 */
export interface ScriptDirectorPromptVars {
  topic: string;
  language: string;
  videoStyle: VideoStyle;
  visualTypeWeights: Record<string, number>;
  allowedTemplates: string[];
  defaultCameraPacing: string;
  durationTargetMinutes: number;
  approxWordCount: number;
  rigActionList: string[];
  typographyTemplateList: string[];
  outline: string;
}

// =============================================================================
// Prompt Builders
// Each builder takes typed variables and returns a RenderedPrompt.
// =============================================================================

/**
 * Research Agent: gather web sources for a single outline point.
 * EDD §16.1, §33
 */
export function buildResearchPrompt(vars: ResearchPromptVars): RenderedPrompt {
  return {
    systemPrompt: `You are an expert research assistant helping to produce a high-quality YouTube video script.
Your task is to find accurate, relevant, and engaging information about a specific topic point.
Focus on facts, statistics, stories, and examples that would make compelling video content.
Cite your sources clearly. Be concise and factual. Do not editorialize.`,

    userPrompt: `Research the following topic point for a YouTube video about "${vars.topic}".

TOPIC POINT TO RESEARCH:
${vars.outlinePoint}

Language: ${vars.language}

Provide 3-5 key findings with supporting details. For each finding, include:
- The key fact or story
- Why it is relevant and engaging for a YouTube audience
- Any statistics, dates, or notable examples

Format as a structured list. Be thorough but concise.`,
  };
}

/**
 * Outline Agent: turn research into a structured video outline.
 * EDD §16.1
 */
export function buildOutlinePrompt(vars: OutlinePromptVars): RenderedPrompt {
  const styleGuidance: Record<VideoStyle, string> = {
    stickman_animation:
      'Structure the outline around scene beats and emotional moments. Each point should describe a clear narrative beat (setup, conflict, resolution). Favor dramatic, relatable, story-driven structure.',
    documentary:
      'Structure the outline chronologically or causally. Each point should cover a distinct chapter of the story — origins, development, consequences. Favor factual, educational flow.',
    kinetic_typography:
      'Structure as a punchy listicle or fast-paced fact delivery. Each point should be a self-contained insight or revelation. Favor brevity and impact.',
    avatar_narration:
      'Structure as a professional presentation. Each point should be a clear topic section with a defined takeaway. Favor clarity and authority.',
    mixed_custom:
      'Structure freely based on what best serves the topic. No style constraints.',
  };

  return {
    systemPrompt: `You are an expert YouTube video scriptwriter and content strategist.
Your task is to create a detailed, engaging video outline that will be used to write a full script.
The outline must be appropriate for the specified video style and duration target.
Output only valid JSON — no markdown, no preamble, no explanation.`,

    userPrompt: `Create a video outline for the following topic.

TOPIC: ${vars.topic}
VIDEO STYLE: ${vars.videoStyle}
TARGET DURATION: ${vars.durationTargetMinutes} minutes (~${vars.durationTargetMinutes * 150} words)
LANGUAGE: ${vars.language}

STYLE GUIDANCE: ${styleGuidance[vars.videoStyle]}

RESEARCH SUMMARY:
${vars.researchSummary}

Output a JSON object with this exact structure:
{
  "title": "string — engaging video title",
  "hook": "string — 1-2 sentence hook for the opening scene",
  "points": [
    {
      "index": 0,
      "heading": "string — section title",
      "keyPoints": ["string", "string", "string"]
    }
  ],
  "conclusion": "string — 1-2 sentence call-to-action / closing"
}

Include 8-12 outline points appropriate for a ${vars.durationTargetMinutes}-minute video.`,
  };
}

/**
 * Script + Director Agent: write the full script AND tag every scene's visual
 * direction in a single combined LLM call.
 * EDD §16.1, §33
 */
export function buildScriptDirectorPrompt(vars: ScriptDirectorPromptVars): RenderedPrompt {
  const weightsSummary = Object.entries(vars.visualTypeWeights)
    .map(([type, weight]) => `${type}: ${Math.round(weight * 100)}%`)
    .join(', ');

  return {
    systemPrompt: `You are a master YouTube automation-channel scriptwriter and visual director, specializing in high-retention narration in the style requested.

Your output must strictly conform to valid JSON following the schema provided.

For every scene, in the SAME PASS as writing the narrative text, decide:
- visual_type: constrained to the allowed types for the given style
- The appropriate template parameter (animation_action, camera_style, or typography_template)
- transition and emotional_tone

Rules:
- Never invent a template parameter not in the provided allowed lists.
- Never include markdown code blocks or conversational preamble in your response.
- Output only the raw JSON object.
- Every scene must have a script_segment of at least 80 words.
- Total word count across all scenes must reach approximately ${vars.approxWordCount} words.`,

    userPrompt: `Write a complete YouTube video script with visual direction for the following:

TOPIC: ${vars.topic}
LANGUAGE: ${vars.language}
VIDEO STYLE: ${vars.videoStyle}
TARGET DURATION: ${vars.durationTargetMinutes} minutes (~${vars.approxWordCount} words total)
CAMERA PACING: ${vars.defaultCameraPacing}

VISUAL TYPE DISTRIBUTION (approximate):
${weightsSummary}

AVAILABLE TEMPLATES:
Allowed visual types: ${vars.allowedTemplates.join(', ')}
${vars.rigActionList.length > 0 ? `Animation actions (for character_animation scenes): ${vars.rigActionList.join(', ')}` : ''}
${vars.typographyTemplateList.length > 0 ? `Typography templates (for kinetic_typography scenes): ${vars.typographyTemplateList.join(', ')}` : ''}
Camera styles (for broll/ai_image scenes): pan_left_slow, pan_right_slow, zoom_in_slow, zoom_out_slow, static_hold

OUTLINE TO FOLLOW:
${vars.outline}

Output a JSON object with this exact structure:
{
  "title": "string",
  "scenes": [
    {
      "sequence_number": 1,
      "script_segment": "string — full narration text for this scene (minimum 80 words)",
      "visual_type": "character_animation | broll | ai_image | kinetic_typography",
      "animation_action": "string | null — only for character_animation",
      "camera_style": "string | null — only for broll or ai_image",
      "typography_template": "string | null — only for kinetic_typography",
      "background_broll_url": null,
      "transition": "fade | cut | wipe",
      "emotional_tone": "string",
      "broll_search_keywords": "string | null — comma-separated keywords for stock search",
      "visual_prompt": "string | null — only for ai_image, detailed generation prompt"
    }
  ]
}

Divide the script into at least 15 granular scenes. Each scene should represent a distinct narrative beat.`,
  };
}

/**
 * Scene Re-direction: re-tag a single edited scene without re-running the full script.
 * EDD §16.3, §33
 */
export interface SceneRedirectionPromptVars {
  sceneText: string;
  videoStyle: VideoStyle;
  allowedTemplates: string[];
  rigActionList: string[];
  typographyTemplateList: string[];
}

export function buildSceneRedirectionPrompt(
  vars: SceneRedirectionPromptVars
): RenderedPrompt {
  return {
    systemPrompt: `You are a visual director for YouTube automation videos.
Given one edited scene's narrative text, its video style, and the allowed template constraints,
re-derive the scene's visual_type and template parameters.
Respond with only the JSON object for this one scene. No markdown, no explanation.`,

    userPrompt: `Re-direct the following scene for a ${vars.videoStyle} video.

SCENE TEXT:
${vars.sceneText}

ALLOWED VISUAL TYPES: ${vars.allowedTemplates.join(', ')}
${vars.rigActionList.length > 0 ? `ANIMATION ACTIONS: ${vars.rigActionList.join(', ')}` : ''}
${vars.typographyTemplateList.length > 0 ? `TYPOGRAPHY TEMPLATES: ${vars.typographyTemplateList.join(', ')}` : ''}
CAMERA STYLES: pan_left_slow, pan_right_slow, zoom_in_slow, zoom_out_slow, static_hold

Output a JSON object:
{
  "visual_type": "string",
  "animation_action": "string | null",
  "camera_style": "string | null",
  "typography_template": "string | null",
  "transition": "string",
  "emotional_tone": "string",
  "broll_search_keywords": "string | null",
  "visual_prompt": "string | null"
}`,
  };
}
