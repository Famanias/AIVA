import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame } from 'remotion';

export const CharacterRig: React.FC<{ params: any; wordTimings: any[] }> = ({ params, wordTimings }) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ fontSize: '100px', fontFamily: 'sans-serif' }}>
        Character Rig Stub
      </h1>
      <p style={{ fontSize: '40px', fontFamily: 'sans-serif' }}>
        Frame {frame} / {durationInFrames}
      </p>
    </AbsoluteFill>
  );
};
