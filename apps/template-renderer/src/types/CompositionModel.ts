export interface CompositionModel {
  version: 1
  totalDurationInFrames: number
  fps: number
  width: number
  height: number
  audioUrl?: string
  scenes: Array<Scene>
  subtitles: Array<Subtitle>
}

export interface Scene {
  id: string
  startFrame: number
  durationInFrames: number
  assetUrl?: string
  transition?: string
  characterAction?: string
}

export interface Subtitle {
  text: string
  startFrame: number
  durationInFrames: number
}

export interface RenderMetrics {
  infrastructure: {
    chromiumStartupMs: number
    browserReuse: boolean
  }
  rendering: {
    frameCount: number
    renderDurationMs: number
    fpsAchieved: number
  }
  output: {
    fileSizeBytes?: number
    resolution: string
    codec: string
    audioDurationMs?: number
  }
}

export interface RenderResult {
  outputs: {
    video?: string
    thumbnail?: string
    preview?: string
  }
  duration: number
  frameCount: number
  fps: number
  renderTimeMs: number
  template: string
  codec: string
  metrics: RenderMetrics
}
