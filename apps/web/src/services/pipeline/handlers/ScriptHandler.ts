import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'

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
    
    const response = await workerGateway.execute<any>('/pipeline/script_direction', {
      trace_id: context.job.id,
      project_id: context.project.id,
      topic: context.project.topic,
      video_style: context.project.video_style || 'stickman',
      outline: state.outline,
      visual_type_weights: { "stickman": 1.0 }, // Hardcoded MVP defaults
      allowed_templates: ["stickman_talking", "stickman_pointing"],
      default_camera_pacing: "medium",
      rig_action_list: ["talk", "point", "shrug"],
      typography_template_list: ["default"],
      duration_target_minutes: context.project.duration_target_minutes || 3,
      language: context.project.language || 'en'
    }, 5 * 60 * 1000)

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
