/**
 * Refactored Remotion Render Server
 *
 * Exposes a deterministic rendering pipeline:
 * PipelineIR -> TimelineGenerator -> AssetResolver -> RemotionBackend -> RenderResult
 */
import express from 'express'
import { PipelineIR } from './types/PipelineIR'
import { RenderJob } from './types/RenderJob'
import { DEFAULT_RENDER_CONFIG } from './core/RenderConfig'
import { generateTimeline } from './core/TimelineGenerator'
import { AssetResolver } from './core/AssetResolver'
import { templateRegistry } from './core/TemplateRegistry'
import { RemotionBackend } from './backends/RemotionBackend'
import './templates' // Register templates

const app = express()
app.use(express.json({ limit: '100mb' }))

// Initialize rendering backend
const renderBackend = new RemotionBackend()

app.post('/render', async (req, res) => {
  try {
    const body = req.body

    // 1. Validate Versioned IR
    if (body.version !== 1) {
      throw new Error(`Unsupported PipelineIR version: ${body.version}`)
    }

    const ir = body as PipelineIR
    
    // 2. Wrap in RenderJob (Injects dynamic CanvasConfig geometry)
    const canvasConfig = ir.metadata?.canvasConfig || {}
    const job: RenderJob = {
      id: `job_${Date.now()}`,
      projectId: ir.metadata?.projectId || 'unknown',
      templateId: ir.templateFamily,
      config: {
        ...DEFAULT_RENDER_CONFIG,
        width: canvasConfig.width || DEFAULT_RENDER_CONFIG.width,
        height: canvasConfig.height || DEFAULT_RENDER_CONFIG.height,
        fps: canvasConfig.fps || DEFAULT_RENDER_CONFIG.fps
      },
      ir
    }

    console.log(`[RenderServer] Processing job: ${job.id} with template: ${job.templateId}`)

    // 3. Resolve Template
    const template = templateRegistry.resolve(job.templateId)

    // 4. Generate Timeline (Deterministic)
    const rawComposition = generateTimeline(job.ir, job.config)
    
    // 5. Validate Template Constraints
    template.validate(rawComposition)

    // 6. Resolve Assets
    console.log(`[RenderServer] Resolving assets...`)
    const finalComposition = await AssetResolver.resolve(rawComposition)

    // 7. Render Execution
    console.log(`[RenderServer] Starting render engine...`)
    const result = await renderBackend.render(job, finalComposition, template)
    
    console.log(`[RenderServer] Job ${job.id} complete. FPS: ${result.metrics.rendering.fpsAchieved.toFixed(2)}`)

    // 8. Output Structured Result
    res.json({
      status: 'success',
      result
    })

  } catch (error) {
    console.error('[RenderServer] Render failed:', error)
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error && error.stack ? error.stack : undefined
    })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Template Renderer Framework active on port ${PORT}`)
})
