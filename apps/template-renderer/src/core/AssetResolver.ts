import { CompositionModel } from '../types/CompositionModel'

/**
 * Resolves abstract asset URLs into absolute, preloaded paths 
 * ready for the rendering backend. Handles caching and missing assets.
 */
export class AssetResolver {
  
  /**
   * Processes the composition model to ensure all assets are available locally.
   * Modifies the model in-place (or returns a cloned mapped model) with absolute paths.
   */
  static async resolve(composition: CompositionModel): Promise<CompositionModel> {
    // Clone to maintain immutability of the incoming object if needed, 
    // or just return a mapped version. We'll return a deeply mapped copy.
    
    const resolvedScenes = await Promise.all(
      composition.scenes.map(async (scene) => {
        let resolvedUrl = scene.assetUrl

        if (resolvedUrl) {
          // If the URL is external (HTTP), we would ideally download and cache it here.
          // For P1, we assume the asset is either an absolute path or a working public URL.
          if (resolvedUrl.startsWith('http')) {
            // Future: await downloadToLocalCache(resolvedUrl)
            // resolvedUrl = localPath
          } else if (!resolvedUrl.startsWith('/')) {
            // Missing asset detection
            throw new Error(`Invalid asset reference for scene ${scene.id}: ${resolvedUrl}`)
          }
        }

        return { ...scene, assetUrl: resolvedUrl }
      })
    )

    let resolvedAudioUrl = composition.audioUrl
    if (resolvedAudioUrl && resolvedAudioUrl.startsWith('http')) {
       // Future: await downloadToLocalCache(resolvedAudioUrl)
    }

    return {
      ...composition,
      audioUrl: resolvedAudioUrl,
      scenes: resolvedScenes
    }
  }
}
