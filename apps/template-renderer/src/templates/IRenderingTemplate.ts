import React from 'react'
import { CompositionModel } from '../types/CompositionModel'

export interface IRenderingTemplate {
  id: string
  displayName: string
  
  /**
   * Array of supported aspect ratios (e.g., ['16:9', '9:16', '1:1'])
   */
  supportedAspectRatios: string[]
  
  /**
   * Array of supported framerates (e.g., [24, 30, 60])
   */
  supportedFrameRates: number[]

  /**
   * Validates if this template can render the provided CompositionModel.
   * Throws an error with a descriptive message if unsupported.
   */
  validate(model: CompositionModel): void

  /**
   * Builds and returns the top-level React component for the Remotion composition.
   */
  buildComposition(model: CompositionModel): React.ReactNode
}
