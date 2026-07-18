import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { WorkerGateway } from '../WorkerGateway'

export class CompositionHandler extends BaseHandler {
  async execute(context: PipelineContext): Promise<void> {
    const state = context.getState()

    // 1. Validate Prerequisite State
    if (!state.render?.outputUrl) {
      throw new Error('CompositionHandler requires the Remotion visual overlay (render.outputUrl).')
    }

    context.log('Dispatching PipelineState to FFmpeg Composition Engine...')

    // 2. Map PipelineState to CompositionModel contract
    // We assume state.assets holds the background references from Milestone 8
    const compositionModel = {
      job_id: state.job.id,
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
    const response = await WorkerGateway.post('/composition/composite', compositionModel, {
      timeoutMs: 15 * 60 * 1000 // Complex encoding can take time
    })

    if (response.status !== 'success') {
      throw new Error(`Composition failed: ${response.error || 'Unknown error'}`)
    }

    // 4. Update State
    context.updateState({
      ...state,
      composition: {
        outputUrl: response.data.output_reference.storage_key,
        renderTimeMs: response.data.render_time_ms,
        manifestUrl: response.data.manifest_url,
        warnings: response.data.warnings,
        completedAt: new Date().toISOString()
      }
    })

    context.log(`Final Composition generated successfully: ${response.data.output_reference.storage_key}`)
  }
}
