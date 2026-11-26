import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StageContext } from './StageContext';
import type { StageApi } from '../three/StageApi';
import type { StageOptions } from '../three/Stage';

export type StageFactory = (container: HTMLElement, options: StageOptions) => StageApi;

interface Props {
  factory: StageFactory;
  reducedMotion: boolean;
  onActivate: StageOptions['onActivate'];
  onMoment: StageOptions['onMoment'];
  onVrEnd: StageOptions['onVrEnd'];
  /** Receives the mount point for AR backends that bring their own canvas and video. */
  arLayerRef: React.RefObject<HTMLDivElement | null>;
  onStage?: (stage: StageApi | null) => void;
  /** True while the AR camera feed should show through (hides the painted sky). */
  cameraVisible?: boolean;
  children: ReactNode;
}

/** Mounts the Three.js stage once and shares it with the scenes through context. */
export function StageCanvas({ factory, reducedMotion, onActivate, onMoment, onVrEnd, arLayerRef, onStage, cameraVisible = false, children }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<StageApi | null>(null);
  const initialMotion = useRef(reducedMotion);
  const callbacks = useRef({ onActivate, onMoment, onStage, onVrEnd });
  useEffect(() => {
    callbacks.current = { onActivate, onMoment, onStage, onVrEnd };
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const created = factory(el, {
      reducedMotion: initialMotion.current,
      onActivate: (id) => callbacks.current.onActivate?.(id),
      onMoment: (id) => callbacks.current.onMoment?.(id),
      onVrEnd: () => callbacks.current.onVrEnd?.(),
    });
    setStage(created);
    callbacks.current.onStage?.(created);
    return () => {
      callbacks.current.onStage?.(null);
      created.dispose();
      setStage(null);
    };
  }, [factory]);

  useEffect(() => {
    stage?.setReducedMotion(reducedMotion);
  }, [stage, reducedMotion]);

  return (
    <StageContext.Provider value={stage}>
      <div className="stage" ref={mountRef} data-webgl={stage ? String(stage.webgl) : 'pending'} data-camera={String(cameraVisible)}>
        <div className="stage-sky" aria-hidden="true" />
        <div className="ar-layer" ref={arLayerRef} aria-hidden="true" />
      </div>
      {children}
    </StageContext.Provider>
  );
}
