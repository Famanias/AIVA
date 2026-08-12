import { createClient } from '@supabase/supabase-js'
import { Database } from '@aiva/shared-types'

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
  private static CACHE_TTL_MS = 2000

  static async getLifecycleState(jobId: string): Promise<{ isCancelled: boolean; isPaused: boolean }> {
    const now = Date.now()
    const cached = this.cache.get(jobId)

    if (cached && cached.expiresAt > now) {
      return { isCancelled: cached.isCancelled, isPaused: cached.isPaused }
    }

    const adminSupabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await adminSupabase
      .from('jobs')
      .select('cancel_requested_at, pause_requested_at')
      .eq('id', jobId)
      .single()

    const jobData = data as any
    const isCancelled = !error && jobData && jobData.cancel_requested_at != null
    const isPaused = !error && jobData && jobData.pause_requested_at != null

    this.cache.set(jobId, { isCancelled, isPaused, expiresAt: now + this.CACHE_TTL_MS })
    
    return { isCancelled, isPaused }
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
