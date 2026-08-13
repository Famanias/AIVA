import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'
import { query } from '@aiva/database'

export class SubtitleHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 5 * 60 * 1000 // 5 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    if (!state.voice?.scene_voiceovers || state.voice.scene_voiceovers.length === 0) {
      throw new Error('SubtitleHandler requires scene_voiceovers from the voice stage.')
    }

    await context.logger.info('Dispatching job to Python Subtitle Extraction Worker...')
    
    const response = await workerGateway.execute<any>('/pipeline/subtitle_extraction', {
      trace_id: context.job.id,
      project_id: context.project.id,
      scene_voiceovers: state.voice.scene_voiceovers
    }, 5 * 60 * 1000)

    if (response.status !== 'success') {
      throw new Error(`Subtitle extraction failed: ${response.error || 'Unknown error'}`)
    }

    const updatedState = { ...state }
    
    // Assign subtitles to state
    updatedState.voice.subtitles = response.data.subtitles

    // Persist word timings to public.scenes in PostgreSQL
    if (Array.isArray(response.data.subtitles)) {
      for (const [idx, sub] of response.data.subtitles.entries()) {
        const seq = Number(sub.sequence_number || (idx + 1))
        const timings = sub.word_timings || sub.wordTimings || sub
        await query(
          `UPDATE public.scenes
           SET voiceover_word_timings = $1
           WHERE project_id = $2 AND sequence_number = $3`,
          [JSON.stringify(timings), context.project.id, seq]
        )
      }
    }

    Object.assign(context.state, updatedState)
    await context.logger.info(`Subtitle extraction completed successfully. Extracted ${response.data.subtitles?.length || 0} scenes.`)

    return 'assets'
  }
}
