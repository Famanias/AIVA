import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'
import { query } from '@aiva/database'

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

    if (response.data.voiceovers && Array.isArray(response.data.voiceovers)) {
      updatedState.voice.scene_voiceovers = response.data.voiceovers
      // Set audioUrl to the full multi-scene master voice track
      updatedState.voice.audioUrl = response.data.master_audio_url || response.data.voiceovers[0]?.audio_url
      updatedState.voice.master_audio_url = response.data.master_audio_url || response.data.voiceovers[0]?.audio_url

      // Update voiceover_url and duration on public.scenes in PostgreSQL
      for (const [idx, vo] of response.data.voiceovers.entries()) {
        const seq = Number(vo.sequence_number || (idx + 1))
        const duration = Number(vo.duration || 0)
        const audioUrl = vo.audio_url || vo.audioUrl || null
        await query(
          `UPDATE public.scenes 
           SET voiceover_url = COALESCE($1, voiceover_url), 
               duration = CASE WHEN $2 > 0 THEN $2 ELSE duration END,
               render_status = 'generating'
           WHERE project_id = $3 AND sequence_number = $4`,
          [audioUrl, duration, context.project.id, seq]
        )
      }
    }

    Object.assign(context.state, updatedState)
    await context.logger.info(`Voiceover generated successfully: ${updatedState.voice.audioUrl}`)

    return 'subtitle_extraction'
  }
}
