import { queueManager } from './queue/BullMQQueueManager'

export class QueueService {
  /**
   * Enqueues a pipeline job into the Queue Manager.
   * This service is decoupled from the business logic and only knows about job IDs.
   * 
   * @param jobId The Supabase job ID to process
   * @param priority Lower numbers = higher priority
   */
  static async enqueuePipelineJob(jobId: string, step: string, priority: number = 0) {
    await queueManager.enqueueJob(jobId, step, priority)
  }
}
