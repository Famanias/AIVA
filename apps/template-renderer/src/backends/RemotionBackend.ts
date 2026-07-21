import { IRenderBackend } from './IRenderBackend'
import { RenderJob } from '../types/RenderJob'
import { RenderResult, CompositionModel } from '../types/CompositionModel'
import { IRenderingTemplate } from '../templates/IRenderingTemplate'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { bundle } from '@remotion/bundler'
import path from 'path'
import os from 'os'
import fs from 'fs'

export class RemotionBackend implements IRenderBackend {
  private bundleLocation: string | null = null

  private async getBundle() {
    if (!this.bundleLocation) {
      const startBundle = Date.now()
      this.bundleLocation = await bundle({
        // In a real app this points to the Remotion Root.
        entryPoint: path.resolve(__dirname, '../templates/index.ts'),
        webpackOverride: (config) => config,
        ignoreRegisterRootWarning: true,
      })
      console.log(`[RemotionBackend] Bundled in ${Date.now() - startBundle}ms to ${this.bundleLocation}`)
    }
    return this.bundleLocation
  }

  async render(
    job: RenderJob,
    composition: CompositionModel,
    template: IRenderingTemplate
  ): Promise<RenderResult> {
    const startTime = Date.now()
    const serveUrl = await this.getBundle()
    const chromiumStart = Date.now()

    // Pass the CompositionModel down to the root component
    const inputProps = { model: composition }

    const remotionComposition = await selectComposition({
      serveUrl,
      id: template.id,
      inputProps,
    })

    const chromiumStartupMs = Date.now() - chromiumStart

    // Ensure output dir exists
    const outDir = path.resolve(process.cwd(), 'output')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const outputPath = path.resolve(
      outDir,
      `${job.id}_${template.id}_${Date.now()}.webm`
    )

    const renderStart = Date.now()

    await renderMedia({
      composition: remotionComposition,
      serveUrl,
      codec: 'vp9',
      outputLocation: outputPath,
      inputProps,
      concurrency: job.config.maxConcurrency
    })

    const renderDurationMs = Date.now() - renderStart
    const fpsAchieved = composition.totalDurationInFrames / (renderDurationMs / 1000)

    let fileSizeBytes = 0
    if (fs.existsSync(outputPath)) {
      fileSizeBytes = fs.statSync(outputPath).size
    }

    return {
      outputs: {
        video: outputPath
      },
      duration: composition.totalDurationInFrames / composition.fps,
      frameCount: composition.totalDurationInFrames,
      fps: composition.fps,
      renderTimeMs: Date.now() - startTime,
      template: template.id,
      codec: job.config.codec,
      metrics: {
        infrastructure: {
          chromiumStartupMs,
          browserReuse: false // Remotion handles this internally unless we use custom browser
        },
        rendering: {
          frameCount: composition.totalDurationInFrames,
          renderDurationMs,
          fpsAchieved
        },
        output: {
          fileSizeBytes,
          resolution: `${composition.width}x${composition.height}`,
          codec: job.config.codec
        }
      }
    }
  }
}
