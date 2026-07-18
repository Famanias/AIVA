import { Composition } from 'remotion';
import { CharacterRig } from './character-rig/CharacterRig';
import { KenBurns } from './ken-burns/KenBurns';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="default_stickman"
        component={CharacterRig}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          params: {},
          wordTimings: []
        }}
      />
      <Composition
        id="default_ken_burns"
        component={KenBurns}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          params: {},
          wordTimings: []
        }}
      />
    </>
  );
};
