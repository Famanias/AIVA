import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { PIPELINE_QUEUE_NAME } from './client'
import { PipelineExecutor } from '../../services/pipeline/PipelineExecutor'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

declare global {
  var __workerCounter: number | undefined
  var __bullmq_worker: Worker | undefined
}

export function startWorker() {
  if (globalThis.__bullmq_worker) {
    console.log('[BullMQ] Worker already initialized, reusing instance.')
    return globalThis.__bullmq_worker
  }

  globalThis.__workerCounter = (globalThis.__workerCounter ?? 0) + 1
  console.log(`[BullMQ] Starting worker on queue: ${PIPELINE_QUEUE_NAME}`)
  console.log(`[Instrumentation] BullMQ Worker PID: ${process.pid}`)
  console.log(`[Instrumentation] Worker instance count: ${globalThis.__workerCounter}`)

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

  globalThis.__bullmq_worker = worker

  return worker
}
