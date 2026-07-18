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
export class WorkerGateway {
  private readonly baseUrl: string
  private readonly authToken: string

  constructor() {
    // In local dev, docker-compose exposes the python workers at http://workers:8000
    // In production, this would be an internal network DNS or URL
    this.baseUrl = process.env.WORKERS_API_URL || 'http://localhost:8000'
    this.authToken = process.env.WORKERS_INTERNAL_AUTH_TOKEN || 'dev-token'
  }

  /**
   * Executes a remote call to a worker.
   * 
   * @param path The relative API path (e.g. '/api/v1/research')
   * @param payload The JSON payload to send
   * @param timeoutMs Maximum time to wait before aborting
   * @returns The JSON response from the worker
   */
  async execute<T>(path: string, payload: any, timeoutMs: number): Promise<T> {
    const startTime = performance.now()
    console.log(`[WorkerGateway] Initiating call to ${path} (Timeout: ${timeoutMs}ms)`)
    
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Worker HTTP Error ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const durationMs = performance.now() - startTime
      console.log(`[WorkerGateway] Successfully completed call to ${path} in ${durationMs.toFixed(2)}ms`)
      
      // In production, emit to Telemetry service / job_events table
      // e.g., Telemetry.recordEvent({ name: 'stage_executed', path, durationMs })
      
      return data as T

    } catch (error: any) {
      console.error(`[WorkerGateway] Call to ${path} failed:`, error.message)
      throw error // Let BullMQ catch this and handle the retry logic
    }
  }
}

export const workerGateway = new WorkerGateway()
