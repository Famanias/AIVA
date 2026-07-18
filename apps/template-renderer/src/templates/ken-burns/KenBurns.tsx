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
    <AbsoluteFill style={{ backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `scale(${scale})` }}>
        <h1 style={{ color: 'white', fontSize: '100px', fontFamily: 'sans-serif' }}>
          Ken Burns Stub
        </h1>
      </div>
    </AbsoluteFill>
  );
};
