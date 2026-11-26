import type { ArRenderHost } from '../ar/ArAdapter';
import type { Guardian, GuardianId } from '../content/guardians';
import type { SceneClock } from '../experience/SceneClock';
import type { VrActions } from '../vr/types';

export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

/** The part of the stage that React scenes use. Lets tests swap in a fake without WebGL. */
export interface StageApi {
  readonly webgl: boolean;
  showMap(visited: readonly GuardianId[], justActivated: GuardianId | null): void;
  playAttraction(guardian: Guardian, clock: SceneClock): void;
  playFinale(clock: SceneClock): void;
  project(id: GuardianId, out: ScreenPoint): ScreenPoint;
  onFrame(listener: () => void): () => void;
  useHost(host: ArRenderHost | null): void;
  /** Starts a headset session (call from a user gesture). Rejects if VR cannot start. */
  enterVr(actions: VrActions): Promise<void>;
  exitVr(): void;
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}
