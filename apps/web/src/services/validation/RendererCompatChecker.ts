import { PipelineIR } from '../../../../../template-renderer/src/types/PipelineIR'
import { generateTimeline } from '../../../../../template-renderer/src/core/TimelineGenerator'
import { DEFAULT_RENDER_CONFIG } from '../../../../../template-renderer/src/core/RenderConfig'
import { templateRegistry } from '../../../../../template-renderer/src/core/TemplateRegistry'
import { AssetResolver } from '../../../../../template-renderer/src/core/AssetResolver'

export class RendererCompatChecker {
  static async check(ir: PipelineIR): Promise<string[]> {
    const errors: string[] = []
    
    try {
      if (ir.version !== 1) {
        errors.push(`Invalid PipelineIR version: ${ir.version}`)
      }

      // Ensure template resolves
      const template = templateRegistry.resolve(ir.templateFamily)
      if (!template) {
        errors.push(`Template resolution failed for family: ${ir.templateFamily}`)
      }

      // Ensure timeline generates without throwing
      const composition = generateTimeline(ir, DEFAULT_RENDER_CONFIG)
      
      if (composition.totalDurationInFrames <= 0) {
        errors.push('Timeline generated 0 duration.')
      }

      // Ensure assets resolve without throwing
      await AssetResolver.resolve(composition)

      // Ensure template validation passes
      template.validate(composition)

    } catch (e: any) {
      errors.push(`Renderer compatibility check threw exception: ${e.message}`)
    }

    return errors
  }
}
