import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';

export const CharacterRig: React.FC<{ params: any; wordTimings: any[] }> = ({ params, wordTimings }) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

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
