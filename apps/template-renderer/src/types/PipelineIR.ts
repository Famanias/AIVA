/**
 * The Intermediate Representation (IR) of the generated content.
 * This is the final output of the AI pipeline before timeline generation.
 */
export interface PipelineIR {
  version: 1
  templateFamily: string
  metadata: {
    projectId: string
    jobId: string
    topic: string
    canvasConfig?: {
      width?: number
      height?: number
      fps?: number
      aspectRatio?: string
    }
  }
  voice: {
    wordTimings: Array<{
      word: string
      start: number
      end: number
    }>
    audioUrl?: string
    masterDurationSec?: number
    master_duration_sec?: number
  }

  scenes: Array<{
    id: string
    text: string
    visual_type: string
    action?: string
    transition?: string
    assetQuery?: string
    assetUrl?: string
    duration?: number
  }>
}
