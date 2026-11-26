import type { GuardianId } from '../content/guardians';
import { reduce, initialState, type Action, type ExperienceState } from './sceneState';
import type { ArStatus, JumpTarget } from './sceneTypes';

type Listener = () => void;

/**
 * Thin store around the pure reducer. React reads it with useSyncExternalStore;
 * tests and the presenter can drive it directly. It owns no timers.
 */
export class ExperienceController {
  private state: ExperienceState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: ExperienceState = initialState) {
    this.state = initial;
  }

  /** Stable reference between changes (required by useSyncExternalStore). */
  getState = (): ExperienceState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispatch = (action: Action): void => {
    const next = reduce(this.state, action);
    if (next === this.state) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  };

  startAr = () => this.dispatch({ type: 'startAr' });
  startVr = () => this.dispatch({ type: 'startVr' });
  vrEnded = () => this.dispatch({ type: 'vrEnded' });
  enterMagic = () => this.dispatch({ type: 'enterMagic' });
  setArStatus = (status: ArStatus) => this.dispatch({ type: 'arStatus', status });
  goTo = (scene: JumpTarget) => this.dispatch({ type: 'goTo', scene });
  selectZone = (id: GuardianId) => this.dispatch({ type: 'selectZone', id });
  completeScene = () => this.dispatch({ type: 'completeScene' });
  next = () => this.dispatch({ type: 'next' });
  prev = () => this.dispatch({ type: 'prev' });
  restart = () => this.dispatch({ type: 'restart' });
  toggleMute = () => this.dispatch({ type: 'toggleMute' });
  dismissNotice = () => this.dispatch({ type: 'dismissNotice' });
}
