import { Database } from '@aiva/shared-types'

export type JobRow = Database['public']['Tables']['jobs']['Row']
export type JobEventRow = Database['public']['Tables']['job_events']['Row']
export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type PipelineLogRow = Database['public']['Tables']['pipeline_logs']['Row']

/**
 * Health status of infrastructure and external providers.
 */
export interface SystemHealth {
  infrastructure: {
    redis: 'connected' | 'disconnected' | 'checking'
    postgres: 'connected' | 'disconnected' | 'checking'
    worker: 'online' | 'offline' | 'checking'
  }
  providers: {
    llm: 'configured' | 'missing_keys' | 'checking'
    tts: 'configured' | 'missing_keys' | 'checking'
  }
}

/**
 * Clean UI representation of a pipeline stage
 */
export interface PipelineStage {
  id: string
  label: string
  status: 'completed' | 'running' | 'pending' | 'failed' | 'paused' | 'cancelling' | 'cancelled'
  startedAt?: string
  completedAt?: string
  errorReason?: string
}

/**
 * Defines the status of generation artifacts for a given job.
 */
export interface ArtifactStatus {
  research: 'pending' | 'generating' | 'ready'
  outline: 'pending' | 'generating' | 'ready'
  script: 'pending' | 'generating' | 'ready'
  voiceover: 'pending' | 'generating' | 'ready'
  assets: 'pending' | 'generating' | 'ready'
  finalVideo: 'pending' | 'generating' | 'ready'
}

/**
 * High-level observability metrics for the job.
 */
export interface PipelineMetrics {
  stageDurationMs: number
  totalTimeMs: number
  retryCount: number
}

/**
 * The consolidated frontend state model for the Operations Dashboard.
 * Isolates the UI components from raw database schemas.
 */
export interface PipelineTelemetry {
  project: ProjectRow | null
  job: JobRow | null
  events: JobEventRow[]
  logs: PipelineLogRow[]
  health: SystemHealth
  stages: PipelineStage[]
  artifacts: ArtifactStatus
  metrics: PipelineMetrics
}
