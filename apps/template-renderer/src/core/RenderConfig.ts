export interface RenderConfig {
  width: number
  height: number
  fps: number
  maxConcurrency: number
  codec: 'h264' | 'vp8' | 'vp9'
  pixelFormat: string
  audioCodec: string
  videoCodec: string
  imageFormat: 'jpeg' | 'png' | 'webp'
  quality: number
  crf: number
  audioBitrate: string
  videoBitrate: string
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  width: 1080,
  height: 1920,
  fps: 30,
  maxConcurrency: parseInt(process.env.CHROMIUM_POOL_SIZE || process.env.MAX_CONCURRENCY || '1', 10),
  codec: 'h264',
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  videoCodec: 'libx264',
  imageFormat: 'jpeg',
  quality: 80,
  crf: 23,
  audioBitrate: '192k',
  videoBitrate: '4000k'
}
