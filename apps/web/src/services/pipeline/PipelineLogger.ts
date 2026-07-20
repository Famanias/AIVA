import { createClient } from '@supabase/supabase-js'
import { Database } from '@aiva/shared-types'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  jobId: string
  stage?: string
  level: LogLevel
  source: string
  message: string
  metadata?: Record<string, any>
}

export interface IPipelineLogger {
  debug(msg: string, metadata?: Record<string, any>): Promise<void>
  info(msg: string, metadata?: Record<string, any>): Promise<void>
  warn(msg: string, metadata?: Record<string, any>): Promise<void>
  error(msg: string, error?: any, metadata?: Record<string, any>): Promise<void>
}

export class PipelineLogger implements IPipelineLogger {
  private db: ReturnType<typeof createClient<Database>>
  
  constructor(
    private jobId: string, 
    private stage: string | undefined, 
    private source: string = 'orchestrator',
    dbClient?: ReturnType<typeof createClient<Database>>
  ) {
    this.db = dbClient || createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  // Allow updating stage as pipeline progresses
  setStage(stage: string) {
    this.stage = stage
  }

  // Allow spawning a sub-logger for specific sources like workers
  withSource(source: string): PipelineLogger {
    return new PipelineLogger(this.jobId, this.stage, source, this.db)
  }

  private async log(level: LogLevel, message: string, metadata: Record<string, any> = {}) {
    // Console output for development
    if (level === 'error') {
      console.error(`[${this.source}] [${this.stage || 'init'}] ERROR: ${message}`, metadata)
    } else {
      console.log(`[${this.source}] [${this.stage || 'init'}] ${level.toUpperCase()}: ${message}`)
    }

    // Persist to Supabase
    try {
      await this.db.from('pipeline_logs').insert({
        job_id: this.jobId,
        stage: this.stage as any,
        level,
        source: this.source,
        message,
        metadata
      })
    } catch (e) {
      console.error(`Failed to persist pipeline log:`, e)
    }
  }

  async debug(message: string, metadata?: Record<string, any>) {
    if (process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'debug') {
      await this.log('debug', message, metadata)
    }
  }

  async info(message: string, metadata?: Record<string, any>) {
    await this.log('info', message, metadata)
  }

  async warn(message: string, metadata?: Record<string, any>) {
    await this.log('warn', message, metadata)
  }

  async error(message: string, error?: any, metadata?: Record<string, any>) {
    const errorMetadata = {
      ...metadata,
      error: error?.message || error?.toString(),
      stack: error?.stack
    }
    await this.log('error', message, errorMetadata)
  }
}
