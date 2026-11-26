import { Color } from 'three';

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeInOut = smoothstep;
export const easeOutBack = (x: number): number => {
  const t = clamp01(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - clamp01(x), 3);

/** Seeded PRNG so the forest looks identical on every run (deterministic demo). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tmp = new Color();
export function mixHex(a: string, b: string, t: number): Color {
  return new Color(a).lerp(tmp.set(b), t);
}

/** Time elapsed since a cue fired, or -1 when it has not fired (or does not exist). */
export const since = (t: number, cue: number | undefined): number =>
  cue === undefined || t < cue ? -1 : t - cue;
