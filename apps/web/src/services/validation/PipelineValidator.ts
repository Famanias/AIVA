import fs from 'fs'
import path from 'path'
import { StageMetrics, ValidationReporter } from './ValidationReporter'
import { InvariantChecker } from './InvariantChecker'
import { RendererCompatChecker } from './RendererCompatChecker'
import { stageRegistry } from '../pipeline/StageRegistry'
import { PipelineContext } from '../pipeline/PipelineContext'

export class PipelineValidator {
  
  static async runFastMode(jobId: string, topic: string) {
    const artifactDir = path.join(process.cwd(), '.artifacts', jobId)
    fs.mkdirSync(artifactDir, { recursive: true })

    const metrics: Record<string, StageMetrics> = {}
    let state: any = {
      job: { id: jobId },
      project: { id: 'test_project', topic, video_style: 'stickman', duration_target_minutes: 3 }
    }

    const stages = ['research', 'outline', 'script_direction', 'voiceover', 'subtitle_extraction', 'assets']
    const totalStart = Date.now()

    for (const stage of stages) {
      console.log(`[Validator] Running stage: ${stage}`)
      const stageStart = Date.now()
      
      const metric: StageMetrics = { durationMs: 0, retries: 0, errors: [], passed: false }
      
      try {
        const handler = stageRegistry.getHandler(stage)
        
        // Mock PipelineContext for FastMode
        const context = {
          job: { id: jobId } as any,
          project: state.project as any,
          state,
          logger: {
            info: async () => {},
            error: async () => {},
            warn: async () => {},
            debug: async () => {}
          },
          config: {},
          db: {} as any
        } as PipelineContext

        await handler.execute(context)
        
        // Check invariants
        const invariantErrors = InvariantChecker.check(stage, state)
        if (invariantErrors.length > 0) {
          metric.errors.push(...invariantErrors)
          throw new Error(`Invariants failed: ${invariantErrors.join(', ')}`)
        }

        metric.passed = true
      } catch (e: any) {
        metric.errors.push(e.message)
      } finally {
        metric.durationMs = Date.now() - stageStart
        metrics[stage] = metric
        
        // Snapshot
        fs.writeFileSync(path.join(artifactDir, `${stage}.json`), JSON.stringify(state, null, 2))
      }

      // Fast fail
      if (!metric.passed) {
        console.error(`[Validator] Halting at failed stage: ${stage}`)
        break
      }
    }

    // Compat Check
    if (metrics['assets']?.passed) {
      console.log(`[Validator] Running Renderer Compatibility Check`)
      const compatStart = Date.now()
      
      // Construct Version 1 IR
      const ir = {
        version: 1,
        templateFamily: state.project.video_style,
        metadata: { projectId: state.project.id, jobId: state.job.id, topic: state.project.topic },
        voice: { wordTimings: state.voice.wordTimings, audioUrl: state.voice.audioUrl },
        scenes: state.scenes
      } as any

      fs.writeFileSync(path.join(artifactDir, `pipeline_ir.json`), JSON.stringify(ir, null, 2))

      const compatErrors = await RendererCompatChecker.check(ir)
      metrics['renderer_compatibility'] = {
        durationMs: Date.now() - compatStart,
        retries: 0,
        errors: compatErrors,
        passed: compatErrors.length === 0
      }
    }

    const totalDurationMs = Date.now() - totalStart
    ValidationReporter.writeReport(jobId, topic, metrics, totalDurationMs)
  }
}
