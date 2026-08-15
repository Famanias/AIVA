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
  private bundlePromise: Promise<string> | null = null

  private async getBundle() {
    if (!this.bundlePromise) {
      const startBundle = Date.now()
      this.bundlePromise = bundle({
        entryPoint: path.resolve(__dirname, '../templates/index.ts'),
        webpackOverride: (config) => config,
        ignoreRegisterRootWarning: true,
      }).then((loc) => {
        console.log(`[RemotionBackend] Bundled in ${Date.now() - startBundle}ms to ${loc}`)
        return loc
      })
    }
    return this.bundlePromise
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

    const isH264 = job.config.codec === 'h264'
    const ext = isH264 ? 'mp4' : 'webm'
    const outputPath = path.resolve(
      outDir,
      `${job.id}_${template.id}_${Date.now()}.${ext}`
    )

    const renderStart = Date.now()
    const targetDurationInFrames = Math.max(1, composition.totalDurationInFrames)

    await renderMedia({
      composition: {
        ...remotionComposition,
        durationInFrames: targetDurationInFrames,
        width: job.config.width,
        height: job.config.height,
        fps: job.config.fps,
      },
      serveUrl,
      codec: job.config.codec || 'h264',
      pixelFormat: isH264 ? 'yuv420p' : 'yuva420p',
      imageFormat: isH264 ? 'jpeg' : 'png',
      outputLocation: outputPath,
      inputProps,
      concurrency: job.config.maxConcurrency || Math.min(4, os.cpus().length),
      chromiumOptions: {
        disableWebSecurity: true,
        ignoreCertificateErrors: true,
      },
    })

    const renderDurationMs = Date.now() - renderStart
    const fpsAchieved = targetDurationInFrames / (Math.max(1, renderDurationMs) / 1000)

    let fileSizeBytes = 0
    if (fs.existsSync(outputPath)) {
      fileSizeBytes = fs.statSync(outputPath).size
    }

    return {
      outputs: {
        video: outputPath,
      },
      duration: targetDurationInFrames / composition.fps,
      frameCount: targetDurationInFrames,
      fps: composition.fps,
      renderTimeMs: Date.now() - startTime,
      template: template.id,
      codec: job.config.codec,
      metrics: {
        infrastructure: {
          chromiumStartupMs,
          browserReuse: false,
        },
        rendering: {
          fpsAchieved,
          frameCount: targetDurationInFrames,
          renderDurationMs,
        },
        output: {
          fileSizeBytes,
          resolution: `${job.config.width}x${job.config.height}`,
          codec: job.config.codec || 'h264',
        },
      },
    }
  }
}
