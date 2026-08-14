import { query } from '@aiva/database'
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
  async executeJob(jobId: string): Promise<void> {
    console.log(`[PipelineExecutor] Executing Job: ${jobId}`)

    // 1. Fetch Job and Project
    const res = await query(
      `SELECT j.*, row_to_json(p.*) AS project 
       FROM public.jobs j 
       JOIN public.projects p ON j.project_id = p.id 
       WHERE j.id = $1 LIMIT 1`,
      [jobId]
    )

    if (res.rows.length === 0) {
      throw new Error(`Failed to fetch job ${jobId}: not found`)
    }

    const job = res.rows[0]
    const project = job.project
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

    const logger = new PipelineLogger(jobId, currentStep, 'orchestrator')

    // 3. Build the Context
    const rawState = (job.state_payload || {}) as Record<string, any>
    const generationProfile = state.generationProfile || rawState.generationProfile || {
      aspect_ratio: rawState.aspect_ratio || '9:16',
      duration_target_seconds: rawState.duration_target_seconds || 60,
      voice_id: rawState.voice_id || 'en-US-AriaNeural',
      persona: rawState.persona || 'Informative',
      visual_style: project.video_style || 'stickman_animation',
    }

    const context: PipelineContext = {
      project,
      job,
      state,
      generationProfile,
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

      if (nextStep) {
        const progress = this.calculateProgress(nextStep)
        await query(
          `UPDATE public.jobs 
           SET state_payload = $1, current_step = $2, progress = $3, updated_at = NOW() 
           WHERE id = $4`,
          [JSON.stringify(safeState), nextStep, progress, jobId]
        )
      } else {
        await query(
          `UPDATE public.jobs 
           SET state_payload = $1, progress = 100, updated_at = NOW() 
           WHERE id = $2`,
          [JSON.stringify(safeState), jobId]
        )
      }

      // Final cancellation check before advancing
      await LifecycleService.throwIfCancelledOrPaused(jobId)

      await this.logEvent(jobId, 'finished', currentStep, `Stage completed successfully.`)

      // 7. Enqueue next stage if not completed
      if (nextStep) {
        await QueueService.enqueuePipelineJob(jobId, nextStep)
      } else {
        await query(
          `UPDATE public.projects SET status = 'completed', updated_at = NOW() WHERE id = $1`,
          [project.id]
        )
      }

    } catch (error: any) {
      if (error instanceof CancellationError) {
        await context.logger.info(`Cancellation requested by operator. Pipeline is safely stopping...`)

        // Cancellation lifecycle
        await this.logCancellationEvent(jobId, 'worker_acknowledged', currentStep, 'Worker acknowledged cancellation request.')
        await this.logCancellationEvent(jobId, 'cleanup_started', currentStep, 'Cleaning up resources...')
        await this.logCancellationEvent(jobId, 'cleanup_finished', currentStep, 'Resources released.')

        // Final transition
        await query(
          `UPDATE public.jobs 
           SET cancelled_at = NOW(), 
               cancel_reason = COALESCE(cancel_reason, 'User requested cancellation'), 
               updated_at = NOW() 
           WHERE id = $1`,
          [jobId]
        )
        await query(
          `UPDATE public.projects SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
          [project.id]
        )

        await this.logCancellationEvent(jobId, 'cancelled', currentStep, 'Pipeline terminated successfully.')
        return
      }

      if (error instanceof PauseError) {
        await context.logger.info(`Pause requested by operator. Pipeline is yielding...`)

        // Final transition
        await query(
          `UPDATE public.projects SET status = 'paused', updated_at = NOW() WHERE id = $1`,
          [project.id]
        )

        await this.logEvent(jobId, 'finished', currentStep, 'Pipeline paused successfully.')
        return
      }

      await context.logger.error(`Execution failed at stage ${currentStep}`, error)
      throw error // Re-throw to trigger BullMQ backoff/retries
    }
  }

  private async logEvent(jobId: string, eventType: 'started' | 'finished' | 'failed' | 'retrying', step: any, message: string) {
    try {
      await query(
        `INSERT INTO public.job_events (job_id, event_type, job_step, message, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [jobId, eventType, step, message]
      )
    } catch (err: any) {
      console.error('[PipelineExecutor] Failed to insert job event:', err.message)
    }
  }

  private async logCancellationEvent(jobId: string, eventType: string, step: any, message: string) {
    try {
      await query(
        `INSERT INTO public.job_events (job_id, event_type, job_step, message, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [jobId, eventType, step, message]
      )
    } catch (err: any) {
      console.error('[PipelineExecutor] Failed to insert cancellation event:', err.message)
    }
  }

  private calculateProgress(step: string): number {
    const sequence = [
      'research', 'outline', 'script_direction', 'brand_safety_check',
      'voiceover', 'subtitle_extraction', 'assets', 'rendering',
      'composition', 'thumbnail', 'metadata',
      'cost_reconciliation', 'upload', 'notify', 'completed'
    ]
    const index = sequence.indexOf(step)
    return index > -1 ? Math.round((index / sequence.length) * 100) : 0
  }
}

