import { useEffect, useMemo } from 'react';
import { useClockVersion } from '../app/hooks';
import { BottomStack } from '../components/BottomStack';
import { PropPrompt } from '../components/PropPrompt';
import { Subtitles } from '../components/Subtitles';
import { useStage } from '../components/StageContext';
import { SenseIcon } from '../components/icons';
import type { Guardian } from '../content/guardians';
import type { ExperienceController } from '../experience/ExperienceController';
import type { ExperienceState } from '../experience/sceneState';
import { SceneClock } from '../experience/SceneClock';
import { activeCaption, activePrompt, cueTimes } from '../experience/timeline';

interface Props {
  guardian: Guardian;
  state: ExperienceState;
  controller: ExperienceController;
}

/** Pause after the last frame so the final line can be read before returning to the map. */
const RETURN_DELAY_MS = 1200;

/**
 * One attraction preview (20–40 s): guardian title, mascot, the physical activity,
 * a memorable visual moment, the presenter's prop prompt, then back to the map.
 * Everything shown comes from the guardian's data.
 */
export function AttractionScene({ guardian, state, controller }: Props) {
  const stage = useStage();
  // A new clock per entry (`nonce`), so replaying a scene starts from zero.
  const clock = useMemo(
    () => new SceneClock(guardian.durationSec, guardian.pitchBeats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guardian, state.nonce],
  );
  useClockVersion(clock);

  useEffect(() => {
    stage?.playAttraction(guardian, clock);
  }, [stage, guardian, clock]);

  // When the timeline ends, hold a moment, then return to the map and light the zone.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = clock.subscribe(() => {
      if (clock.ended && timer === undefined) timer = setTimeout(controller.completeScene, RETURN_DELAY_MS);
    });
    return () => {
      off();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [clock, controller]);

  const t = clock.time;
  const caption = activeCaption(guardian.pitchBeats, t)?.beat;
  const prompt = activePrompt(guardian.pitchBeats, t);
  const cues = cueTimes(guardian.pitchBeats);
  const showSafety = guardian.safetyNote !== null && cues.activity !== undefined && t >= cues.activity;
  const accent = guardian.themeColor;

  return (
    <>
      <header className="hud-top hud-top--scene" style={{ '--accent': accent } as React.CSSProperties}>
        <div className="scene-title">
          <span className="scene-title__icon">
            <SenseIcon sense={guardian.sense} />
          </span>
          <div>
            <p className="scene-title__sense">
              {guardian.senseLabel} · {guardian.zone.name}
            </p>
            <h2 className="scene-title__name">{guardian.name}</h2>
            <p className="scene-title__goal">
              <span className="visually-hidden">Learning: </span>
              {guardian.learningGoal}
            </p>
          </div>
        </div>
        <div className="progress" aria-hidden="true">
          <span key={state.nonce} style={{ animationDuration: `${guardian.durationSec}s` }} />
        </div>
      </header>

      <BottomStack>
        {showSafety ? <p className="safety-note">{guardian.safetyNote}</p> : null}
        {prompt ? <PropPrompt label="Presenter" text={prompt.text} detail={guardian.propCue} accent={accent} /> : null}
        {caption ? (
          <Subtitles
            speaker={caption.speaker === 'mascot' ? guardian.name : 'In the park'}
            text={caption.text}
            tone={caption.speaker === 'mascot' ? 'mascot' : 'narrator'}
            accent={accent}
          />
        ) : null}
      </BottomStack>
    </>
  );
}
