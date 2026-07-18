import { BaseHandler } from './BaseHandler'
import { PipelineContext } from '../PipelineContext'
import { WorkerGateway } from '../WorkerGateway'

export class AssetHandler extends BaseHandler {
  async execute(context: PipelineContext): Promise<void> {
    const state = context.getState()

    // 1. Validate Prerequisite State
    if (!state.scenes || state.scenes.length === 0) {
      throw new Error('AssetHandler requires generated scenes.')
    }

    // 2. Dispatch to Asset Worker
    // The Asset Worker is a Python process handling the heavy semantic matching
    context.log(`Dispatching ${state.scenes.length} scenes to Asset Worker...`)
    
    // We send the entire state, and the worker returns the updated state 
    // with 'asset_manifest' populated on each scene.
    const response = await WorkerGateway.post('/assets/resolve', state, {
      timeoutMs: 5 * 60 * 1000 // Asset fetching/generation can take a few minutes
    })

    if (response.status !== 'success') {
      throw new Error(`Asset resolution failed: ${response.error || 'Unknown error'}`)
    }

    // 3. Update Pipeline State
    context.updateState({
      ...response.result, // The worker returns the mutated state directly under result (in WorkerGateway wrapper)
    })

    context.log('Asset resolution completed successfully.')
  }
}
