import { Queue } from 'bullmq'
import Redis from 'ioredis'

// Connect to the local Redis instance defined in docker-compose.yml
// Ensure we use the REDIS_URL env var if provided in production
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const PIPELINE_QUEUE_NAME = 'pipeline-queue'

export const pipelineQueue = new Queue(PIPELINE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: 1000, // keep the last 1000 failed jobs for debugging
  },
})
