import { z } from 'zod'
import { Database } from '@aiva/shared-types'
import { IPipelineLogger } from './PipelineLogger'

/**
 * Strict schema for the job's state_payload JSON.
 * This prevents unstructured data from accumulating as the pipeline progresses.
 */
export const PipelineStateSchema = z.object({
  research: z.any().optional(),
  outline: z.any().optional(),
  script: z.any().optional(),
  voice: z.any().optional(),
  assets: z.any().optional(),
  render: z.any().optional(),
  metadata: z.any().optional(),
  scenes: z.any().optional(),
}).passthrough()

export type PipelineState = z.infer<typeof PipelineStateSchema>

/**
 * The unified context object passed to every stage handler in the pipeline.
 * Contains everything a handler needs to execute its isolated task.
 */
export interface PipelineContext {
  project: Database['public']['Tables']['projects']['Row'] | any
  job: Database['public']['Tables']['jobs']['Row'] | any
  state: PipelineState
  logger: IPipelineLogger
  config: Record<string, any>
  db?: any
}

