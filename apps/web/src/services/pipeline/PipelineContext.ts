import { z } from 'zod'
import { Database } from '@aiva/shared-types/src/database.types'
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Strict schema for the job's state_payload JSON.
 * This prevents unstructured data from accumulating as the pipeline progresses.
 */
export const PipelineStateSchema = z.object({
  research: z.record(z.any()).optional(),
  outline: z.record(z.any()).optional(),
  script: z.record(z.any()).optional(),
  voice: z.record(z.any()).optional(),
  assets: z.record(z.any()).optional(),
  render: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
}).passthrough() // Allow other keys during MVP evolution, but strict typing for knowns

export type PipelineState = z.infer<typeof PipelineStateSchema>

/**
 * The unified context object passed to every stage handler in the pipeline.
 * Contains everything a handler needs to execute its isolated task.
 */
export interface PipelineContext {
  project: Database['public']['Tables']['projects']['Row']
  job: Database['public']['Tables']['jobs']['Row']
  state: PipelineState
  logger: {
    info: (msg: string) => Promise<void>
    error: (msg: string, err?: any) => Promise<void>
  }
  config: Record<string, any>
  db: SupabaseClient<Database>
}
