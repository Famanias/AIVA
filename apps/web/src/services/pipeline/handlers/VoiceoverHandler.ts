import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'

export class VoiceoverHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 15 * 60 * 1000 // 15 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    if (!state.scenes || state.scenes.length === 0) {
      throw new Error('VoiceoverHandler requires populated scenes from the script stage.')
    }

    const voiceId = context.generationProfile?.voice_id || (state as any).voice_id || (state as any).generationProfile?.voice_id || 'en-US-AriaNeural'
    
    await context.logger.info(`Dispatching job to Python Voiceover Worker with voice: ${voiceId}...`)
    
    const response = await workerGateway.execute<any>('/pipeline/voiceover', {
      trace_id: context.job.id,
      project_id: context.project.id,
      scenes: state.scenes,
      voice_id: voiceId
    }, 5 * 60 * 1000)

    if (response.status !== 'success') {
      throw new Error(`Voiceover generation failed: ${response.error || 'Unknown error'}`)
    }

    // Initialize voice object if missing
    const updatedState = { ...state }
    if (!updatedState.voice) {
      updatedState.voice = {}
    }

    if (response.data.voiceovers) {
      updatedState.voice.scene_voiceovers = response.data.voiceovers
      // Just take the first one for logging if needed
      updatedState.voice.audioUrl = response.data.voiceovers[0]?.audio_url
    }

    Object.assign(context.state, updatedState)
    await context.logger.info(`Voiceover generated successfully: ${updatedState.voice.audioUrl}`)

    return 'subtitle_extraction'
  }
}
