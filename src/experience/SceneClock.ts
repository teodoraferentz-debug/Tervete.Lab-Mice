import type { PitchBeat } from '../content/guardians';
import { activeBeat } from './timeline';

type Listener = () => void;

/**
 * Deterministic scene clock. It only moves when `tick(dt)` is called (by the render loop
 * in the app, or by a test), never by itself. Listeners are told when the active beat
 * changes or when the scene ends, not on every frame.
 */
export class SceneClock {
  time = 0;
  ended = false;
  /** Increments on beat change / end / reset. Handy as a useSyncExternalStore snapshot. */
  version = 0;
  private beatIndex = -1;
  private readonly listeners = new Set<Listener>();

  constructor(
    readonly duration: number,
    private readonly beats: readonly PitchBeat[],
  ) {
    this.syncBeat();
  }

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  getVersion = (): number => this.version;

  tick(dt: number): void {
    if (this.ended || dt <= 0) return;
    this.seek(this.time + dt);
  }

  seek(t: number): void {
    const clamped = Math.max(0, Math.min(this.duration, t));
    this.time = clamped;
    let changed = this.syncBeat();
    if (clamped >= this.duration && !this.ended) {
      this.ended = true;
      changed = true;
    } else if (clamped < this.duration && this.ended) {
      this.ended = false;
      changed = true;
    }
    if (changed) this.emit();
  }

  reset(): void {
    this.time = 0;
    this.ended = false;
    this.beatIndex = -1;
    this.syncBeat();
    this.emit();
  }

  private syncBeat(): boolean {
    const idx = activeBeat(this.beats, this.time)?.index ?? -1;
    if (idx === this.beatIndex) return false;
    this.beatIndex = idx;
    return true;
  }

  private emit(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }
}
