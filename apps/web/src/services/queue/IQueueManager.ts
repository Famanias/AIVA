export interface JobState {
  id: string
  status: 'waiting' | 'active' | 'delayed' | 'completed' | 'failed' | 'unknown'
}

export interface IQueueManager {
  /**
   * Enqueues a job for processing.
   */
  enqueueJob(jobId: string, step?: string | number, priority?: number): Promise<void>

  /**
   * Gets the state of a specific job in the queue.
   */
  getJobState(jobId: string): Promise<JobState | null>

  /**
   * Removes a job from the queue if it is safe to do so (e.g. waiting, delayed).
   */
  removeJob(jobId: string): Promise<boolean>
}
