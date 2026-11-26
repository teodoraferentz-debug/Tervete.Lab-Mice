import { useEffect } from 'react';
import { BottomStack } from '../components/BottomStack';
import { Subtitles } from '../components/Subtitles';
import { useStage } from '../components/StageContext';
import { ZoneMarkers } from '../components/ZoneMarkers';
import { GUARDIANS, getGuardian } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import type { ExperienceController } from '../experience/ExperienceController';
import { allVisited, type ExperienceState } from '../experience/sceneState';

interface Props {
  state: ExperienceState;
  controller: ExperienceController;
}

/** The diorama with five zones: dormant until visited, glowing once their scene has played. */
export function MapScene({ state, controller }: Props) {
  const stage = useStage();
  const { visited, justActivated, nonce } = state;

  useEffect(() => {
    stage?.showMap(visited, justActivated);
    // `nonce` makes returning to the map replay the activation pulse.
  }, [stage, visited, justActivated, nonce]);

  const done = allVisited(state);
  const line = done
    ? PITCH.map.allAwake
    : justActivated
      ? PITCH.map.awakened(getGuardian(justActivated))
      : PITCH.map.intro;

  return (
    <>
      <header className="hud-top">
        <p className="chip" aria-live="polite">
          {PITCH.map.progress(visited.length, GUARDIANS.length)}
        </p>
      </header>

      <ZoneMarkers visited={visited} justActivated={justActivated} onSelect={controller.selectZone} />

      <BottomStack>
        {done ? (
          <button type="button" className="btn btn--primary" onClick={() => controller.goTo('finale')}>
            <span className="btn__title">{PITCH.map.awakenTree}</span>
          </button>
        ) : null}
        <Subtitles speaker="Tērvete" text={line} tone="info" />
      </BottomStack>
    </>
  );
}
