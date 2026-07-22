import { Composition } from 'remotion';
import { CharacterRig } from './character-rig/CharacterRig';
import { KenBurns } from './ken-burns/KenBurns';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="stickman"
        component={CharacterRig}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          params: {},
          wordTimings: []
        }}
      />
      <Composition
        id="documentary"
        component={KenBurns}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          params: {},
          wordTimings: []
        }}
      />
    </>
  );
};
