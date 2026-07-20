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
      trace_id: context.job.id,
      project_id: context.project.id,
      topic: context.project.topic,
      language: context.project.language || 'en'
    }

    const result = await workerGateway.execute<any>('/pipeline/research', payload, this.getTimeoutMs())

    // Update the state context with the research results
    context.state.research = result.data

    await context.logger.info(`Research completed successfully. Found ${result.data.researchSources?.length || 0} sources.`)

    // Transition to the next stage
    return 'outline'
  }
}
