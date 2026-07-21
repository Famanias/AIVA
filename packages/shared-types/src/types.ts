// =============================================================================
// Domain Enums
// Mirror of PostgreSQL enum types defined in packages/database/migrations/
// =============================================================================

export type VideoStatus =
  | 'draft'
  | 'queued'
  | 'generating'
  | 'awaiting_approval'
  | 'rendered'
  | 'failed'
  | 'completed';

export type JobStep =
  | 'research'
  | 'outline'
  | 'script_direction'
  | 'brand_safety_check'
  | 'voiceover'
  | 'subtitle_extraction'
  | 'scene_preview'
  | 'scene_render'
  | 'composition'
  | 'rendering'
  | 'thumbnail'
  | 'metadata'
  | 'cost_reconciliation'
  | 'upload'
  | 'notify';

export type SceneVisualType =
  | 'character_animation'
  | 'broll'
  | 'ai_image'
  | 'kinetic_typography'
  | 'avatar';

export type VideoStyle =
  | 'stickman_animation'
  | 'documentary'
  | 'kinetic_typography'
  | 'avatar_narration'
  | 'mixed_custom';

export type RigStyle = 'stickman' | 'branded_character';

// =============================================================================
// Generation Profiles (EDD §4.3)
// Parameterize every pipeline execution without hardcoding assumptions.
// =============================================================================

export type ContentStrategy = 'short_form' | 'long_form';

/**
 * Describes the pacing constraints for a GenerationProfile.
 * Used by the prompt library to guide the LLM without hardcoded scene counts.
 */
export interface PacingStrategy {
  /** Suggested seconds between new visual cuts */
  visualCutIntervalSeconds: [number, number];
  /** Hook must land within this many seconds */
  hookWithinSeconds: number;
  /** Approximate words per minute for narration */
  wordsPerMinute: number;
}

/**
 * Platform-specific rendering and export constraints.
 * The renderer consumes this to derive resolution, safe margins, etc.
 */
export interface PlatformProfile {
  platform: 'youtube_shorts' | 'tiktok' | 'instagram_reels' | 'youtube' | 'generic';
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  fps: number;
  /** Subtitle style recommended for this platform */
  subtitleStyle: 'bottom_center_large' | 'center_karaoke' | 'standard';
  /** CTA placement recommendation */
  ctaPlacement: 'end_screen' | 'overlay_mid' | 'none';
}

/**
 * First-class domain model. Parameterizes every pipeline execution.
 * Workers consume this instead of hardcoded duration/aspect ratio assumptions.
 * Phase 1 ships with SHORT_FORM_PROFILE as the default.
 */
export interface GenerationProfile {
  /** Which content strategy chain to use */
  contentStrategy: ContentStrategy;
  /** Target duration in seconds */
  targetDurationSeconds: number;
  /** Allowed range in seconds */
  minDurationSeconds: number;
  maxDurationSeconds: number;
  pacing: PacingStrategy;
  platform: PlatformProfile;
  /** Narrative style hint passed to the LLM */
  narrativeStyle: string;
}

// ---------------------------------------------------------------------------
// Phase 1 Default: Short-Form Profile
// ---------------------------------------------------------------------------

export const YOUTUBE_SHORTS_PLATFORM: PlatformProfile = {
  platform: 'youtube_shorts',
  aspectRatio: '9:16',
  width: 1080,
  height: 1920,
  fps: 30,
  subtitleStyle: 'center_karaoke',
  ctaPlacement: 'end_screen',
}

export const SHORT_FORM_PACING: PacingStrategy = {
  visualCutIntervalSeconds: [2, 6],
  hookWithinSeconds: 3,
  wordsPerMinute: 150,
}

export const SHORT_FORM_PROFILE: GenerationProfile = {
  contentStrategy: 'short_form',
  targetDurationSeconds: 60,
  minDurationSeconds: 30,
  maxDurationSeconds: 120,
  pacing: SHORT_FORM_PACING,
  platform: YOUTUBE_SHORTS_PLATFORM,
  narrativeStyle: 'Fast-paced, hook-driven, high-retention. Lead with the most surprising fact. Every sentence must earn attention.',
}



// =============================================================================
// Voice & Subtitle
// =============================================================================

/**
 * Word-level timing from Faster-Whisper or TTS provider.
 * Used to sync animation keyframes and typography reveals to voiceover.
 */
export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number;   // seconds
}

// =============================================================================
// Animation & Rendering
// =============================================================================

/**
 * Camera/motion style for broll and ai_image scenes.
 * Matches camera_style values from EDD §19.2.
 */
export type CameraStyle =
  | 'pan_left_slow'
  | 'pan_right_slow'
  | 'zoom_in_slow'
  | 'zoom_out_slow'
  | 'static_hold';

/**
 * The direction decisions for a single scene, produced by the Script+Director Agent.
 * Stored on scene_versions rows.
 */
export interface SceneDirection {
  scriptSegment: string;
  visualType: SceneVisualType;
  /** Used when visualType = 'character_animation' */
  animationAction?: string;
  /** Used when visualType = 'broll' or 'ai_image' */
  cameraStyle?: CameraStyle;
  /** Used when visualType = 'kinetic_typography' */
  typographyTemplate?: string;
  transition: string;
  emotionalTone: string;
  brollSearchKeywords?: string;
  /** Used when visualType = 'ai_image' */
  visualPrompt?: string;
}

/**
 * A single rig action definition within a rig's config.
 */
export interface RigAction {
  keyframesRef: string;
  loopable: boolean;
  syncsTo: 'phoneme' | 'beat' | 'emphasis_word' | 'none';
}

/**
 * The JSON structure stored in animation_rigs.rig_config.
 */
export interface RigConfig {
  skeleton: {
    joints: string[];
    boneLengthsPx: Record<string, number>;
  };
  palette: {
    stroke: string;
    fill: string;
    accent: string;
  };
  componentRef: string;
  actions: Record<string, RigAction>;
}

/**
 * Parameters passed to IAnimationRenderer.renderScene()
 * for a character_animation scene.
 */
export interface CharacterRigRenderParams {
  rigConfig: RigConfig;
  action: string;
  backgroundBrollUrl?: string;
  durationSec: number;
  wordTimings: WordTiming[];
}

/**
 * Parameters passed to IAnimationRenderer.renderScene()
 * for a broll or ai_image scene.
 */
export interface KenBurnsRenderParams {
  mediaUrl: string;
  cameraStyle: CameraStyle;
  durationSec: number;
  lowerThirdText?: string;
}

// =============================================================================
// Database Entities (read models — shaped for API responses)
// =============================================================================

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  plan: string;
  monthlyCostCapUsd: number;
  createdAt: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  topic: string;
  language: string;
  videoStyle: VideoStyle;
  status: VideoStatus;
  costAccumulated: number;
  durationTargetMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  projectId: string;
  sequenceNumber: number;
  currentVersionId: string | null;
  voiceoverUrl: string | null;
  voiceoverWordTimings: WordTiming[] | null;
  renderUrl: string | null;
  renderStatus: VideoStatus;
  duration: number;
  createdAt: string;
}

export interface SceneVersion {
  id: string;
  sceneId: string;
  versionNumber: number;
  scriptSegment: string;
  visualType: SceneVisualType;
  animationRigId: string | null;
  animationAction: string | null;
  typographyTemplate: string | null;
  cameraStyle: string | null;
  backgroundBrollUrl: string | null;
  transition: string;
  emotionalTone: string | null;
  brollSearchKeywords: string | null;
  visualPrompt: string | null;
  createdAt: string;
}

export interface AnimationRig {
  id: string;
  name: string;
  style: RigStyle;
  availableActions: string[];
  rigConfig: RigConfig;
  version: number;
  createdAt: string;
}

export interface VideoStylePreset {
  id: string;
  style: VideoStyle;
  name: string;
  visualTypeWeights: Record<SceneVisualType, number>;
  defaultRigId: string | null;
  defaultCameraPacing: 'slow' | 'medium' | 'fast';
  defaultTransition: string;
  allowSceneOverride: boolean;
  createdAt: string;
}

export interface Job {
  id: string;
  projectId: string;
  currentStep: JobStep;
  progress: number;
  attemptCount: number;
  errorLog: string | null;
  statePayload: Record<string, unknown> | null;
  updatedAt: string;
}

export interface CostLedgerEntry {
  id: string;
  projectId: string;
  jobStep: JobStep;
  provider: string;
  amountUsd: number;
  unitsConsumed: number | null;
  createdAt: string;
}

// =============================================================================
// API Payloads
// =============================================================================

export interface CreateProjectPayload {
  topic: string;
  videoStyle: VideoStyle;
  /** @deprecated Use generationProfile.targetDurationSeconds instead. Kept for backward compat. */
  durationTargetMinutes?: number;
  language?: string;
  /** Optional — defaults to SHORT_FORM_PROFILE if not supplied. */
  generationProfile?: GenerationProfile;
}

export interface ProjectStatusResponse {
  project: Project;
  job: Job | null;
}

// =============================================================================
// Pipeline State Payload
// Stored in jobs.state_payload — allows resuming from any stage.
// =============================================================================

export interface PipelineStatePayload {
  traceId: string;
  workspaceId: string;
  stylePresetId: string;
  rigId?: string;
  /**
   * The GenerationProfile active for this pipeline run.
   * Defaults to SHORT_FORM_PROFILE if not explicitly set.
   */
  generationProfile?: GenerationProfile;
  /** Populated after research stage */
  researchSources?: ResearchSource[];
  /** Populated after outline stage */
  outline?: OutlinePoint[];
  /** Populated after script_direction stage */
  sceneDirections?: SceneDirection[];
  /** Populated after voiceover stage */
  masterVoiceoverUrl?: string;
  /** Populated after composition stage */
  timelineJson?: VideoTimeline;
  /** Populated after rendering stage */
  finalVideoUrl?: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  excerpt: string;
}

export interface OutlinePoint {
  index: number;
  heading: string;
  keyPoints: string[];
}

export interface VideoTimeline {
  dimensions: { width: number; height: number; fps: number };
  audioTracks: AudioTrack[];
  videoTracks: VideoTrack[];
}

export interface AudioTrack {
  id: string;
  file: string;
  volume: number;
  ducking?: { threshold: number };
}

export interface VideoTrack {
  scene: number;
  type: SceneVisualType;
  file: string;
  backgroundBroll?: string | null;
  start: number;
  end: number;
  transition: string;
}
