import React from 'react'
import { IRenderingTemplate } from '../IRenderingTemplate'
import { CompositionModel } from '../../types/CompositionModel'
// import { Composition } from 'remotion' // For actual remotion rendering

export class DocumentaryTemplate implements IRenderingTemplate {
  id = 'documentary'
  displayName = 'Ken-Burns Documentary'
  supportedAspectRatios = ['16:9', '9:16', '1:1']
  supportedFrameRates = [30, 60]

  validate(model: CompositionModel): void {
    if (model.scenes.length === 0) {
      throw new Error('Documentary template requires at least one scene.')
    }
  }

  buildComposition(model: CompositionModel): React.ReactNode {
    // In a full implementation, this returns a <Composition> configured
    // with Remotion `<Sequence>` components mapping the scenes array.
    return (
      <div style={{ flex: 1, backgroundColor: 'black', color: 'white' }}>
        {model.scenes.map(scene => (
          <div key={scene.id}>
            Render Scene {scene.id} from frame {scene.startFrame} for {scene.durationInFrames}
          </div>
        ))}
      </div>
    )
  }
}
