import React from 'react'
import { IRenderingTemplate } from '../IRenderingTemplate'
import { CompositionModel } from '../../types/CompositionModel'

export class StickmanTemplate implements IRenderingTemplate {
  id = 'stickman'
  displayName = 'Animated Stickman'
  supportedAspectRatios = ['9:16']
  supportedFrameRates = [30]

  validate(model: CompositionModel): void {
    if (model.scenes.length === 0) {
      throw new Error('Stickman template requires scenes.')
    }
  }

  buildComposition(model: CompositionModel): React.ReactNode {
    return (
      <div style={{ flex: 1, backgroundColor: 'white', color: 'black' }}>
        {model.scenes.map(scene => (
          <div key={scene.id}>
            Render Stickman doing {scene.characterAction} for {scene.durationInFrames} frames
          </div>
        ))}
      </div>
    )
  }
}
