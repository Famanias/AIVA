import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { workerGateway } from '../WorkerGateway'

export class AssetHandler extends BaseHandler {
  getTimeoutMs(): number {
    return 10 * 60 * 1000 // 10 minutes
  }

  async execute(context: PipelineContext): Promise<string | null> {
    const state = context.state

    // 1. Validate Prerequisite State
    if (!state.scenes || state.scenes.length === 0) {
      throw new Error('AssetHandler requires generated scenes.')
    }

    await context.logger.info(`Dispatching ${state.scenes.length} scenes to Asset Worker...`)
    
    // We send the entire state, and the worker returns the updated state 
    // with 'asset_manifest' populated on each scene.
    const response = await workerGateway.execute<any>('/assets/resolve', {
      trace_id: context.job.id,
      project_id: context.project.id,
      ...state
    }, 5 * 60 * 1000)

    if (response.status !== 'success') {
      throw new Error(`Asset resolution failed: ${response.error || 'Unknown error'}`)
    }

    // 3. Update Pipeline State
    Object.assign(context.state, {
      ...response.result, // The worker returns the mutated state directly under result (in WorkerGateway wrapper)
    })

    await context.logger.info('Asset resolution completed successfully.')

    return 'rendering'
  }
}
