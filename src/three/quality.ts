/**
 * Quality tiers. The scene allocates for 'high' once and the tiers only change how much
 * of it is drawn, so stepping down never rebuilds anything.
 */
export type QualityName = 'high' | 'medium' | 'low';

export interface QualityTier {
  name: QualityName;
  maxDpr: number;
  trees: number;
  particles: number;
  shadows: boolean;
  zoneEmitters: boolean;
}

export const TIERS: Record<QualityName, QualityTier> = {
  high: { name: 'high', maxDpr: 2, trees: 260, particles: 170, shadows: true, zoneEmitters: true },
  medium: { name: 'medium', maxDpr: 1.5, trees: 170, particles: 100, shadows: false, zoneEmitters: true },
  low: { name: 'low', maxDpr: 1, trees: 100, particles: 45, shadows: false, zoneEmitters: false },
};

const ORDER: QualityName[] = ['high', 'medium', 'low'];

export function stepDown(name: QualityName): QualityName {
  const i = ORDER.indexOf(name);
  return ORDER[Math.min(ORDER.length - 1, i + 1)] ?? 'low';
}

/** First guess before any frame has been timed. */
export function initialQuality(): QualityName {
  if (typeof navigator === 'undefined') return 'medium';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (memory <= 2 || cores <= 2) return 'low';
  if (coarse || cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

/**
 * Watches frame times and asks for a cheaper tier when the device cannot keep up.
 * It only ever steps down (stepping back up would make the picture flicker mid-demo).
 */
export class QualityGovernor {
  private samples = 0;
  private total = 0;

  constructor(
    private readonly budgetMs = 27,
    private readonly window = 90,
    private readonly warmup = 45,
  ) {}

  private frames = 0;

  /** Returns true when a step down is recommended. */
  record(dtSeconds: number): boolean {
    this.frames += 1;
    if (this.frames <= this.warmup) return false;
    // Ignore the long frames produced by tab switches and scene changes.
    if (dtSeconds > 0.25) return false;
    this.samples += 1;
    this.total += dtSeconds * 1000;
    if (this.samples < this.window) return false;
    const avg = this.total / this.samples;
    this.samples = 0;
    this.total = 0;
    return avg > this.budgetMs;
  }

  reset(): void {
    this.frames = 0;
    this.samples = 0;
    this.total = 0;
  }
}
