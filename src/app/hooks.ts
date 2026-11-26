import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ExperienceController } from '../experience/ExperienceController';
import type { ExperienceState } from '../experience/sceneState';
import type { SceneClock } from '../experience/SceneClock';

export function useExperience(controller: ExperienceController): ExperienceState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

/** Re-renders when the clock's beat changes or the scene ends (not every frame). */
export function useClockVersion(clock: SceneClock): number {
  return useSyncExternalStore(clock.subscribe, clock.getVersion, clock.getVersion);
}

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia !== 'function') return () => {};
      const mq = matchMedia(QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => (typeof matchMedia === 'function' ? matchMedia(QUERY).matches : false),
    () => false,
  );
}

/** Keeps the latest callback in a ref so effects do not re-run when it changes. */
export function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
