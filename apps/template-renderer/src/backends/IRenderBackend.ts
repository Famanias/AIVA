import { RenderJob } from '../types/RenderJob'
import { RenderResult, CompositionModel } from '../types/CompositionModel'
import { IRenderingTemplate } from '../templates/IRenderingTemplate'

export interface IRenderBackend {
  /**
   * Executes the render process for a given composition model and template.
   * Returns a promise containing the structured RenderResult.
   */
  render(
    job: RenderJob,
    composition: CompositionModel,
    template: IRenderingTemplate
  ): Promise<RenderResult>
}
