import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'
import { SHORT_FORM_PROFILE } from '@aiva/shared-types'

export class ScriptHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 5 * 60 * 1000 // 5 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    if (!state.outline || state.outline.length === 0) {
      throw new Error('ScriptHandler requires a generated outline.')
    }

    await context.logger.info('Dispatching job to Python Script Direction Worker...')
    
    const activeProfile = (context.state as any).generationProfile ?? SHORT_FORM_PROFILE

    const response = await workerGateway.execute<any>('/pipeline/script_direction', {
      trace_id: context.job.id,
      project_id: context.project.id,
      topic: context.project.topic,
      video_style: context.project.video_style || 'stickman_animation',
      outline: state.outline,
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

    Object.assign(context.state, {
      ...state,
      scenes: response.data.sceneDirections // The script direction stage outputs the sceneDirections array
    })

    await context.logger.info(`Script generation completed successfully. Extracted ${response.data.sceneDirections?.length || 0} scenes.`)

    return 'voiceover'
  }
}
