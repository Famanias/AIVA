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

    // 1. Validate Prerequisite State
    if (!state.voice?.subtitles || state.scenes.length === 0) {
      await context.logger.info('Rendering skipped: Waiting for user to edit timeline and generate subtitles in Studio UI.')
      return null // Gracefully exit to prevent BullMQ retry loops
    }

    let style = context.project.video_style || 'stickman'
    if (style === 'stickman_animation') style = 'stickman'

    // 2. Package into Version 1 PipelineIR
    const ir: PipelineIR = {
      version: 1,
      templateFamily: style,
      metadata: {
        projectId: context.project.id,
        jobId: context.job.id,
        topic: context.project.topic
      },
      voice: {
        wordTimings: state.voice.subtitles,
        audioUrl: state.voice.audioUrl
      },
      scenes: state.scenes.map((s: any) => ({
        id: s.id,
        text: s.text,
        visual_type: s.visual_type,
        action: s.action,
        transition: s.transition,
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
