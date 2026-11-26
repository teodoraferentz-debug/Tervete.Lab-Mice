import { useEffect, useMemo } from 'react';
import { useClockVersion } from '../app/hooks';
import { BottomStack } from '../components/BottomStack';
import { PropPrompt } from '../components/PropPrompt';
import { Subtitles } from '../components/Subtitles';
import { useStage } from '../components/StageContext';
import { BRAND } from '../content/brand';
import { GUARDIANS } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import type { ExperienceState } from '../experience/sceneState';
import { SceneClock } from '../experience/SceneClock';
import { activeCaption, activePrompt } from '../experience/timeline';

interface Props {
  state: ExperienceState;
}

/** The Tree of Five Senses: all five guardians together. It stays on screen when the timeline ends. */
export function FinaleScene({ state }: Props) {
  const stage = useStage();
  const clock = useMemo(
    () => new SceneClock(PITCH.finale.durationSec, PITCH.finale.beats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.nonce],
  );
  useClockVersion(clock);

  useEffect(() => {
    stage?.playFinale(clock);
  }, [stage, clock]);

  const t = clock.time;
  const caption = activeCaption(PITCH.finale.beats, t)?.beat;
  const prompt = activePrompt(PITCH.finale.beats, t);

  return (
    <>
      <header className="hud-top hud-top--scene">
        <div className="scene-title">
          <div>
            <p className="scene-title__sense">{BRAND.name} · five guardians</p>
            <h2 className="scene-title__name">{PITCH.finale.title}</h2>
            <ul className="legend" aria-label="The five guardians">
              {GUARDIANS.map((g) => (
                <li key={g.id} style={{ '--accent': g.themeColor } as React.CSSProperties}>
                  <i aria-hidden="true" />
                  {g.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <BottomStack>
        {prompt ? <PropPrompt label="Presenter" text={prompt.text} /> : null}
        {caption ? (
          <Subtitles
            speaker={caption.speaker === 'mascot' ? 'The guardians' : 'Tērvete'}
            text={caption.text}
            tone={caption.speaker === 'mascot' ? 'mascot' : 'narrator'}
          />
        ) : null}
      </BottomStack>
    </>
  );
}
