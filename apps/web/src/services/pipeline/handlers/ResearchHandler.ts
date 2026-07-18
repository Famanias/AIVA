import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'

export class ResearchHandler extends BaseHandler {
  // Research can take a while due to multiple search queries and LLM summarization
  getTimeoutMs(): number {
    return 5 * 60 * 1000 // 5 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    await context.logger.info(`Starting research for topic: ${context.project.topic}`)

    const payload = {
      topic: context.project.topic,
      style: context.project.video_style,
      language: context.project.language || 'en'
    }

    const result = await workerGateway.execute<any>('/api/v1/research', payload, this.getTimeoutMs())

    // Update the state context with the research results
    context.state.research = result

    await context.logger.info(`Research completed successfully. Found ${result.sources?.length || 0} sources.`)

    // Transition to the next stage
    return 'outline'
  }
}
