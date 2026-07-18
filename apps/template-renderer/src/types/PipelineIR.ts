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
  }
  voice: {
    wordTimings: Array<{
      word: string
      start: number
      end: number
    }>
    audioUrl?: string
  }
  scenes: Array<{
    id: string
    text: string
    visual_type: string
    action?: string
    transition?: string
    assetQuery?: string
    assetUrl?: string
  }>
}
