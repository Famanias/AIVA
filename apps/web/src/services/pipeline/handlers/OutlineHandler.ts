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
      topic: context.project.topic,
      style: context.project.video_style,
      research_data: context.state.research
    }

    const result = await workerGateway.execute<any>('/api/v1/outline', payload, this.getTimeoutMs())

    context.state.outline = result

    await context.logger.info(`Outline completed successfully.`)

    // Transition to script_direction stage
    return 'script_direction'
  }
}
