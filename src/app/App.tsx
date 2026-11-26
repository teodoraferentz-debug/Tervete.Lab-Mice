import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createArAdapter } from '../ar/createArAdapter';
import type { ArAdapter } from '../ar/ArAdapter';
import { AudioEngine } from '../audio/AudioEngine';
import { Notice } from '../components/Notice';
import { ScanOverlay } from '../components/ScanOverlay';
import { StageCanvas, type StageFactory } from '../components/StageCanvas';
import { WelcomeScreen } from '../components/WelcomeScreen';
import { GUARDIAN_IDS, getGuardian } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import { ExperienceController } from '../experience/ExperienceController';
import { isGuardianScene } from '../experience/sceneState';
import type { NoticeCode } from '../experience/sceneTypes';
import { PresenterControls } from '../presentation/PresenterControls';
import { AttractionScene } from '../scenes/AttractionScene';
import { FinaleScene } from '../scenes/FinaleScene';
import { MapScene } from '../scenes/MapScene';
import { Stage } from '../three/Stage';
import type { StageApi } from '../three/StageApi';
import { useExperience, useReducedMotion } from './hooks';
import { useArSession } from './useArSession';

const defaultStageFactory: StageFactory = (container, options) => new Stage(container, options);

const NOTICE_TEXT: Record<NoticeCode, string> = {
  'ar-denied': PITCH.notices.arDenied,
  'ar-unsupported': PITCH.notices.arUnsupported,
  'ar-error': PITCH.notices.arError,
};

export interface AppProps {
  /** Tests inject a fake stage (jsdom has no WebGL). */
  stageFactory?: StageFactory;
  arFactory?: () => ArAdapter;
}

export function App({ stageFactory = defaultStageFactory, arFactory = createArAdapter }: AppProps) {
  const [controller] = useState(() => new ExperienceController());
  const state = useExperience(controller);
  const reducedMotion = useReducedMotion();
  const audio = useMemo(() => new AudioEngine(), []);
  const [stage, setStage] = useState<StageApi | null>(null);
  const arLayerRef = useRef<HTMLDivElement>(null);

  useArSession({ mode: state.mode, controller, stage, layerRef: arLayerRef, createAdapter: arFactory });

  // Sound: unlock on the first gesture, follow the mute switch.
  useEffect(() => {
    const unlock = () => {
      audio.start();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.dispose();
    };
  }, [audio]);
  useEffect(() => audio.setMuted(state.muted), [audio, state.muted]);

  const onActivate = useCallback((id: (typeof GUARDIAN_IDS)[number]) => audio.chime(GUARDIAN_IDS.indexOf(id)), [audio]);
  const onMoment = useCallback((id: (typeof GUARDIAN_IDS)[number] | 'finale') => audio.chime(id === 'finale' ? 5 : GUARDIAN_IDS.indexOf(id)), [audio]);

  const cameraVisible = state.mode === 'ar' && (state.ar === 'scanning' || state.ar === 'tracking' || state.ar === 'lost');
  const scene = state.scene;

  return (
    <StageCanvas
      factory={stageFactory}
      reducedMotion={reducedMotion}
      onActivate={onActivate}
      onMoment={onMoment}
      arLayerRef={arLayerRef}
      onStage={setStage}
      cameraVisible={cameraVisible}
    >
      <main className="hud" aria-label="Tērvete Awakens — Five Senses Trail">
        {scene === 'welcome' ? <WelcomeScreen onStartAr={controller.startAr} onMagic={controller.enterMagic} /> : null}
        {scene === 'scan' ? <ScanOverlay status={state.ar} onContinueMagic={controller.enterMagic} /> : null}
        {scene === 'map' ? <MapScene state={state} controller={controller} /> : null}
        {isGuardianScene(scene) ? (
          <AttractionScene key={`${scene}:${state.nonce}`} guardian={getGuardian(scene)} state={state} controller={controller} />
        ) : null}
        {scene === 'finale' ? <FinaleScene key={state.nonce} state={state} /> : null}

        <div className="notices">
          {state.notice ? <Notice message={NOTICE_TEXT[state.notice.code]} onDismiss={controller.dismissNotice} /> : null}
          {state.mode === 'ar' && state.ar === 'lost' && scene !== 'scan' ? <Notice message={PITCH.notices.arLost} /> : null}
          {stage && !stage.webgl ? <Notice message={PITCH.notices.noWebgl} /> : null}
        </div>

        <PresenterControls state={state} controller={controller} />
      </main>
    </StageCanvas>
  );
}
