import { pipelineQueue } from '@/lib/queue/client'

export class QueueService {
  /**
   * Enqueues a pipeline job into the BullMQ broker.
   * This service is decoupled from the business logic and only knows about job IDs.
   * 
   * @param jobId The Supabase job ID to process
   * @param priority Lower numbers = higher priority
   */
  static async enqueuePipelineJob(jobId: string, priority: number = 0) {
    console.log(`[QueueService] Enqueueing pipeline job: ${jobId} (priority: ${priority})`)
    
    await pipelineQueue.add(
      'process-pipeline', 
      { jobId }, 
      { priority }
    )
  }
}
