import type { GuardianId } from '../content/guardians';
import type { ExperienceState } from '../experience/sceneState';
import type { JumpTarget } from '../experience/sceneTypes';

/** What the headset UI may do to the experience: the same actions the presenter panel has. */
export interface VrActions {
  getState(): ExperienceState;
  subscribe(listener: () => void): () => void;
  next(): void;
  prev(): void;
  selectZone(id: GuardianId): void;
  goTo(scene: JumpTarget): void;
  toggleMute(): void;
  restart(): void;
}
