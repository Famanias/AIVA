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

    const voiceovers = voice.voiceovers || voice.scene_voiceovers || []
    const masterDuration = Number(
      voice.master_duration_sec || 
      (Array.isArray(voiceovers) && voiceovers.length > 0 ? voiceovers.reduce((acc: number, v: any) => acc + Number(v.duration_sec || 0), 0) : 
      (Array.isArray(scenes) && scenes.length > 0 ? scenes.reduce((acc: number, s: any) => acc + Number(s.duration || 4.5), 0) : 10.0))
    )

    const rawBgTracks = assets.background_tracks || (Array.isArray(scenes) ? scenes
      .map((s: any, idx: number) => {
        const bgRef = s.asset_manifest?.asset_slots?.background || s.asset_manifest?.background || s.assetRef || s.asset_ref
        const storageKey = bgRef?.storage_key || bgRef?.storageKey || s.assetUrl || s.asset_url || ''
        const mimeType = bgRef?.mime_type || bgRef?.mimeType || (typeof storageKey === 'string' && (storageKey.endsWith('.jpg') || storageKey.endsWith('.jpeg') || storageKey.endsWith('.png')) ? 'image/jpeg' : 'video/mp4')
        const isImage = typeof mimeType === 'string' && mimeType.startsWith('image/')
        
        const seq = s.sequence_number || idx + 1
        const sceneVo = Array.isArray(voiceovers) ? voiceovers.find((v: any) => v.sequence_number === seq) : null
        const sceneDuration = Number(sceneVo?.duration_sec || s.duration || sceneVo?.duration || 4.5)

        if (!storageKey) return null

        return {
          id: String(s.id || seq),
          type: isImage ? 'image' : 'video',
          storage_key: storageKey,
          duration: sceneDuration,
          mime_type: mimeType
        }
      })
      .filter(Boolean) : [])

    const bgTracks = rawBgTracks.map((t: any) => ({
      ...t,
      mime_type: t.mime_type || (t.type === 'image' ? 'image/jpeg' : 'video/mp4')
    }))

    const voiceUrl = voice.master_audio_url || voice.audioUrl || (Array.isArray(voiceovers) && voiceovers[0]?.audio_url) || null

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

    // Resolve Word Timings with cumulative global offsets
    let wordTimings = voice.wordTimings || voice.word_timings || []
    if ((!wordTimings || wordTimings.length === 0) && Array.isArray(voice.subtitles)) {
      let cumulativeOffset = 0
      wordTimings = voice.subtitles.flatMap((s: any) => {
        const sceneTimings = (s.word_timings || s.wordTimings || []).map((w: any) => ({
          word: w.word,
          start: Math.round((Number(w.start || 0) + cumulativeOffset) * 1000) / 1000,
          end: Math.round((Number(w.end || 0) + cumulativeOffset) * 1000) / 1000
        }))
        cumulativeOffset += Number(s.duration || s.duration_sec || 0)
        return sceneTimings
      })
    }

    const style = (context.project as any)?.video_style || 'documentary'
    const isCharacterOverlay = style === 'stickman' || style === 'stickman_animation'

    // 2. Map PipelineState to CompositionModel contract
    const compositionModel = {
      trace_id: context.job.id,
      project_id: context.project.id,
      job_id: context.job.id,
      overlay_track: (isCharacterOverlay && state.render?.outputUrl) ? {
        id: 'remotion_overlay',
        type: 'video',
        storage_key: state.render.outputUrl,
        duration: totalDuration,
        mime_type: 'video/webm'
      } : null,
      background_tracks: bgTracks,

      voice_track: voiceUrl ? {
        id: 'voice_main',
        type: 'audio',
        storage_key: voiceUrl,
        duration: totalDuration,
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
