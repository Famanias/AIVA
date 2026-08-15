import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, interpolate, spring, Img, Video } from 'remotion';

interface CharacterRigProps {
  model?: any;
  params?: any;
  wordTimings?: any[];
}

export const CharacterRig: React.FC<CharacterRigProps> = ({ model, params = {} }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  // 1. Resolve current active scene
  const currentScene = model?.scenes?.find(
    (s: any) => frame >= s.startFrame && frame < s.startFrame + s.durationInFrames
  ) || model?.scenes?.[0] || {};

  const sceneFrame = Math.max(0, frame - (currentScene?.startFrame || 0));
  const rawAction = String(currentScene?.characterAction || currentScene?.action || params?.action || 'talk').toLowerCase();
  
  // Normalize action name
  let action = 'talk';
  if (rawAction.includes('point')) action = 'point';
  else if (rawAction.includes('walk')) action = 'walk';
  else if (rawAction.includes('shrug')) action = 'shrug';
  else if (rawAction.includes('idle') || rawAction.includes('stand')) action = 'idle';

  // Resolve background asset for self-contained rendering
  const rawAssetUrl = currentScene?.assetUrl || model?.scenes?.[0]?.assetUrl || params?.assetUrl || params?.asset_url || '';
  let assetUrl = rawAssetUrl;
  if (typeof assetUrl === 'string' && assetUrl.length > 0 && !assetUrl.startsWith('http://') && !assetUrl.startsWith('https://') && !assetUrl.startsWith('data:') && !assetUrl.startsWith('file:///')) {
    assetUrl = `file:///${assetUrl.replace(/\\/g, '/')}`;
  }

  const isVideo = typeof assetUrl === 'string' && (
    assetUrl.endsWith('.mp4') || assetUrl.endsWith('.webm') || assetUrl.includes('/video/')
  );
  const isImage = typeof assetUrl === 'string' && (
    assetUrl.endsWith('.jpg') || assetUrl.endsWith('.jpeg') || assetUrl.endsWith('.png') ||
    assetUrl.endsWith('.webp') || assetUrl.startsWith('data:image/') || assetUrl.includes('pollinations.ai') || assetUrl.includes('pexels.com/photos')
  );

  // 2. Physics & Motion (Breathing, Bobbing, Gestures)
  const bounce = Math.sin(sceneFrame * 0.18) * 8;
  const breath = Math.sin(sceneFrame * 0.08) * 3;

  // Speech animation (mouth movement)
  const isTalking = action === 'talk';
  const mouthCycle = Math.abs(Math.sin(sceneFrame * 0.45));
  const mouthHeight = isTalking ? interpolate(mouthCycle, [0, 1], [3, 14]) : 3;

  // Blink cycle (blinks every ~3.5 seconds for 4 frames)
  const isBlinking = (sceneFrame % 100) > 94;

  // Dynamic arm angles based on action
  let leftArmX = 140;
  let leftArmY = 280;
  let rightArmX = 260;
  let rightArmY = 280;
  let headTilt = 0;

  if (action === 'talk') {
    // Left arm relaxed, right arm animated gesturing
    leftArmX = 135 + Math.sin(sceneFrame * 0.1) * 4;
    leftArmY = 285;
    rightArmX = 275 + Math.sin(sceneFrame * 0.3) * 15;
    rightArmY = 210 + Math.cos(sceneFrame * 0.3) * 12;
    headTilt = Math.sin(sceneFrame * 0.15) * 4;
  } else if (action === 'point') {
    // Right arm firmly pointing up-right, left arm on hip
    leftArmX = 150;
    leftArmY = 250;
    rightArmX = 310;
    rightArmY = 160;
    headTilt = -6;
  } else if (action === 'walk') {
    // Arms and body swaying
    const swing = Math.sin(sceneFrame * 0.25) * 35;
    leftArmX = 140 + swing;
    leftArmY = 280;
    rightArmX = 260 - swing;
    rightArmY = 280;
  } else if (action === 'shrug') {
    // Both arms raised outward with palms up
    leftArmX = 120;
    leftArmY = 210 + Math.sin(sceneFrame * 0.15) * 6;
    rightArmX = 280;
    rightArmY = 210 + Math.sin(sceneFrame * 0.15) * 6;
    headTilt = 8;
  }

  // Leg poses
  const walkCycle = action === 'walk' ? Math.sin(sceneFrame * 0.25) * 25 : 0;
  const leftFootX = 160 - walkCycle;
  const rightFootX = 240 + walkCycle;

  // Scale and positioning relative to Canvas geometry
  const rigScale = Math.min(width / 1080, height / 1920) * 1.35;
  const rigBottom = height * 0.12;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0e1a', overflow: 'hidden' }}>
      {/* Background Media / Ambient Layer */}
      {isVideo && assetUrl ? (
        <AbsoluteFill style={{ zIndex: 0 }}>
          <Video
            src={assetUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            muted
            loop
          />
        </AbsoluteFill>
      ) : isImage && assetUrl ? (
        <AbsoluteFill style={{ zIndex: 0 }}>
          <Img
            src={assetUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            zIndex: 0,
            background: 'linear-gradient(135deg, #090d16 0%, #111827 50%, #0f172a 100%)',
          }}
        />
      )}

      {/* Subtle Vignette for Contrast */}
      <AbsoluteFill
        style={{
          zIndex: 1,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Stickman Vector Character Rig */}
      <div
        style={{
          position: 'absolute',
          zIndex: 2,
          bottom: `${rigBottom}px`,
          left: '50%',
          transform: `translateX(-50%) translateY(${bounce}px) scale(${rigScale})`,
          width: '400px',
          height: '500px',
          filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.65))',
        }}
      >

        <svg viewBox="0 0 400 500" width="100%" height="100%" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="stickGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Action Visual Cue: Pointing Glow */}
          {action === 'point' && (
            <circle
              cx="315"
              cy="155"
              r={12 + Math.sin(sceneFrame * 0.3) * 4}
              fill="#fbbf24"
              opacity="0.85"
            />
          )}

          {/* Left Leg */}
          <path
            d={`M 200 330 Q 180 390 ${leftFootX} 460`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="11"
            strokeLinecap="round"
            filter="url(#stickGlow)"
          />

          {/* Right Leg */}
          <path
            d={`M 200 330 Q 220 390 ${rightFootX} 460`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="11"
            strokeLinecap="round"
            filter="url(#stickGlow)"
          />

          {/* Torso / Spine */}
          <line
            x1="200"
            y1="190"
            x2="200"
            y2={`calc(330px + ${breath}px)`}
            stroke="#ffffff"
            strokeWidth="12"
            strokeLinecap="round"
            filter="url(#stickGlow)"
          />

          {/* Left Arm */}
          <path
            d={`M 200 215 Q 170 245 ${leftArmX} ${leftArmY}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#stickGlow)"
          />

          {/* Right Arm */}
          <path
            d={`M 200 215 Q 230 245 ${rightArmX} ${rightArmY}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="10"
            strokeLinecap="round"
            filter="url(#stickGlow)"
          />

          {/* Head Group with Tilt */}
          <g transform={`rotate(${headTilt}, 200, 120)`}>
            {/* Head Outline */}
            <circle
              cx="200"
              cy="120"
              r="48"
              fill="#0f172a"
              stroke="#ffffff"
              strokeWidth="10"
              filter="url(#stickGlow)"
            />

            {/* Left Eye */}
            <ellipse
              cx="184"
              cy="114"
              rx="4"
              ry={isBlinking ? 1 : 6}
              fill="#ffffff"
            />

            {/* Right Eye */}
            <ellipse
              cx="216"
              cy="114"
              rx="4"
              ry={isBlinking ? 1 : 6}
              fill="#ffffff"
            />

            {/* Mouth (Reactive talking animation) */}
            {isTalking ? (
              <path
                d={`M 186 138 Q 200 ${138 + mouthHeight} 214 138`}
                fill={mouthHeight > 8 ? '#ffffff' : 'none'}
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M 188 138 Q 200 146 212 138"
                fill="none"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
