import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'

export class OutlineHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 2 * 60 * 1000 // 2 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    await context.logger.info(`Starting outline generation for topic: ${context.project.topic}`)

    if (!context.state.research) {
      throw new Error("Missing research state. Outline cannot proceed.")
    }

    const payload = {
      trace_id: context.job.id,
      project_id: context.project.id,
      topic: context.project.topic,
      video_style: context.project.video_style || 'stickman',
      research_summary: context.state.research?.researchSummary || JSON.stringify(context.state.research),
      duration_target_minutes: context.project.duration_target_minutes || 3,
      language: context.project.language || 'en'
    }

    const result = await workerGateway.execute<any>('/pipeline/outline', payload, this.getTimeoutMs())

    if (result.status !== 'success') {
      throw new Error(`Outline generation failed: ${result.error || 'Unknown error'}`)
    }

    context.state.outline = result.data.outline

    await context.logger.info(`Outline completed successfully.`)

    // Transition to script_direction stage
    return 'script_direction'
  }
}
