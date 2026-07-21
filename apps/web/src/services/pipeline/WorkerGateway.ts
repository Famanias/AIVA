/**
 * The WorkerGateway acts as the single choke-point for communicating with the
 * isolated Python AI workers and Node.js render servers.
 * 
 * Benefits:
 * - Centralized auth
 * - Centralized logging
 * - Stage-specific timeouts
 * - Single point for tracing and metrics
 */
import { LifecycleService } from './LifecycleService'

export class WorkerGateway {
  private readonly baseUrl: string
  private readonly authToken: string

  constructor() {
    this.baseUrl = process.env.WORKERS_API_URL || 'http://localhost:8000'
    this.authToken = process.env.WORKERS_INTERNAL_AUTH_TOKEN || 'dev-token'
  }

  async execute<T>(path: string, payload: any, timeoutMs: number): Promise<T> {
    const startTime = performance.now()
    console.log(`[WorkerGateway] Initiating call to ${path} (Timeout: ${timeoutMs}ms)`)
    
    const abortController = new AbortController()
    let pollingInterval: NodeJS.Timeout | null = null
    const jobId = payload.trace_id // Extracted from standard handler payloads

    if (jobId) {
      pollingInterval = setInterval(async () => {
        try {
          await LifecycleService.throwIfCancelledOrPaused(jobId)
        } catch (error: any) {
          abortController.abort(error)
          if (pollingInterval) clearInterval(pollingInterval)
        }
      }, 5000)
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const onTimeout = () => abortController.abort(new Error('Timeout'))
    timeoutSignal.addEventListener('abort', onTimeout)

    try {
      const fetchUrl = path.startsWith('http://') || path.startsWith('https://') 
        ? path 
        : `${this.baseUrl}${path}`
        
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify(payload),
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Worker HTTP Error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const durationMs = performance.now() - startTime
      console.log(`[WorkerGateway] Successfully completed call to ${path} in ${durationMs.toFixed(2)}ms`)
      
      return data as T
    } catch (error: any) {
      if (error.name === 'AbortError' && abortController.signal.reason) {
        console.log(`[WorkerGateway] Call to ${path} aborted by lifecycle orchestration.`)
        throw abortController.signal.reason
      }
      console.error(`[WorkerGateway] Call to ${path} failed:`, error.message)
      throw error
    } finally {
      timeoutSignal.removeEventListener('abort', onTimeout)
      if (pollingInterval) clearInterval(pollingInterval)
    }
  }
}

export const workerGateway = new WorkerGateway()
