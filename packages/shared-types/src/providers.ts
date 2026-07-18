// =============================================================================
// Provider Interfaces
// All external services must implement one of these interfaces.
// Business logic depends only on these abstractions — never on concrete SDKs.
// See EDD §32 and RULES Rule 5.
// =============================================================================

import type { WordTiming, VideoStyle } from './types.js';

// =============================================================================
// LLM Provider
// =============================================================================

export interface ILLMProvider {
  /**
   * Generate free-form text from a prompt.
   */
  generateText(prompt: string, systemPrompt?: string): Promise<string>;

  /**
   * Generate structured JSON output conforming to the given schema.
   * The provider is responsible for enforcing the schema (e.g., via tool use
   * or json_mode if available).
   */
  generateJSON<T>(prompt: string, systemPrompt: string, jsonSchema: object): Promise<T>;
}

// =============================================================================
// Director Agent Interface
// Kept separate per EDD §16.1 — the combined Script+Director call implements
// this interface implicitly, but it can be split into a standalone call for
// styles that need richer shot-planning in future phases.
// =============================================================================

export interface SceneDirectionResult {
  visualType: string;
  animationAction?: string;
  cameraStyle?: string;
  typographyTemplate?: string;
  transition: string;
  emotionalTone: string;
}

export interface IDirectorAgent {
  directScene(
    sceneText: string,
    style: VideoStyle,
    allowedTemplates: string[]
  ): Promise<SceneDirectionResult>;
}

// =============================================================================
// TTS Provider
// =============================================================================

export interface TTSSynthesisResult {
  audioUrl: string;
  wordTimings: WordTiming[];
  durationSec: number;
}

export interface ITTSProvider {
  /**
   * Synthesize speech for the given text using the specified voice.
   * Returns a URL to the audio file and word-level timing data.
   */
  synthesize(text: string, voiceId: string): Promise<TTSSynthesisResult>;

  /**
   * List available voice IDs for this provider.
   */
  listVoices(): Promise<string[]>;
}

// =============================================================================
// Stock Media Provider
// =============================================================================

export interface StockClip {
  id: string;
  url: string;
  previewUrl: string;
  durationSec: number;
  width: number;
  height: number;
  tags: string[];
  provider: string;
}

export interface IStockProvider {
  /**
   * Search for stock video clips matching the given keywords.
   * Returns clips with duration >= minDurationSec.
   */
  search(keywords: string, minDurationSec: number): Promise<StockClip[]>;
}

// =============================================================================
// Image Generation Provider
// =============================================================================

export type ImageGenerationStyle = 'photorealistic' | 'flat_vector_bg' | 'archival';

export interface IImageProvider {
  /**
   * Generate an image from a text prompt.
   * Returns a URL to the generated image.
   */
  generate(prompt: string, style: ImageGenerationStyle): Promise<string>;
}

// =============================================================================
// Animation Renderer
// =============================================================================

export interface IAnimationRenderer {
  /**
   * Render a single scene to a WebM file (VP9, alpha channel).
   *
   * @param templateFamily - 'character_rig' | 'ken_burns' | 'kinetic_typography'
   * @param templateRef    - Path to the Remotion composition component
   * @param params         - Template-specific render parameters
   * @param wordTimings    - Voiceover word timestamps for animation sync
   * @returns URL to the rendered WebM segment
   */
  renderScene(
    templateFamily: string,
    templateRef: string,
    params: object,
    wordTimings: WordTiming[]
  ): Promise<string>;
}

// =============================================================================
// Storage Provider
// =============================================================================

export interface IStorageProvider {
  /**
   * Upload a file from a local path to storage.
   * Returns the public or signed URL.
   */
  upload(localPath: string, storagePath: string): Promise<string>;

  /**
   * Generate a signed URL for private asset access.
   */
  getSignedUrl(storagePath: string, expiresInSeconds: number): Promise<string>;

  /**
   * Delete a file from storage.
   */
  delete(storagePath: string): Promise<void>;
}

// =============================================================================
// Web Search Provider (Research Agent)
// =============================================================================

export interface SearchResult {
  title: string;
  url: string;
  excerpt: string;
  score?: number;
}

export interface ISearchProvider {
  /**
   * Search the web for the given query.
   * Returns a ranked list of results.
   */
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

// =============================================================================
// Publisher (P3 — interface defined in P1 for future compatibility)
// =============================================================================

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
}

export interface OAuthRef {
  provider: 'youtube' | 'google_drive';
  encryptedTokenRef: string;
}

export interface IPublisher {
  upload(
    videoPath: string,
    metadata: VideoMetadata,
    channelCredentials: OAuthRef
  ): Promise<string>;
}
