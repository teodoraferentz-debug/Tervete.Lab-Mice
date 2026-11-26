import type { ArRenderHost } from '../ar/ArAdapter';
import type { Guardian, GuardianId } from '../content/guardians';
import type { SceneClock } from '../experience/SceneClock';

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
  setReducedMotion(reduced: boolean): void;
  dispose(): void;
}
