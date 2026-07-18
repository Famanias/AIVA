import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { PIPELINE_QUEUE_NAME } from './client'
import { PipelineExecutor } from '../../services/pipeline/PipelineExecutor'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export function startWorker() {
  console.log(`[BullMQ] Starting worker on queue: ${PIPELINE_QUEUE_NAME}`)

  const worker = new Worker(
    PIPELINE_QUEUE_NAME,
    async (job) => {
      const { jobId } = job.data
      if (!jobId) {
        throw new Error('Missing jobId in queue payload')
      }

      // Isolate BullMQ from the business logic state machine
      const executor = new PipelineExecutor()
      await executor.executeJob(jobId)
    },
    {
      connection,
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '1', 10),
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Job ${job?.id} failed with error ${err.message}`)
  })

  worker.on('completed', (job) => {
    console.log(`[BullMQ] Job ${job.id} completed.`)
  })

  return worker
}
