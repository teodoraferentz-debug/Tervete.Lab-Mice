import { useEffect } from 'react';
import { BRAND } from '../content/brand';
import { PITCH } from '../content/pitchScript';
import { useStage } from './StageContext';

interface Props {
  /** A headset session can start here: then VR replaces the camera-based AR button. */
  vrAvailable: boolean;
  onEnterVr: () => void;
  onStartAr: () => void;
  onMagic: () => void;
}

export function WelcomeScreen({ vrAvailable, onEnterVr, onStartAr, onMagic }: Props) {
  const stage = useStage();
  // The sleeping diorama sits behind the welcome card.
  useEffect(() => {
    stage?.showMap([], null);
  }, [stage]);

  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome__card">
        <p className="eyebrow">{PITCH.welcome.eyebrow}</p>
        <h1 className="welcome__title" id="welcome-title">
          {BRAND.title}
          <span className="welcome__subtitle">{BRAND.subtitle}</span>
        </h1>
        <p className="welcome__tagline" lang="lv">
          {BRAND.tagline}
        </p>
        <p className="welcome__lead">{PITCH.welcome.lead}</p>

        <div className="welcome__actions">
          {vrAvailable ? (
            <button type="button" className="btn btn--primary" onClick={onEnterVr}>
              <span className="btn__title">{PITCH.welcome.enterVr}</span>
              <span className="btn__hint">{PITCH.welcome.enterVrHint}</span>
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={onStartAr}>
              <span className="btn__title">{PITCH.welcome.startAr}</span>
              <span className="btn__hint">{PITCH.welcome.startArHint}</span>
            </button>
          )}
          <button type="button" className="btn btn--secondary" onClick={onMagic}>
            <span className="btn__title">{PITCH.welcome.magic}</span>
            <span className="btn__hint">{PITCH.welcome.magicHint}</span>
          </button>
        </div>

        <p className="welcome__footnote">{PITCH.welcome.footnote}</p>
      </div>
    </section>
  );
}
