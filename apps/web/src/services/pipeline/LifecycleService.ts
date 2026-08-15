import { query } from '@aiva/database'

export class CancellationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CancellationError'
  }
}

export class PauseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PauseError'
  }
}

export class LifecycleService {
  private static cache = new Map<string, { isCancelled: boolean; isPaused: boolean; expiresAt: number }>()
  private static CACHE_TTL_MS = 500

  static async getLifecycleState(jobId: string): Promise<{ isCancelled: boolean; isPaused: boolean }> {
    const now = Date.now()
    const cleanJobId = typeof jobId === 'string' && jobId.includes('_') ? jobId.split('_')[0] : jobId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!cleanJobId || !uuidRegex.test(cleanJobId)) {
      return { isCancelled: false, isPaused: false }
    }

    const cached = this.cache.get(cleanJobId)

    if (cached && cached.expiresAt > now) {
      return { isCancelled: cached.isCancelled, isPaused: cached.isPaused }
    }

    try {
      const res = await query(
        `SELECT cancel_requested_at, pause_requested_at FROM public.jobs WHERE id = $1 LIMIT 1`,
        [cleanJobId]
      )

      const jobData = res.rows[0]
      const isCancelled = jobData && jobData.cancel_requested_at != null
      const isPaused = jobData && jobData.pause_requested_at != null

      this.cache.set(cleanJobId, { isCancelled: !!isCancelled, isPaused: !!isPaused, expiresAt: now + this.CACHE_TTL_MS })
      
      return { isCancelled: !!isCancelled, isPaused: !!isPaused }
    } catch (err: any) {
      console.error('[LifecycleService] Failed to query lifecycle state:', err.message)
      return { isCancelled: false, isPaused: false }
    }
  }

  static async throwIfCancelledOrPaused(jobId: string): Promise<void> {
    const state = await this.getLifecycleState(jobId)
    
    if (state.isCancelled) {
      throw new CancellationError(`Job ${jobId} was cancelled by operator.`)
    }
    
    if (state.isPaused) {
      throw new PauseError(`Job ${jobId} was paused by operator.`)
    }
  }
}

