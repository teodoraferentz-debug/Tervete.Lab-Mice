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

/** Asset URLs follow Vite's `base`, so the app also works when it is not served from the site root. */
const url = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;

export const ASSETS: Record<string, AssetEntry> = {
  // Ground texture of the diorama. Interim: the park's official map poster (LVM, 2577 × 1851 px) until the
  // final illustrated map arrives. Replace the file and re-run the relief step (docs/technical-notes.md).
  'map-illustration': { kind: 'illustration', status: 'ready', url: url('illustrations/tervete-map.webp') },
  // 3D relief derived from the map's colours (R = height, G = tree mask, B = water). Same ratio as the map.
  'map-relief': { kind: 'illustration', status: 'ready', url: url('illustrations/tervete-map-relief.png') },

  // Until each guardian has an illustration, the main Tērvete mascot (the forest-boy detective) stands in.
  'mascot-default': { kind: 'sprite', status: 'ready', url: url('illustrations/mascots/skats.webp'), height: 2.0 },
  // Mascots as billboard sprites (transparent WebP/PNG). A glTF model path can be added later.
  // Skats uses the detective illustration of the Tērvete forest boy from the Figma board (cut out of its white page).
  'mascot-skats': { kind: 'sprite', status: 'ready', url: url('illustrations/mascots/skats.webp'), height: 2.0 },
  'mascot-austina': { kind: 'sprite', status: 'placeholder', url: url('illustrations/mascots/austina.webp'), height: 1.5 },
  'mascot-odzina': { kind: 'sprite', status: 'placeholder', url: url('illustrations/mascots/odzina.webp'), height: 1.5 },
  'mascot-deguntins': { kind: 'sprite', status: 'placeholder', url: url('illustrations/mascots/deguntins.webp'), height: 1.5 },
  'mascot-plaukstina': { kind: 'sprite', status: 'placeholder', url: url('illustrations/mascots/plaukstina.webp'), height: 1.5 },
};

export function getAsset(key: string): AssetEntry | undefined {
  return ASSETS[key];
}

export function isReady(key: string): boolean {
  return ASSETS[key]?.status === 'ready';
}
