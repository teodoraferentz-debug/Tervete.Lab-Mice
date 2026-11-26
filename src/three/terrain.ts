import { MAP_D, MAP_W } from './textures';
import { smoothstep } from './util';

/** World-space height of the relief, per unit of the encoded 0–0.5 range (visual exaggeration). */
export const RELIEF_SCALE = 1.5;
const BORDER = 0.03; // the relief eases to flat over the outer 3% so it meets the frame cleanly

/**
 * Height field + forest mask read from an RGB relief image aligned with the map illustration:
 *   R = height (0 → -0.10, 255 → +0.40, before RELIEF_SCALE)
 *   G = where trees may grow (outer forest, not roads, banners or legends)
 *   B = water
 * The image is derived from the map's own colours (see docs/technical-notes.md), so the 3D relief
 * always matches the illustration. A new final map needs a new relief image (same pipeline).
 */
export class Terrain {
  constructor(
    readonly width: number,
    readonly height: number,
    private readonly data: Uint8ClampedArray,
  ) {}

  private channel(u: number, v: number, c: 0 | 1 | 2): number {
    const x = Math.min(this.width - 1.001, Math.max(0, u * (this.width - 1)));
    const y = Math.min(this.height - 1.001, Math.max(0, v * (this.height - 1)));
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const at = (xx: number, yy: number) => this.data[(yy * this.width + xx) * 4 + c]! / 255;
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  }

  /** Terrain height (world units) under world position (x, z). */
  heightAt(x: number, z: number): number {
    const u = x / MAP_W + 0.5;
    const v = z / MAP_D + 0.5;
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const fade = smoothstep(edge / BORDER);
    return (this.channel(u, v, 0) * 0.5 - 0.1) * RELIEF_SCALE * fade;
  }

  /** 0–1: how suitable this spot is for trees. */
  treeAt(x: number, z: number): number {
    return this.channel(x / MAP_W + 0.5, z / MAP_D + 0.5, 1);
  }

  isWater(x: number, z: number): boolean {
    return this.channel(x / MAP_W + 0.5, z / MAP_D + 0.5, 2) > 0.5;
  }
}

/** Loads a relief image in the browser. */
export async function loadTerrain(url: string): Promise<Terrain> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas not available');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return new Terrain(canvas.width, canvas.height, data);
}
