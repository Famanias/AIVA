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

    const stateAny = state as Record<string, any>
    const scenes = state.scenes || state.sceneDirections || state.script?.sceneDirections || stateAny['03_script']?.sceneDirections || []
    const voice = state.voice || stateAny['04_voice'] || {}
    const assets = state.assets || stateAny['06_assets'] || {}

    const rawBgTracks = assets.background_tracks || (Array.isArray(scenes) ? scenes
      .filter((s: any) => s.asset_manifest?.background?.storage_key)
      .map((s: any) => ({
        id: String(s.id || s.sequence_number),
        type: 'video',
        storage_key: s.asset_manifest.background.storage_key,
        duration: s.duration || 4.5,
        mime_type: 'video/mp4'
      })) : [])

    const bgTracks = rawBgTracks.map((t: any) => ({
      ...t,
      mime_type: t.mime_type || (t.type === 'image' ? 'image/jpeg' : 'video/mp4')
    }))

    const voiceUrl = voice.audioUrl || (Array.isArray(voice.voiceovers) && voice.voiceovers[0]?.audio_url) || null

    const profile = context.generationProfile || (context.state as any)?.generationProfile || (context.project as any)?.generation_profile || {}
    const aspectRatio = profile.aspect_ratio || profile.target_aspect_ratio || '9:16'
    let width = 1080
    let height = 1920

    if (aspectRatio === '16:9') {
      width = 1920
      height = 1080
    } else if (aspectRatio === '1:1') {
      width = 1080
      height = 1080
    }

    // Resolve Background Music for Auto-Ducking
    const defaultMusicPath = 'storage/audio/ambient_track.mp3'
    const customMusicPath = profile.music_url || (state as any).music_url || defaultMusicPath
    const musicTrack = {
      id: 'music_ambient',
      type: 'audio',
      storage_key: customMusicPath,
      duration: 0,
      mime_type: 'audio/mp3'
    }

    // Resolve Word Timings
    let wordTimings = voice.wordTimings || voice.word_timings || []
    if ((!wordTimings || wordTimings.length === 0) && Array.isArray(voice.subtitles)) {
      wordTimings = voice.subtitles.flatMap((s: any) => s.word_timings || [])
    }

    // 2. Map PipelineState to CompositionModel contract
    const compositionModel = {
      trace_id: context.job.id,
      project_id: context.project.id,
      job_id: context.job.id,
      overlay_track: {
        id: 'remotion_overlay',
        type: 'video',
        storage_key: state.render.outputUrl,
        duration: Array.isArray(scenes) ? scenes.reduce((acc: number, s: any) => acc + (s.duration || 4.5), 0) : 10.0,
        mime_type: 'video/webm'
      },
      background_tracks: bgTracks,
      voice_track: voiceUrl ? {
        id: 'voice_main',
        type: 'audio',
        storage_key: voiceUrl,
        duration: 0,
        mime_type: 'audio/mp3'
      } : null,
      music_track: musicTrack,
      sfx_tracks: [],
      word_timings: wordTimings,
      output_settings: {
        codec: 'h264',
        hardware_acceleration: 'auto',
        bitrate: '8M',
        preset: 'fast',
        resolution: `${width}x${height}`,
        width,
        height,
        aspect_ratio: aspectRatio,
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
