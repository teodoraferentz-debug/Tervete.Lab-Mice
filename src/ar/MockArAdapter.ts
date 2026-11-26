import { ArAdapterBase, type ArRenderHost } from './ArAdapter';
import type { ArStatus } from '../experience/sceneTypes';

export interface MockArOptions {
  /** Delay before the simulated map is "found". */
  scanDelayMs?: number;
  /** Make the simulated start fail with this status instead of finding the map. */
  failWith?: Extract<ArStatus, 'denied' | 'unsupported' | 'error'>;
}

/**
 * Simulated tracking: no camera, no marker. Used for rehearsals (`?ar=mock`) and tests.
 * It exercises the whole AR flow (scan screen → map found → map lost) without hardware.
 */
export class MockArAdapter extends ArAdapterBase {
  readonly kind = 'mock' as const;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(private readonly options: MockArOptions = {}) {
    super();
  }

  async start(): Promise<ArRenderHost | null> {
    this.clear();
    this.emit('starting');
    const delay = this.options.scanDelayMs ?? 1800;
    this.timers.push(setTimeout(() => this.emit('scanning'), Math.min(300, delay / 2)));
    this.timers.push(
      setTimeout(() => this.emit(this.options.failWith ?? 'tracking'), delay),
    );
    return null;
  }

  async stop(): Promise<void> {
    this.clear();
    this.emit('idle');
  }

  /** Rehearsal helpers (also used by tests). */
  simulateLost(): void {
    this.emit('lost');
  }
  simulateFound(): void {
    this.emit('tracking');
  }

  private clear(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
