import { PipelineIR } from './PipelineIR'
import { RenderConfig } from '../core/RenderConfig'

export interface RenderJob {
  id: string
  projectId: string
  templateId: string
  config: RenderConfig
  ir: PipelineIR
}
