import { Job } from 'bullmq'
import { pipelineQueue } from '../../lib/queue/client'
import { IQueueManager, JobState } from './IQueueManager'

export class BullMQQueueManager implements IQueueManager {
  async enqueueJob(jobId: string, step: string, priority: number = 0): Promise<void> {
    const bullMqJobId = `${jobId}_${step}`
    console.log(`[BullMQQueueManager] Enqueueing pipeline job: ${bullMqJobId} (priority: ${priority})`)
    // Pass the Supabase jobId as both the BullMQ jobId (for tracking) and in the data payload.
    await pipelineQueue.add(
      'process-pipeline', 
      { jobId }, 
      { 
        priority, 
        jobId: bullMqJobId,
        removeOnComplete: true
      }
    )
  }

  async getJobState(jobId: string): Promise<JobState | null> {
    const job = await pipelineQueue.getJob(jobId)
    if (!job) {
      return null
    }

    const state = await job.getState()
    return {
      id: jobId,
      status: state as JobState['status'] // Cast BullMQ state ('active', 'waiting', etc.)
    }
  }

  async removeJob(jobId: string): Promise<boolean> {
    const job = await pipelineQueue.getJob(jobId)
    if (!job) {
      return false
    }

    const state = await job.getState()
    if (state === 'waiting' || state === 'delayed') {
      await job.remove()
      return true
    }
    
    // Cannot safely remove active/completed jobs via queue manager alone
    return false
  }
}

// Singleton instance for the application
export const queueManager = new BullMQQueueManager()
