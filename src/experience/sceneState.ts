import { GUARDIAN_IDS, isGuardianId, type GuardianId } from '../content/guardians';
import type { ArStatus, ExperienceMode, JumpTarget, Notice, SceneId } from './sceneTypes';

/**
 * The whole experience is one plain object that only changes through `reduce`.
 * No timers, no randomness, no browser APIs: the same actions always give the same state,
 * which is what makes rehearsals repeatable.
 */
export interface ExperienceState {
  scene: SceneId;
  mode: ExperienceMode;
  ar: ArStatus;
  /** Guardians whose zone is lit, in the order they were completed. */
  visited: readonly GuardianId[];
  muted: boolean;
  notice: Notice | null;
  /** Bumps whenever a scene is (re)entered, so replaying the same scene restarts it. */
  nonce: number;
  /** Set for the map shown right after a guardian is completed; drives the "lighting up" pulse. */
  justActivated: GuardianId | null;
}

export const initialState: ExperienceState = {
  scene: 'welcome',
  mode: 'magic',
  ar: 'idle',
  visited: [],
  muted: false,
  notice: null,
  nonce: 0,
  justActivated: null,
};

export type Action =
  | { type: 'startAr' }
  | { type: 'enterMagic'; notice?: Notice | null }
  | { type: 'arStatus'; status: ArStatus }
  | { type: 'goTo'; scene: JumpTarget }
  | { type: 'selectZone'; id: GuardianId }
  | { type: 'completeScene' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'restart' }
  | { type: 'toggleMute' }
  | { type: 'dismissNotice' };

export const allVisited = (s: ExperienceState): boolean => s.visited.length === GUARDIAN_IDS.length;

export const isGuardianScene = (scene: SceneId): scene is GuardianId => isGuardianId(scene);

const enter = (s: ExperienceState, patch: Partial<ExperienceState>): ExperienceState => ({
  ...s,
  ...patch,
  nonce: s.nonce + 1,
});

const failureNotice = (status: ArStatus): Notice | null => {
  if (status === 'denied') return { code: 'ar-denied' };
  if (status === 'unsupported') return { code: 'ar-unsupported' };
  if (status === 'error') return { code: 'ar-error' };
  return null;
};

function enterMagic(s: ExperienceState, notice: Notice | null): ExperienceState {
  const leavingIntro = s.scene === 'welcome' || s.scene === 'scan';
  const base: ExperienceState = { ...s, mode: 'magic', ar: 'idle', notice };
  return leavingIntro ? enter(base, { scene: 'map', justActivated: null }) : base;
}

function jump(s: ExperienceState, scene: JumpTarget): ExperienceState {
  // Skipping the scan in AR mode means working without tracking: that is Magic Mode.
  const bypassesScan = s.mode === 'ar' && s.ar !== 'tracking' && scene !== 'welcome';
  const base: ExperienceState = bypassesScan ? { ...s, mode: 'magic', ar: 'idle', notice: null } : s;
  return enter(base, { scene, justActivated: null });
}

function complete(s: ExperienceState): ExperienceState {
  if (!isGuardianScene(s.scene)) return s;
  const id = s.scene;
  const isNew = !s.visited.includes(id);
  return enter(s, {
    scene: 'map',
    visited: isNew ? [...s.visited, id] : s.visited,
    justActivated: isNew ? id : null,
  });
}

function next(s: ExperienceState): ExperienceState {
  switch (s.scene) {
    case 'welcome':
    case 'scan':
      return enterMagic(s, null);
    case 'map': {
      const upcoming = GUARDIAN_IDS.find((id) => !s.visited.includes(id));
      return enter(s, { scene: upcoming ?? 'finale', justActivated: null });
    }
    case 'finale':
      return s;
    default:
      return complete(s);
  }
}

function prev(s: ExperienceState): ExperienceState {
  switch (s.scene) {
    case 'welcome':
      return s;
    case 'scan':
      return enter({ ...s, mode: 'magic', ar: 'idle' }, { scene: 'welcome' });
    case 'map': {
      const last = s.visited[s.visited.length - 1];
      if (!last) return enter(s, { scene: 'welcome', justActivated: null });
      // Reverse of `next`: re-open the last completed scene, un-visited.
      return enter(s, { scene: last, visited: s.visited.slice(0, -1), justActivated: null });
    }
    default:
      return enter(s, { scene: 'map', justActivated: null });
  }
}

export function reduce(s: ExperienceState, a: Action): ExperienceState {
  switch (a.type) {
    case 'startAr':
      return enter(s, { mode: 'ar', ar: 'starting', scene: 'scan', notice: null, justActivated: null });
    case 'enterMagic':
      return enterMagic(s, a.notice ?? null);
    case 'arStatus': {
      if (s.mode !== 'ar') return s;
      if (a.status === 'denied' || a.status === 'unsupported' || a.status === 'error') {
        return enterMagic(s, failureNotice(a.status));
      }
      if (a.status === 'tracking' && s.scene === 'scan') {
        return enter({ ...s, ar: 'tracking' }, { scene: 'map', justActivated: null });
      }
      return s.ar === a.status ? s : { ...s, ar: a.status };
    }
    case 'goTo':
      return jump(s, a.scene);
    case 'selectZone':
      return s.scene === 'map' ? enter(s, { scene: a.id, justActivated: null }) : s;
    case 'completeScene':
      return complete(s);
    case 'next':
      return next(s);
    case 'prev':
      return prev(s);
    case 'restart':
      // Everything resets except the audio preference.
      return { ...initialState, muted: s.muted };
    case 'toggleMute':
      return { ...s, muted: !s.muted };
    case 'dismissNotice':
      return s.notice ? { ...s, notice: null } : s;
  }
}
