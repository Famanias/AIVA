import { PipelineIR } from '../types/PipelineIR'
import { RenderConfig } from './RenderConfig'
import { CompositionModel, Scene, Subtitle } from '../types/CompositionModel'

/**
 * Pure function to map the Pipeline Intermediate Representation (IR) 
 * into a timeline of absolute frames for rendering.
 */
export function generateTimeline(ir: PipelineIR, config: RenderConfig): CompositionModel {
  const fps = config.fps
  const subtitles: Subtitle[] = []
  
  // Calculate absolute frames for each word
  let lastEndFrame = 0
  for (const word of ir.voice.wordTimings) {
    const startFrame = Math.floor(word.start * fps)
    const endFrame = Math.ceil(word.end * fps)
    const durationInFrames = Math.max(1, endFrame - startFrame)
    
    subtitles.push({
      text: word.word,
      startFrame,
      durationInFrames
    })
    lastEndFrame = Math.max(lastEndFrame, endFrame)
  }

  // Calculate scenes timeline based on word timings (MVP: equal distribution or derived from chunks)
  // For P1, we assume the IR has pre-segmented the text, but the IR doesn't have exact scene timings yet.
  // We'll distribute the scenes evenly across the total duration for now.
  const scenes: Scene[] = []
  
  const totalDurationInFrames = lastEndFrame > 0 ? lastEndFrame : 30 * fps // fallback to 30s
  
  if (ir.scenes.length > 0) {
    const framesPerScene = Math.floor(totalDurationInFrames / ir.scenes.length)
    
    ir.scenes.forEach((irScene, index) => {
      const isLast = index === ir.scenes.length - 1
      const startFrame = index * framesPerScene
      // Give remainder frames to the last scene
      const durationInFrames = isLast 
        ? totalDurationInFrames - startFrame 
        : framesPerScene

      scenes.push({
        id: irScene.id,
        startFrame,
        durationInFrames,
        assetUrl: irScene.assetUrl,
        transition: irScene.transition,
        characterAction: irScene.action
      })
    })
  }

  return {
    version: 1,
    totalDurationInFrames: Math.max(totalDurationInFrames, 1),
    fps,
    width: config.width,
    height: config.height,
    audioUrl: ir.voice.audioUrl,
    scenes,
    subtitles
  }
}
