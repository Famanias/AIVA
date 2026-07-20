import { createClient } from '@supabase/supabase-js'
import { Database } from '@aiva/shared-types'
import { queueManager } from './queue/BullMQQueueManager'
import { PipelineLogger } from './pipeline/PipelineLogger'

export class QueueControlService {
  private static adminSupabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  /**
   * Stops a specific job.
   * If the job is queued (waiting/delayed), it is removed from the queue and instantly cancelled.
   * If the job is active, we flag it for cancellation so the worker can cooperatively exit.
   */
  static async stopJob(jobId: string, projectId: string, userId: string): Promise<boolean> {
    const { data: project } = await this.adminSupabase
      .from('projects')
      .select('status')
      .eq('id', projectId)
      .single()

    if (!project) return false;
    if (['completed', 'failed', 'cancelled'].includes(project.status)) return true;

    const jobState = await queueManager.getJobState(jobId)
    const isPaused = project.status === 'paused'
    const isCancelling = project.status === 'cancelling'
    const isQueuedInBull = jobState && (jobState.status === 'waiting' || jobState.status === 'delayed')

    // Mark as cancelled or cancelling depending on queue state and project state
    if (isPaused || isQueuedInBull || isCancelling) {
      // 1. Remove from Queue
      if (isQueuedInBull) {
        await queueManager.removeJob(jobId)
      }

      // 2. Mark project as cancelled immediately
      await this.adminSupabase
        .from('projects')
        .update({ status: 'cancelled' })
        .eq('id', projectId)

      // 3. Set cancel timestamp and reason, leave current_step untouched
      await this.adminSupabase
        .from('jobs')
        .update({ 
          cancel_requested_at: new Date().toISOString(),
          cancel_requested_by: userId,
          cancelled_at: new Date().toISOString(),
          cancel_reason: isCancelling ? 'Forced cancellation by operator' : 'User requested cancellation'
        })
        .eq('id', jobId)

      // 4. Log event
      const waitLogger = new PipelineLogger(jobId, 'cancelled', 'orchestrator', this.adminSupabase)
      const actionSource = isCancelling ? 'force cancelled' : (isPaused ? 'paused' : 'waiting in queue');
      await waitLogger.info(`Cancellation requested by operator. Job was ${actionSource} and has been immediately cancelled.`)

      return true
    } else {
      // Job is active
      // Mark project as cancelling immediately so UI updates
      await this.adminSupabase
        .from('projects')
        .update({ status: 'cancelling' })
        .eq('id', projectId)

      // We set the cancellation requested flag. The worker will pick this up cooperatively.
      await this.adminSupabase
        .from('jobs')
        .update({ 
          cancel_requested_at: new Date().toISOString(),
          cancel_requested_by: userId,
          cancel_reason: 'User requested cancellation'
        })
        .eq('id', jobId)

      const activeLogger = new PipelineLogger(jobId, 'cancelling', 'orchestrator', this.adminSupabase)
      await activeLogger.info('Cancellation requested by operator. Waiting for current stage to exit safely.')

      return true
    }
  }

  static async pauseJob(jobId: string, projectId: string, userId: string): Promise<boolean> {
    const jobState = await queueManager.getJobState(jobId)

    if (jobState && (jobState.status === 'waiting' || jobState.status === 'delayed')) {
      await queueManager.removeJob(jobId)

      await this.adminSupabase
        .from('projects')
        .update({ status: 'paused' })
        .eq('id', projectId)

      await this.adminSupabase
        .from('jobs')
        .update({ 
          pause_requested_at: new Date().toISOString(),
          pause_requested_by: userId
        })
        .eq('id', jobId)

      const waitLogger = new PipelineLogger(jobId, 'paused', 'orchestrator', this.adminSupabase)
      await waitLogger.info('Pause requested by operator. Job was waiting and has been successfully paused.')

      return true
    } else {
      await this.adminSupabase
        .from('projects')
        .update({ status: 'paused' })
        .eq('id', projectId)

      await this.adminSupabase
        .from('jobs')
        .update({ 
          pause_requested_at: new Date().toISOString(),
          pause_requested_by: userId
        })
        .eq('id', jobId)

      const activeLogger = new PipelineLogger(jobId, 'pausing', 'orchestrator', this.adminSupabase)
      await activeLogger.info('Pause requested by operator. Waiting for current stage to yield cooperatively.')

      return true
    }
  }

  static async resumeJob(jobId: string, projectId: string, userId: string): Promise<boolean> {
    await this.adminSupabase
        .from('projects')
        .update({ status: 'queued' })
        .eq('id', projectId)

    await this.adminSupabase
      .from('jobs')
      .update({ 
        pause_requested_at: null,
        pause_requested_by: null
      })
      .eq('id', jobId)

    const logger = new PipelineLogger(jobId, 'queued', 'orchestrator', this.adminSupabase)
    await logger.info('Resume requested by operator. Job re-enqueued to continue from last checkpoint.')

    await queueManager.enqueueJob(jobId)
    return true
  }

  static async stopSelected(jobIds: string[], userId: string): Promise<void> {
    for (const jobId of jobIds) {
      // We need the projectId for this job to cancel it properly.
      const { data } = await this.adminSupabase
        .from('jobs')
        .select('project_id')
        .eq('id', jobId)
        .single()
      
      if (data) {
        await this.stopJob(jobId, data.project_id, userId)
      }
    }
  }

  static async pauseSelected(jobIds: string[], userId: string): Promise<void> {
    for (const jobId of jobIds) {
      const { data } = await this.adminSupabase
        .from('jobs')
        .select('project_id')
        .eq('id', jobId)
        .single()
      
      if (data) {
        await this.pauseJob(jobId, data.project_id, userId)
      }
    }
  }

  static async resumeSelected(jobIds: string[], userId: string): Promise<void> {
    for (const jobId of jobIds) {
      const { data } = await this.adminSupabase
        .from('jobs')
        .select('project_id')
        .eq('id', jobId)
        .single()
      
      if (data) {
        await this.resumeJob(jobId, data.project_id, userId)
      }
    }
  }

  static async stopAll(filter: 'queued' | 'processing' | 'all', userId: string): Promise<void> {
    let query = this.adminSupabase.from('projects').select('id, status, jobs(id)')
    
    if (filter === 'queued') {
      query = query.eq('status', 'queued')
    } else if (filter === 'processing') {
      query = query.in('status', ['generating'])
    } else {
      query = query.in('status', ['queued', 'generating'])
    }

    const { data } = await query
    
    if (data) {
      for (const project of data) {
        const jobs = Array.isArray(project.jobs) ? project.jobs : (project.jobs ? [project.jobs] : [])
        for (const job of jobs) {
          await this.stopJob(job.id, project.id, userId)
        }
      }
    }
  }

  static async pauseAll(filter: 'queued' | 'processing' | 'all', userId: string): Promise<void> {
    let query = this.adminSupabase.from('projects').select('id, status, jobs(id)')
    
    if (filter === 'queued') {
      query = query.eq('status', 'queued')
    } else if (filter === 'processing') {
      query = query.in('status', ['generating'])
    } else {
      query = query.in('status', ['queued', 'generating'])
    }

    const { data } = await query
    
    if (data) {
      for (const project of data) {
        const jobs = Array.isArray(project.jobs) ? project.jobs : (project.jobs ? [project.jobs] : [])
        for (const job of jobs) {
          await this.pauseJob(job.id, project.id, userId)
        }
      }
    }
  }
}
