import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, Img, Video, spring, interpolate } from 'remotion';

export const KenBurns: React.FC<{ model?: any; params?: any; wordTimings?: any[] }> = ({
  model,
  params = {},
  wordTimings = [],
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const currentScene = model?.scenes?.find(
    (s: any) => frame >= s.startFrame && frame < s.startFrame + s.durationInFrames
  ) || model?.scenes?.[0] || {};

  const sceneFrame = Math.max(0, frame - (currentScene?.startFrame || 0));
  const sceneDuration = currentScene?.durationInFrames || durationInFrames;
  const rawAssetUrl = currentScene?.assetUrl || model?.scenes?.[0]?.assetUrl || params?.assetUrl || params?.asset_url || '';
  
  // Format local Windows/Unix paths for Chromium Img/Video elements
  let assetUrl = rawAssetUrl;
  if (typeof assetUrl === 'string' && assetUrl.length > 0 && !assetUrl.startsWith('http://') && !assetUrl.startsWith('https://') && !assetUrl.startsWith('data:') && !assetUrl.startsWith('file:///')) {
    assetUrl = `file:///${assetUrl.replace(/\\/g, '/')}`;
  }

  const isVideo = typeof assetUrl === 'string' && (
    assetUrl.endsWith('.mp4') || assetUrl.endsWith('.webm') || assetUrl.includes('/video/')
  );
  const isImage = typeof assetUrl === 'string' && (
    assetUrl.endsWith('.jpg') || assetUrl.endsWith('.jpeg') || assetUrl.endsWith('.png') ||
    assetUrl.endsWith('.webp') || assetUrl.includes('pollinations.ai') || assetUrl.includes('pexels.com/photos')
  );

  // Smooth cinematic pan & zoom spring animation per scene
  const progress = spring({
    frame: sceneFrame,
    fps,
    config: {
      damping: 200,
    },
    durationInFrames: Math.max(sceneDuration, 30),
  });

  const scale = interpolate(progress, [0, 1], [1.0, 1.15]);
  const translateY = interpolate(progress, [0, 1], [0, -20]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f', overflow: 'hidden' }}>
      {/* Visual Media Layer */}
      {isVideo && assetUrl ? (
        <AbsoluteFill>
          <Video
            src={assetUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale})`,
            }}
            muted
            loop
          />
        </AbsoluteFill>
      ) : isImage && assetUrl ? (
        <AbsoluteFill>
          <Img
            src={assetUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${scale}) translateY(${translateY}px)`,
            }}
          />
        </AbsoluteFill>
      ) : (
        /* Dynamic Cinematic Ambient Background if no direct asset passed */
        <AbsoluteFill
          style={{
            background: 'linear-gradient(135deg, #090d16 0%, #111827 50%, #0f172a 100%)',
          }}
        />
      )}

      {/* Subtle Cinematic Vignette / Gradient for subtitle contrast */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.3) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
