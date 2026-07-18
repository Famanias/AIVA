import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { WorkerGateway } from '../WorkerGateway'

export class ScriptHandler extends BaseHandler {
  async execute(context: PipelineContext): Promise<void> {
    const state = context.getState()

    if (!state.outline || state.outline.length === 0) {
      throw new Error('ScriptHandler requires a generated outline.')
    }

    context.log('Dispatching job to Python Script Direction Worker...')
    
    const response = await WorkerGateway.post('/pipeline/script_direction', {
      trace_id: state.job.id,
      project_id: state.project.id,
      workspace_id: 'default',
      topic: state.project.topic,
      video_style: state.project.video_style || 'stickman',
      outline: state.outline,
      visual_type_weights: { "stickman": 1.0 }, // Hardcoded MVP defaults
      allowed_templates: ["stickman_talking", "stickman_pointing"],
      default_camera_pacing: "medium",
      rig_action_list: ["talk", "point", "shrug"],
      typography_template_list: ["default"],
      duration_target_minutes: state.project.duration_target_minutes || 3,
      language: 'en'
    }, {
      timeoutMs: 5 * 60 * 1000 // 5 minutes
    })

    if (response.status !== 'success') {
      throw new Error(`Script generation failed: ${response.error || 'Unknown error'}`)
    }

    context.updateState({
      ...state,
      scenes: response.data.scenes // The script direction stage outputs the scenes array
    })

    context.log(`Script generation completed successfully. Extracted ${response.data.scenes?.length || 0} scenes.`)
  }
}
