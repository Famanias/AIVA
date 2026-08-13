import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'
import { SHORT_FORM_PROFILE } from '@aiva/shared-types'
import { query } from '@aiva/database'
import crypto from 'crypto'

export class ScriptHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 5 * 60 * 1000 // 5 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    const customScript = (state as any).custom_script || state.custom_script || ''
    const hasCustomScript = typeof customScript === 'string' && customScript.trim().length > 0

    if (!hasCustomScript && (!state.outline || state.outline.length === 0)) {
      throw new Error('ScriptHandler requires a generated outline or custom_script.')
    }

    await context.logger.info(
      hasCustomScript 
        ? 'Dispatching custom script to Python Script Direction Worker...' 
        : 'Dispatching job to Python Script Direction Worker...'
    )
    
    const activeProfile = context.generationProfile ?? (context.state as any).generationProfile ?? SHORT_FORM_PROFILE

    const response = await workerGateway.execute<any>('/pipeline/script_direction', {
      trace_id: context.job.id,
      project_id: context.project.id,
      topic: context.project.topic,
      custom_script: hasCustomScript ? customScript : undefined,
      video_style: context.project.video_style || 'stickman_animation',
      outline: state.outline || [],
      visual_type_weights: { 'character_animation': 0.7, 'broll': 0.3 },
      allowed_templates: ['character_animation', 'broll', 'ai_image'],
      default_camera_pacing: 'fast',
      rig_action_list: ['talk', 'point', 'shrug', 'walk', 'idle'],
      typography_template_list: [],
      language: context.project.language || 'en',
      generation_profile: activeProfile,
    }, this.getTimeoutMs())

    if (response.status !== 'success') {
      throw new Error(`Script generation failed: ${response.error || 'Unknown error'}`)
    }

    const sceneDirections: any[] = response.data.sceneDirections || []
    const validVisualTypes = new Set(['character_animation', 'broll', 'ai_image', 'kinetic_typography', 'avatar'])

    // Persist scenes and scene_versions to local PostgreSQL
    const persistedScenes: any[] = []
    for (const [index, s] of sceneDirections.entries()) {
      const sequenceNumber = Number(s.sequence_number || s.sequenceNumber || (index + 1))
      const scriptSegment = String(s.scriptSegment || s.script_segment || '')
      let visualType = String(s.visualType || s.visual_type || 'character_animation')
      if (visualType === 'stock_photo' || visualType === 'stock_video') visualType = 'broll'
      if (!validVisualTypes.has(visualType)) {
        visualType = 'character_animation'
      }

      const visualPrompt = s.visualPrompt || s.visual_prompt || null
      const animationAction = s.animationAction || s.animation_action || null
      const cameraStyle = s.cameraStyle || s.camera_style || null
      const typographyTemplate = s.typographyTemplate || s.typography_template || null
      const transition = s.transition || 'fade'
      const emotionalTone = s.emotionalTone || s.emotional_tone || null
      const brollSearchKeywords = s.brollSearchKeywords || s.broll_search_keywords || null

      const sceneId = crypto.randomUUID()
      const versionId = crypto.randomUUID()

      // 1. Insert or ensure scene exists
      const sceneRes = await query(
        `INSERT INTO public.scenes (
          id, project_id, sequence_number, render_status, duration
        ) VALUES ($1, $2, $3, 'draft', 0)
        ON CONFLICT (project_id, sequence_number) DO UPDATE
        SET render_status = 'draft'
        RETURNING id`,
        [sceneId, context.project.id, sequenceNumber]
      )
      const actualSceneId = sceneRes.rows[0]?.id || sceneId

      // 2. Insert scene version
      await query(
        `INSERT INTO public.scene_versions (
          id, scene_id, version_number, script_segment, visual_type,
          animation_action, typography_template, camera_style,
          transition, emotional_tone, broll_search_keywords, visual_prompt
        ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (scene_id, version_number) DO UPDATE
        SET script_segment = EXCLUDED.script_segment,
            visual_type = EXCLUDED.visual_type,
            animation_action = EXCLUDED.animation_action,
            typography_template = EXCLUDED.typography_template,
            camera_style = EXCLUDED.camera_style,
            transition = EXCLUDED.transition,
            emotional_tone = EXCLUDED.emotional_tone,
            broll_search_keywords = EXCLUDED.broll_search_keywords,
            visual_prompt = EXCLUDED.visual_prompt`,
        [
          versionId,
          actualSceneId,
          scriptSegment,
          visualType,
          animationAction,
          typographyTemplate,
          cameraStyle,
          transition,
          emotionalTone,
          brollSearchKeywords,
          visualPrompt,
        ]
      )

      // 3. Link current_version_id on scenes table
      await query(
        `UPDATE public.scenes SET current_version_id = $1 WHERE id = $2`,
        [versionId, actualSceneId]
      )

      persistedScenes.push({
        ...s,
        id: actualSceneId,
        scene_id: actualSceneId,
        version_id: versionId,
        sequence_number: sequenceNumber,
        scriptSegment,
        script_segment: scriptSegment,
        visualType,
        visual_type: visualType,
        visualPrompt,
        visual_prompt: visualPrompt,
        animationAction,
        cameraStyle,
        transition,
        emotionalTone,
        brollSearchKeywords,
      })
    }

    Object.assign(context.state, {
      ...state,
      scenes: persistedScenes
    })

    await context.logger.info(`Script generation completed and persisted to database. Saved ${persistedScenes.length} scenes.`)

    return 'voiceover'
  }
}
