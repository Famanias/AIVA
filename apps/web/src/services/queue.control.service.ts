import { query } from '@aiva/database';
import { queueManager } from './queue/BullMQQueueManager';

export class QueueControlService {
  /**
   * Stops a specific job.
   * If the job is queued (waiting/delayed), it is removed from the queue and instantly cancelled.
   * If the job is active, we flag it for cancellation so the worker can cooperatively exit.
   */
  static async stopJob(jobId: string, projectId: string, userId: string): Promise<boolean> {
    const projectRes = await query(
      "SELECT status FROM public.projects WHERE id = $1 LIMIT 1",
      [projectId]
    );

    if (projectRes.rows.length === 0) return false;
    const project = projectRes.rows[0];
    if (['completed', 'failed', 'cancelled'].includes(project.status)) return true;

    const jobRes = await query(
      "SELECT current_step FROM public.jobs WHERE id = $1 LIMIT 1",
      [jobId]
    );
      
    if (jobRes.rows.length === 0) return false;
    const job = jobRes.rows[0];

    const bullMqJobId = `${jobId}_${job.current_step}`;
    const jobState = await queueManager.getJobState(bullMqJobId);
    const statusStr = (project.status as string) || '';
    const isPaused = statusStr === 'paused';
    const isCancelling = statusStr === 'cancelling';
    const isQueuedInBull = jobState && (jobState.status === 'waiting' || jobState.status === 'delayed');

    // Mark as cancelled or cancelling depending on queue state and project state
    if (isPaused || isQueuedInBull || isCancelling) {
      if (isQueuedInBull) {
        await queueManager.removeJob(bullMqJobId);
      }

      await query(
        "UPDATE public.projects SET status = 'cancelled' WHERE id = $1",
        [projectId]
      );

      await query(
        `UPDATE public.jobs SET 
          cancel_requested_at = NOW(),
          cancel_requested_by = $1,
          cancelled_at = NOW(),
          cancel_reason = $2
        WHERE id = $3`,
        [
          userId,
          isCancelling ? 'Forced cancellation by operator' : 'User requested cancellation',
          jobId
        ]
      );

      return true;
    } else {
      await query(
        "UPDATE public.projects SET status = 'cancelling' WHERE id = $1",
        [projectId]
      );

      await query(
        `UPDATE public.jobs SET 
          cancel_requested_at = NOW(),
          cancel_requested_by = $1,
          cancel_reason = 'User requested cancellation'
        WHERE id = $2`,
        [userId, jobId]
      );

      return true;
    }
  }

  static async pauseJob(jobId: string, projectId: string, userId: string): Promise<boolean> {
    const jobRes = await query(
      "SELECT current_step FROM public.jobs WHERE id = $1 LIMIT 1",
      [jobId]
    );
      
    if (jobRes.rows.length === 0) return false;
    const job = jobRes.rows[0];

    const bullMqJobId = `${jobId}_${job.current_step}`;
    const jobState = await queueManager.getJobState(bullMqJobId);

    if (jobState && (jobState.status === 'waiting' || jobState.status === 'delayed')) {
      await queueManager.removeJob(bullMqJobId);

      await query(
        "UPDATE public.projects SET status = 'paused' WHERE id = $1",
        [projectId]
      );

      await query(
        `UPDATE public.jobs SET 
          pause_requested_at = NOW(),
          pause_requested_by = $1
        WHERE id = $2`,
        [userId, jobId]
      );

      return true;
    } else {
      await query(
        "UPDATE public.projects SET status = 'paused' WHERE id = $1",
        [projectId]
      );

      await query(
        `UPDATE public.jobs SET 
          pause_requested_at = NOW(),
          pause_requested_by = $1
        WHERE id = $2`,
        [userId, jobId]
      );

      return true;
    }
  }

  static async resumeJob(jobId: string, projectId: string, userId: string): Promise<boolean> {
    await query(
      "UPDATE public.projects SET status = 'queued' WHERE id = $1",
      [projectId]
    );

    await query(
      `UPDATE public.jobs SET 
        pause_requested_at = NULL,
        pause_requested_by = NULL
      WHERE id = $1`,
      [jobId]
    );

    const jobRes = await query(
      "SELECT current_step FROM public.jobs WHERE id = $1 LIMIT 1",
      [jobId]
    );
      
    if (jobRes.rows.length > 0) {
      await queueManager.enqueueJob(jobId, jobRes.rows[0].current_step);
    }
    return true;
  }

  static async stopSelected(jobIds: string[], userId: string): Promise<void> {
    for (const jobId of jobIds) {
      const res = await query(
        "SELECT project_id FROM public.jobs WHERE id = $1 LIMIT 1",
        [jobId]
      );
      if (res.rows.length > 0) {
        await this.stopJob(jobId, res.rows[0].project_id, userId);
      }
    }
  }

  static async pauseSelected(jobIds: string[], userId: string): Promise<void> {
    for (const jobId of jobIds) {
      const res = await query(
        "SELECT project_id FROM public.jobs WHERE id = $1 LIMIT 1",
        [jobId]
      );
      if (res.rows.length > 0) {
        await this.pauseJob(jobId, res.rows[0].project_id, userId);
      }
    }
  }

  static async resumeSelected(jobIds: string[], userId: string): Promise<void> {
    for (const jobId of jobIds) {
      const res = await query(
        "SELECT project_id FROM public.jobs WHERE id = $1 LIMIT 1",
        [jobId]
      );
      if (res.rows.length > 0) {
        await this.resumeJob(jobId, res.rows[0].project_id, userId);
      }
    }
  }

  static async stopAll(filter: 'queued' | 'processing' | 'all', userId: string): Promise<void> {
    let sql = `SELECT j.id AS job_id, j.project_id FROM public.jobs j JOIN public.projects p ON j.project_id = p.id`;
    if (filter === 'queued') {
      sql += ` WHERE p.status = 'queued'`;
    } else if (filter === 'processing') {
      sql += ` WHERE p.status = 'generating'`;
    } else {
      sql += ` WHERE p.status IN ('queued', 'generating')`;
    }

    const res = await query(sql);
    for (const row of res.rows) {
      await this.stopJob(row.job_id, row.project_id, userId);
    }
  }

  static async pauseAll(filter: 'queued' | 'processing' | 'all', userId: string): Promise<void> {
    let sql = `SELECT j.id AS job_id, j.project_id FROM public.jobs j JOIN public.projects p ON j.project_id = p.id`;
    if (filter === 'queued') {
      sql += ` WHERE p.status = 'queued'`;
    } else if (filter === 'processing') {
      sql += ` WHERE p.status = 'generating'`;
    } else {
      sql += ` WHERE p.status IN ('queued', 'generating')`;
    }

    const res = await query(sql);
    for (const row of res.rows) {
      await this.pauseJob(row.job_id, row.project_id, userId);
    }
  }
}
