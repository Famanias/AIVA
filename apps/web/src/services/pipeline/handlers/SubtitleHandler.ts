import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { WorkerGateway } from '../WorkerGateway'

export class SubtitleHandler extends BaseHandler {
  async execute(context: PipelineContext): Promise<void> {
    const state = context.getState()

    if (!state.voice?.scene_voiceovers || state.voice.scene_voiceovers.length === 0) {
      throw new Error('SubtitleHandler requires scene_voiceovers from the voice stage.')
    }

    context.log('Dispatching job to Python Subtitle Extraction Worker...')
    
    const response = await WorkerGateway.post('/pipeline/subtitle_extraction', {
      trace_id: state.job.id,
      project_id: state.project.id,
      workspace_id: 'default',
      scene_voiceovers: state.voice.scene_voiceovers
    }, {
      timeoutMs: 5 * 60 * 1000
    })

    if (response.status !== 'success') {
      throw new Error(`Subtitle extraction failed: ${response.error || 'Unknown error'}`)
    }

    const updatedState = { ...state }
    
    // Assign word timings to state
    updatedState.voice.wordTimings = response.data.wordTimings

    context.updateState(updatedState)
    context.log(`Subtitle extraction completed successfully. Extracted ${response.data.wordTimings?.length || 0} words.`)
  }
}
