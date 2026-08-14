import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Connect to the local Redis instance defined in docker-compose.yml
// Ensure we use the REDIS_URL env var if provided in production
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 500, 5000);
  },
});

let hasLoggedRedisWarning = false;
connection.on('error', (err: any) => {
  if (err.code === 'ECONNREFUSED') {
    if (!hasLoggedRedisWarning) {
      console.warn('[BullMQ Redis] Redis is offline or unreachable at', process.env.REDIS_URL || 'localhost:6379', '(Run `pnpm services:up` to start Redis & PostgreSQL)');
      hasLoggedRedisWarning = true;
    }
  } else {
    console.warn('[BullMQ Redis] Connection error:', err.message);
  }
});

connection.on('connect', () => {
  hasLoggedRedisWarning = false;
  console.log('[BullMQ Redis] Successfully connected to Redis.');
});

export const PIPELINE_QUEUE_NAME = 'pipeline-queue';

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
});

pipelineQueue.on('error', (err: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.warn('[BullMQ Queue] Queue warning:', err.message);
  }
});
