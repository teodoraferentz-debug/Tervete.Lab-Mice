import { useEffect, type RefObject } from 'react';
import type { ArAdapter } from '../ar/ArAdapter';
import type { ExperienceController } from '../experience/ExperienceController';
import type { ExperienceMode } from '../experience/sceneTypes';
import type { StageApi } from '../three/StageApi';

interface Options {
  mode: ExperienceMode;
  controller: ExperienceController;
  stage: StageApi | null;
  layerRef: RefObject<HTMLDivElement | null>;
  createAdapter: () => ArAdapter;
}

/**
 * Runs the AR backend for as long as the experience is in AR mode.
 * Leaving AR mode (Magic Mode, restart, a failure) stops the camera and gives
 * rendering back to the app. Nothing here can block the experience: every failure
 * arrives as an AR status and the reducer falls back to Magic Mode.
 */
export function useArSession({ mode, controller, stage, layerRef, createAdapter }: Options): void {
  useEffect(() => {
    const layer = layerRef.current;
    if (mode !== 'ar' || !stage || !layer) return;

    const adapter = createAdapter();
    let cancelled = false;
    let hosted = false;
    const off = adapter.subscribe((status) => controller.setArStatus(status));

    adapter
      .start(layer)
      .then((host) => {
        if (cancelled || !host) return;
        stage.useHost(host);
        hosted = true;
      })
      .catch((error: unknown) => {
        console.warn('[AR] start failed:', error);
        if (!cancelled) controller.setArStatus('error');
      });

    return () => {
      cancelled = true;
      off();
      if (hosted) stage.useHost(null);
      void adapter.stop();
    };
  }, [mode, stage, layerRef, controller, createAdapter]);
}
