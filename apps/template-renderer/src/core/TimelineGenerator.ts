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

  // Calculate scenes timeline based on scene duration or word timings
  const scenes: Scene[] = []
  
  let totalDurationInFrames = lastEndFrame > 0 ? lastEndFrame : 30 * fps // fallback to 30s
  
  if (ir.scenes.length > 0) {
    const hasExplicitDurations = ir.scenes.some(s => typeof s.duration === 'number' && s.duration > 0)
    let currentStartFrame = 0
    
    ir.scenes.forEach((irScene, index) => {
      const isLast = index === ir.scenes.length - 1
      let durationInFrames = 0

      if (hasExplicitDurations && typeof irScene.duration === 'number' && irScene.duration > 0) {
        durationInFrames = Math.max(1, Math.round(irScene.duration * fps))
      } else {
        const framesPerScene = Math.floor(totalDurationInFrames / ir.scenes.length)
        durationInFrames = isLast 
          ? Math.max(1, totalDurationInFrames - currentStartFrame) 
          : framesPerScene
      }

      scenes.push({
        id: irScene.id,
        startFrame: currentStartFrame,
        durationInFrames,
        assetUrl: irScene.assetUrl,
        transition: irScene.transition,
        characterAction: irScene.action
      })

      currentStartFrame += durationInFrames
    })

    if (hasExplicitDurations && currentStartFrame > 0) {
      totalDurationInFrames = Math.max(totalDurationInFrames, currentStartFrame)
    }
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
