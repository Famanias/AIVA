import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'
import { PipelineIR } from '../../../../../template-renderer/src/types/PipelineIR'
import { query } from '@aiva/database'

export class RenderHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 10 * 60 * 1000 // 10 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    const stateAny = state as Record<string, any>
    const scenes = state.scenes || state.sceneDirections || state.script?.sceneDirections || stateAny['03_script']?.sceneDirections || []
    const voice = state.voice || stateAny['04_voice'] || {}

    // 1. Validate Prerequisite State
    if (scenes.length === 0) {
      await context.logger.info('Rendering skipped: No scene directions found in state.')
      return null // Gracefully exit to prevent BullMQ retry loops
    }

    let style = (context.project as any).video_style || 'stickman'
    if (style === 'stickman_animation') style = 'stickman'

    const wordTimings = voice.wordTimings || voice.word_timings || stateAny['05_subtitles']?.subtitles || []
    const audioUrl = voice.audioUrl || (Array.isArray(voice.voiceovers) && voice.voiceovers[0]?.audio_url) || ''

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

    const voiceovers = voice.voiceovers || voice.scene_voiceovers || []
    const masterDurationSec = Number(voice.master_duration_sec || (Array.isArray(voiceovers) ? voiceovers.reduce((acc: number, v: any) => acc + Number(v.duration_sec || 0), 0) : 0))

    // 2. Package and dispatch per-scene parallel renders to Template Renderer
    const renderUrl = process.env.TEMPLATE_RENDERER_URL || 'http://localhost:3001'
    await context.logger.info(`Dispatching ${scenes.length} scene(s) to Render Engine in parallel: ${renderUrl}/render`)

    const sceneRenderResults = await Promise.all(
      scenes.map(async (s: any, index: number) => {
        const seq = s.sequence_number || index + 1
        const sceneVo = Array.isArray(voiceovers)
          ? voiceovers.find((vo: any) => vo.sequence_number === seq)
          : null
        const sceneWordTimings = sceneVo?.word_timings || (Array.isArray(wordTimings) ? wordTimings : [])
        const sceneAudioUrl = sceneVo?.audio_url || audioUrl || ''

        const sceneDuration = Number(sceneVo?.duration_sec || s.duration || sceneVo?.duration || 4.5)

        const sceneIR: PipelineIR = {
          version: 1,
          templateFamily: style,
          metadata: {
            projectId: context.project.id,
            jobId: `${context.job.id}_scene_${seq}`,
            topic: context.project.topic,
            canvasConfig: {
              width,
              height,
              aspectRatio,
              fps: 30,
            },
          },
          voice: {
            wordTimings: sceneWordTimings,
            audioUrl: sceneAudioUrl,
            masterDurationSec: sceneDuration,
          },
          scenes: [
            {
              id: String(seq),
              text: s.scriptSegment || s.text || '',
              visual_type: s.visualType || s.visual_type || 'stickman_action',
              action: s.animationAction || s.action || 'standing',
              transition: s.transition || 'fade',
              assetUrl: s.assetUrl || s.asset_manifest?.asset_slots?.background?.storage_key || s.asset_manifest?.background?.storage_key || '',
              duration: sceneDuration,
            },
          ],
        }

        const response = await workerGateway.execute<any>(`${renderUrl}/render`, sceneIR, 10 * 60 * 1000)

        if (response.status !== 'success') {
          throw new Error(`Rendering failed for scene ${seq}: ${response.error || 'Unknown error'}`)
        }

        const sceneVideoUrl = response.result?.outputs?.video || ''

        // Persist individual scene render_url in PostgreSQL
        await query(
          `UPDATE public.scenes 
           SET render_status = 'rendered', 
               render_url = $1 
           WHERE project_id = $2 AND (sequence_number = $3 OR id = $4)`,
          [sceneVideoUrl, context.project.id, seq, s.id || '00000000-0000-0000-0000-000000000000']
        )

        return {
          sequenceNumber: seq,
          renderUrl: sceneVideoUrl,
          metrics: response.result?.metrics,
        }
      })
    )

    // 3. Resolve master continuous overlay for composition
    let outputVideoUrl = sceneRenderResults[0]?.renderUrl || ''
    if (scenes.length > 1) {
      await context.logger.info(`Dispatching full multi-scene master timeline (${scenes.length} scenes) to Render Engine...`)
      
      const masterIR: PipelineIR = {
        version: 1,
        templateFamily: style,
        metadata: {
          projectId: context.project.id,
          jobId: `${context.job.id}_master`,
          topic: context.project.topic,
          canvasConfig: {
            width,
            height,
            aspectRatio,
            fps: 30,
          },
        },
        voice: {
          wordTimings: Array.isArray(wordTimings) ? wordTimings : [],
          audioUrl: voice.master_audio_url || voice.audioUrl || audioUrl || '',
          masterDurationSec: masterDurationSec > 0 ? masterDurationSec : undefined,
        },
        scenes: scenes.map((s: any, index: number) => {
          const seq = s.sequence_number || index + 1
          const sceneVo = Array.isArray(voiceovers)
            ? voiceovers.find((vo: any) => vo.sequence_number === seq)
            : null
          const sceneDuration = Number(sceneVo?.duration_sec || s.duration || sceneVo?.duration || 4.5)

          return {
            id: String(seq),
            text: s.scriptSegment || s.text || '',
            visual_type: s.visualType || s.visual_type || 'stickman_action',
            action: s.animationAction || s.action || 'standing',
            transition: s.transition || 'fade',
            assetUrl: s.assetUrl || s.asset_manifest?.asset_slots?.background?.storage_key || s.asset_manifest?.background?.storage_key || '',
            duration: sceneDuration,
          }
        }),
      }


      const masterResponse = await workerGateway.execute<any>(`${renderUrl}/render`, masterIR, 15 * 60 * 1000)
      if (masterResponse.status === 'success' && masterResponse.result?.outputs?.video) {
        outputVideoUrl = masterResponse.result.outputs.video
        await context.logger.info(`Master continuous overlay rendered successfully: ${outputVideoUrl}`)
      } else {
        await context.logger.warn(`Master overlay rendering failed, falling back to primary scene overlay. Error: ${masterResponse.error || 'Unknown'}`)
      }
    }

    // 4. Update Pipeline State with Render Result
    Object.assign(context.state, {
      ...state,
      render: {
        outputUrl: outputVideoUrl,
        sceneRenderResults,
        completedAt: new Date().toISOString(),
      },
    })

    await context.logger.info(`Per-scene parallel rendering completed for ${sceneRenderResults.length} scene(s).`)
    
    return 'composition'
  }
}
