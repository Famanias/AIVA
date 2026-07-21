import { createClient } from '@supabase/supabase-js'
import { Database } from '@aiva/shared-types'
import { PipelineContext, PipelineStateSchema } from './PipelineContext'
import { stageRegistry } from './StageRegistry'
import { QueueService } from '../queue.service'
import { LifecycleService, CancellationError, PauseError } from './LifecycleService'

import { PipelineLogger } from './PipelineLogger'

/**
 * The core state machine orchestrator.
 * It is completely decoupled from BullMQ. It only receives a jobId.
 */
export class PipelineExecutor {
  private db: ReturnType<typeof createClient<Database>>

  constructor() {
    this.db = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // We need service role to bypass RLS for background jobs
    )
  }

  async executeJob(jobId: string): Promise<void> {
    console.log(`[PipelineExecutor] Executing Job: ${jobId}`)

    // 1. Fetch Job and Project
    const { data: job, error: jobError } = await this.db
      .from('jobs')
      .select('*, projects(*)')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error(`Failed to fetch job ${jobId}: ${jobError?.message}`)
    }

    const project = Array.isArray(job.projects) ? job.projects[0] : job.projects
    if (!project) {
      throw new Error(`Job ${jobId} has no associated project.`)
    }

    const currentStep = job.current_step
    if (project.status === 'completed' || project.status === 'failed') {
      console.log(`[PipelineExecutor] Job ${jobId} project is already ${project.status}. Skipping.`)
      return
    }

    // Check cancellation immediately
    await LifecycleService.throwIfCancelledOrPaused(jobId)

    // 2. Parse existing state cleanly using Zod (Idempotency protection)
    const state = PipelineStateSchema.parse(job.state_payload || {})

    const logger = new PipelineLogger(jobId, currentStep, 'orchestrator', this.db)

    // 3. Build the Context
    const context: PipelineContext = {
      project,
      job,
      state,
      db: this.db,
      config: {},
      logger
    }

    // 4. Resolve the Handler
    const handler = stageRegistry.getHandler(currentStep)

    try {
      await this.logEvent(jobId, 'started', currentStep, `Starting stage execution`)

      // 5. Execute the Handler
      const nextStep = await handler.execute(context)

      // 6. Persist State and Transition
      const safeState = PipelineStateSchema.parse(context.state)

      const updatePayload: any = {
        state_payload: safeState as any,
        updated_at: new Date().toISOString()
      }

      if (nextStep) {
        updatePayload.current_step = nextStep
        updatePayload.progress = this.calculateProgress(nextStep)
      } else {
        updatePayload.progress = 100
      }

      const { error: updateError } = await this.db
        .from('jobs')
        .update(updatePayload)
        .eq('id', jobId)

      if (updateError) {
        throw new Error(`Failed to persist state: ${updateError.message}`)
      }

      // Final cancellation check before advancing
      await LifecycleService.throwIfCancelledOrPaused(jobId)

      await this.logEvent(jobId, 'finished', currentStep, `Stage completed successfully.`)

      // 7. Enqueue next stage if not completed
      if (nextStep) {
        await QueueService.enqueuePipelineJob(jobId, nextStep)
      } else {
        await this.db.from('projects').update({ status: 'completed' }).eq('id', project.id)
      }

    } catch (error: any) {
      if (error instanceof CancellationError) {
        await context.logger.info(`Cancellation requested by operator. Pipeline is safely stopping...`)

        // Cancellation lifecycle
        await this.logCancellationEvent(jobId, 'worker_acknowledged', currentStep, 'Worker acknowledged cancellation request.')
        await this.logCancellationEvent(jobId, 'cleanup_started', currentStep, 'Cleaning up resources...')
        await this.logCancellationEvent(jobId, 'cleanup_finished', currentStep, 'Resources released.')

        // Final transition
        await this.db.from('jobs').update({ current_step: 'cancelled' }).eq('id', jobId)
        await this.db.from('projects').update({ status: 'cancelled' }).eq('id', project.id)

        await this.logCancellationEvent(jobId, 'cancelled', currentStep, 'Pipeline terminated successfully.')
        return
      }

      if (error instanceof PauseError) {
        await context.logger.info(`Pause requested by operator. Pipeline is yielding...`)

        // Final transition
        await this.db.from('projects').update({ status: 'paused' }).eq('id', project.id)

        await this.logEvent(jobId, 'finished', currentStep, 'Pipeline paused successfully.')
        return
      }

      await context.logger.error(`Execution failed at stage ${currentStep}`, error)
      throw error // Re-throw to trigger BullMQ backoff/retries
    }
  }

  private async logEvent(jobId: string, eventType: 'started' | 'finished' | 'failed' | 'retrying', step: any, message: string) {
    await this.db.from('job_events').insert({
      job_id: jobId,
      event_type: eventType,
      job_step: step,
      message
    })
  }

  private async logCancellationEvent(jobId: string, eventType: string, step: any, message: string) {
    await this.db.from('job_events').insert({
      job_id: jobId,
      event_type: eventType as any,
      job_step: step,
      message
    })
  }

  private calculateProgress(step: string): number {
    const sequence = [
      'research', 'outline', 'script_direction', 'brand_safety_check',
      'voiceover', 'subtitle_extraction', 'scene_preview', 'scene_render',
      'composition', 'rendering', 'thumbnail', 'metadata',
      'cost_reconciliation', 'upload', 'notify', 'completed'
    ]
    const index = sequence.indexOf(step)
    return index > -1 ? Math.round((index / sequence.length) * 100) : 0
  }
}
