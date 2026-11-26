import type { ArRenderHost } from '../ar/ArAdapter';
import type { Guardian, GuardianId } from '../content/guardians';
import type { SceneClock } from '../experience/SceneClock';
import type { StageFactory } from '../components/StageCanvas';
import type { ScreenPoint, StageApi } from '../three/StageApi';

/** Stand-in for the WebGL stage: records what scenes ask for, and lets tests drive the scene clock. */
export class FakeStage implements StageApi {
  webgl = true;
  clock: SceneClock | null = null;
  calls: string[] = [];
  reducedMotion: boolean | null = null;
  lastMap: { visited: readonly GuardianId[]; justActivated: GuardianId | null } | null = null;
  hosts: Array<ArRenderHost | null> = [];
  disposed = false;

  showMap(visited: readonly GuardianId[], justActivated: GuardianId | null): void {
    this.calls.push('map');
    this.lastMap = { visited, justActivated };
    this.clock = null;
  }
  playAttraction(guardian: Guardian, clock: SceneClock): void {
    this.calls.push(`attraction:${guardian.id}`);
    this.clock = clock;
  }
  playFinale(clock: SceneClock): void {
    this.calls.push('finale');
    this.clock = clock;
  }
  project(_id: GuardianId, out: ScreenPoint): ScreenPoint {
    out.x = 100;
    out.y = 100;
    out.visible = true;
    return out;
  }
  onFrame(): () => void {
    return () => {};
  }
  useHost(host: ArRenderHost | null): void {
    this.hosts.push(host);
  }
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }
  dispose(): void {
    this.disposed = true;
  }
}

export function fakeStageFactory(): { factory: StageFactory; stages: FakeStage[] } {
  const stages: FakeStage[] = [];
  return {
    stages,
    factory: () => {
      const s = new FakeStage();
      stages.push(s);
      return s;
    },
  };
}
