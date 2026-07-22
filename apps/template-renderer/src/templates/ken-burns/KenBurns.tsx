import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, Img, spring } from 'remotion';

export const KenBurns: React.FC<{ params: any; wordTimings: any[] }> = ({ params, wordTimings }) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 200,
    },
    durationInFrames: durationInFrames,
  }) * 0.2 + 1; // 1 to 1.2

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* 
        This is a transparent overlay layer. 
        The FFmpeg compositor will place the downloaded Pexels/SDXL background tracks underneath this layer, 
        and the SubtitleGenerator will burn the Whisper subtitles on top of it.
      */}
    </AbsoluteFill>
  );
};
