import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'
import { PipelineIR } from '../../../../../template-renderer/src/types/PipelineIR'

export class RenderHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 10 * 60 * 1000 // 10 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    const stateAny = state as Record<string, any>
    const scenes = state.scenes || state.sceneDirections || state.script?.sceneDirections || stateAny['03_script']?.sceneDirections || []
    const voice = state.voice || stateAny['04_voice'] || {}

    // 1. Validate Prerequisite State
    if (scenes.length === 0) {
      await context.logger.info('Rendering skipped: No scene directions found in state.')
      return null // Gracefully exit to prevent BullMQ retry loops
    }

    let style = (context.project as any).video_style || 'stickman'
    if (style === 'stickman_animation') style = 'stickman'

    const wordTimings = voice.wordTimings || voice.word_timings || stateAny['05_subtitles']?.subtitles || []
    const audioUrl = voice.audioUrl || (Array.isArray(voice.voiceovers) && voice.voiceovers[0]?.audio_url) || ''

    const profile = (context.project as any)?.generation_profile || {}
    const aspectRatio = profile.target_aspect_ratio || '9:16'
    let width = 1080
    let height = 1920

    if (aspectRatio === '16:9') {
      width = 1920
      height = 1080
    } else if (aspectRatio === '1:1') {
      width = 1080
      height = 1080
    }

    // 2. Package into Version 1 PipelineIR
    const ir: PipelineIR = {
      version: 1,
      templateFamily: style,
      metadata: {
        projectId: context.project.id,
        jobId: context.job.id,
        topic: context.project.topic,
        canvasConfig: {
          width,
          height,
          aspectRatio,
          fps: 30
        }
      },
      voice: {
        wordTimings,
        audioUrl
      },
      scenes: scenes.map((s: any) => ({
        id: String(s.sequence_number || s.id || 1),
        text: s.scriptSegment || s.text || '',
        visual_type: s.visualType || s.visual_type || 'stickman_action',
        action: s.animationAction || s.action || 'standing',
        transition: s.transition || 'fade',
        assetUrl: s.assetUrl
      }))
    }

    // 3. Dispatch to Template Renderer via WorkerGateway
    // The Template Renderer is a distinct worker (Node.js instead of Python)
    // We treat it identically in the orchestration layer
    const renderUrl = process.env.TEMPLATE_RENDERER_URL || 'http://localhost:3001'
    
    await context.logger.info(`Dispatching PipelineIR to Render Engine: ${renderUrl}/render`)
    
    const response = await workerGateway.execute<any>(`${renderUrl}/render`, ir, 10 * 60 * 1000)

    if (response.status !== 'success') {
      throw new Error(`Rendering failed: ${response.error || 'Unknown error'}`)
    }

    // 4. Update Pipeline State with Render Result
    Object.assign(context.state, {
      ...state,
      render: {
        outputUrl: response.result.outputs?.video,
        metrics: response.result.metrics,
        completedAt: new Date().toISOString()
      }
    })

    await context.logger.info(`Rendering completed successfully: ${response.result.outputs?.video}`)
    
    return 'composition'
  }
}
