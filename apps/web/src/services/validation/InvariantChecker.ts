export class InvariantChecker {
  static check(stage: string, state: any): string[] {
    const errors: string[] = []

    switch (stage) {
      case 'research':
        if (!state.project?.topic) errors.push('Topic is missing from state.')
        break
        
      case 'outline':
        if (!state.outline || state.outline.length === 0) {
          errors.push('Outline is empty or missing.')
        }
        break
        
      case 'script_direction':
        if (!state.scenes || state.scenes.length === 0) {
          errors.push('Script generation produced zero scenes.')
        }
        break
        
      case 'voiceover':
        if (!state.voice?.audioUrl) {
          errors.push('Voiceover stage did not produce an audioUrl.')
        }
        break
        
      case 'subtitle_extraction':
        if (!state.voice?.wordTimings || state.voice.wordTimings.length === 0) {
          errors.push('Subtitle extraction failed to produce wordTimings.')
        } else {
          // Check if timestamps are chronologically sorted
          let lastTime = -1
          for (const word of state.voice.wordTimings) {
            if (word.start < lastTime) {
              errors.push(`Timestamps are not chronologically sorted. Found ${word.start} after ${lastTime}`)
              break
            }
            lastTime = word.start
          }
        }
        break
        
      case 'assets':
        if (!state.scenes || state.scenes.some((s: any) => !s.asset_manifest)) {
          errors.push('Assets stage finished, but not all scenes have an asset_manifest.')
        }
        break
    }

    return errors
  }
}
