import path from 'path'
import fs from 'fs'
import { CompositionModel } from '../types/CompositionModel'

/**
 * Resolves abstract asset URLs into absolute, preloaded paths 
 * ready for the rendering backend. Converts local image files to base64 Data URIs
 * so Chromium renders them instantly without cross-origin/file protocol restrictions.
 */
export class AssetResolver {
  
  static async resolve(composition: CompositionModel): Promise<CompositionModel> {
    const resolvedScenes = await Promise.all(
      composition.scenes.map(async (scene) => {
        let resolvedUrl = scene.assetUrl

        if (resolvedUrl) {
          const isHttp = resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')
          const isDataUri = resolvedUrl.startsWith('data:')
          const isWindowsAbs = /^[a-zA-Z]:[\\/]/.test(resolvedUrl)
          const isUnixAbs = resolvedUrl.startsWith('/')
          const isLocalAbs = path.isAbsolute(resolvedUrl) || isWindowsAbs || isUnixAbs

          if (!isHttp && !isDataUri && isLocalAbs && fs.existsSync(resolvedUrl)) {
            const ext = path.extname(resolvedUrl).toLowerCase()
            const mimeTypes: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
              '.mp4': 'video/mp4',
              '.webm': 'video/webm'
            }

            const mime = mimeTypes[ext]
            if (mime) {
              const fileBuffer = fs.readFileSync(resolvedUrl)
              resolvedUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`
            }
          } else if (!isHttp && !isDataUri && !isLocalAbs) {
            throw new Error(`Invalid asset reference for scene ${scene.id}: ${resolvedUrl}`)
          }
        }

        return { ...scene, assetUrl: resolvedUrl }
      })
    )

    return {
      ...composition,
      scenes: resolvedScenes
    }
  }
}
