import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { WorkerGateway } from '../WorkerGateway'
import { PipelineIR } from '../../../../../template-renderer/src/types/PipelineIR'

export class RenderHandler extends BaseHandler {
  async execute(context: PipelineContext): Promise<void> {
    const state = context.getState()

    // 1. Validate Prerequisite State
    if (!state.voice?.wordTimings || state.scenes.length === 0) {
      throw new Error('RenderHandler requires populated scenes and voice timings.')
    }

    // 2. Package into Version 1 PipelineIR
    const ir: PipelineIR = {
      version: 1,
      templateFamily: state.project.video_style || 'stickman',
      metadata: {
        projectId: state.project.id,
        jobId: state.job.id,
        topic: state.project.topic
      },
      voice: {
        wordTimings: state.voice.wordTimings,
        audioUrl: state.voice.audioUrl
      },
      scenes: state.scenes.map(s => ({
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
    
    context.log(`Dispatching PipelineIR to Render Engine: ${renderUrl}/render`)
    
    const response = await WorkerGateway.post(`${renderUrl}/render`, ir, {
      timeoutMs: 10 * 60 * 1000 // Rendering can take 10 minutes
    })

    if (response.status !== 'success') {
      throw new Error(`Rendering failed: ${response.error || 'Unknown error'}`)
    }

    // 4. Update Pipeline State with Render Result
    context.updateState({
      ...state,
      render: {
        outputUrl: response.result.outputs?.video,
        metrics: response.result.metrics,
        completedAt: new Date().toISOString()
      }
    })

    context.log(`Rendering completed successfully: ${response.result.outputs?.video}`)
  }
}
