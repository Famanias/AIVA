import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'

export class CompositionHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 5 * 60 * 1000 // 5 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    // 1. Validate Prerequisite State
    if (!state.render?.outputUrl) {
      throw new Error('CompositionHandler requires the Remotion visual overlay (render.outputUrl).')
    }

    await context.logger.info('Dispatching PipelineState to FFmpeg Composition Engine...')

    // 2. Map PipelineState to CompositionModel contract
    // We assume state.assets holds the background references from Milestone 8
    const compositionModel = {
      trace_id: context.job.id,
      project_id: context.project.id,
      job_id: context.job.id,
      overlay_track: {
        id: 'remotion_overlay',
        type: 'video',
        storage_key: state.render.outputUrl,
        duration: state.scenes.reduce((acc: number, s: any) => acc + (s.duration || 0), 0),
        mime_type: 'video/webm'
      },
      background_tracks: state.scenes
        .filter((s: any) => s.asset_manifest?.background?.storage_key)
        .map((s: any) => ({
          id: s.id,
          type: 'video',
          storage_key: s.asset_manifest.background.storage_key,
          duration: s.duration,
          mime_type: 'video/mp4'
        })),
      voice_track: state.voice?.audioUrl ? {
        id: 'voice_main',
        type: 'audio',
        storage_key: state.voice.audioUrl,
        duration: 0, // Ignored by FFmpeg mixer as it aligns to video
        mime_type: 'audio/wav'
      } : null,
      music_track: null, // Placeholder for MVP
      sfx_tracks: [],
      word_timings: state.voice?.wordTimings || [],
      output_settings: {
        codec: 'h264',
        hardware_acceleration: 'auto',
        bitrate: '8M',
        preset: 'fast',
        resolution: '1080x1920',
        fps: 30
      }
    }
    
    // 3. Dispatch
    const response = await workerGateway.execute<any>('/composition/composite', compositionModel, 15 * 60 * 1000)

    if (response.status !== 'success') {
      throw new Error(`Composition failed: ${response.error || 'Unknown error'}`)
    }

    // 4. Update State
    Object.assign(context.state, {
      ...state,
      composition: {
        outputUrl: response.data.output_reference.storage_key,
        renderTimeMs: response.data.render_time_ms,
        manifestUrl: response.data.manifest_url,
        warnings: response.data.warnings,
        completedAt: new Date().toISOString()
      }
    })

    await context.logger.info(`Final Composition generated successfully: ${response.data.output_reference.storage_key}`)

    return null // Last stage
  }
}
