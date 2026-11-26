/**
 * Asset registry. Every visual the 3D scene could load is listed here under a stable key.
 *
 * - `placeholder`: no file yet. The scene draws a procedural stand-in (nothing is fetched).
 * - `ready`: the file at `url` exists in /public and replaces the placeholder.
 *
 * To drop in final art: copy the file to `public/assets/...`, then flip `status` to 'ready'.
 * No other code changes are needed. See docs/technical-notes.md.
 */
export type AssetKind = 'illustration' | 'sprite';
export type AssetStatus = 'placeholder' | 'ready';

export interface AssetEntry {
  kind: AssetKind;
  status: AssetStatus;
  url: string;
  /** Sprites: height in world units (1 unit ≈ 12 cm on the A3 map). */
  height?: number;
}

export const ASSETS: Record<string, AssetEntry> = {
  // Final illustrated A3 map, used as the diorama's ground texture. Landscape, ratio ≈ 1.414:1.
  'map-illustration': { kind: 'illustration', status: 'placeholder', url: '/assets/illustrations/tervete-map.webp' },

  // Mascots as billboard sprites (transparent WebP/PNG). A glTF model path can be added later.
  'mascot-skats': { kind: 'sprite', status: 'placeholder', url: '/assets/illustrations/mascots/skats.webp', height: 1.5 },
  'mascot-austina': { kind: 'sprite', status: 'placeholder', url: '/assets/illustrations/mascots/austina.webp', height: 1.5 },
  'mascot-odzina': { kind: 'sprite', status: 'placeholder', url: '/assets/illustrations/mascots/odzina.webp', height: 1.5 },
  'mascot-deguntins': { kind: 'sprite', status: 'placeholder', url: '/assets/illustrations/mascots/deguntins.webp', height: 1.5 },
  'mascot-plaukstina': { kind: 'sprite', status: 'placeholder', url: '/assets/illustrations/mascots/plaukstina.webp', height: 1.5 },
};

export function getAsset(key: string): AssetEntry | undefined {
  return ASSETS[key];
}

export function isReady(key: string): boolean {
  return ASSETS[key]?.status === 'ready';
}
