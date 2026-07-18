import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { WorkerGateway } from '../WorkerGateway'

export class VoiceoverHandler extends BaseHandler {
  async execute(context: PipelineContext): Promise<void> {
    const state = context.getState()

    if (!state.scenes || state.scenes.length === 0) {
      throw new Error('VoiceoverHandler requires populated scenes from the script stage.')
    }

    context.log('Dispatching job to Python Voiceover Worker...')
    
    const response = await WorkerGateway.post('/pipeline/voiceover', {
      trace_id: state.job.id,
      project_id: state.project.id,
      workspace_id: 'default',
      scenes: state.scenes,
      voice_id: 'en-US-AriaNeural'
    }, {
      timeoutMs: 5 * 60 * 1000
    })

    if (response.status !== 'success') {
      throw new Error(`Voiceover generation failed: ${response.error || 'Unknown error'}`)
    }

    // Initialize voice object if missing
    const updatedState = { ...state }
    if (!updatedState.voice) {
      updatedState.voice = {}
    }

    // Assign the generated audio path to state
    updatedState.voice.audioUrl = response.data.voiceover_url
    
    // Some endpoints return the scene voiceovers object needed for subtitles
    if (response.data.scene_voiceovers) {
      updatedState.voice.scene_voiceovers = response.data.scene_voiceovers
    }

    context.updateState(updatedState)
    context.log(`Voiceover generated successfully: ${updatedState.voice.audioUrl}`)
  }
}
