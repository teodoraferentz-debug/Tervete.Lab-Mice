import type { CueKind, GuardianId } from '../../content/guardians';

/**
 * Cinematic compositions, one per guardian. Pure data: layers of illustrated art placed in "screen units"
 * on a 16 × 9 stage (x → right, y → up, 0,0 = centre), with a depth `z` for parallax (negative = behind
 * the focus plane, positive = in front). Sizes are the apparent size on the focus plane, so authors can
 * think in screen terms and the engine applies perspective.
 *
 * The visual arc of every scene: welcome (the set and the mascot arrive) → activity (the real props and
 * the AR highlights) → keepsake (the thing a family takes home, where the brief has one).
 *
 * INTERIM: backdrops are the park's official photos and the props are drawn illustrations. The keys in
 * `art` map to src/three/story/art.ts, or to final images registered in content/assets.ts.
 */

export type LayerAnim = 'none' | 'sway' | 'breathe' | 'float';

export interface LayerSpec {
  id: string;
  art: string;
  x: number;
  y: number;
  z: number;
  /** Apparent height on the focus plane. Ignored for `cover` layers. */
  height: number;
  /** Scales the layer to fill the whole frame (backdrops). */
  cover?: boolean;
  /** Cue the layer arrives on (default 'enter'); `delay` is seconds after it. */
  appear?: CueKind;
  delay?: number;
  anim?: LayerAnim;
  /** Where the layer is anchored: sway swings from the top, breathe grows from the bottom. */
  pivot?: 'top' | 'center' | 'bottom';
  flip?: boolean;
  opacity?: number;
}

/** AR "magic" overlays: bright, additive, and always an extension of something physical. */
export type HotspotSpec =
  | { kind: 'outline'; layer: string; at: number; after?: CueKind }
  | { kind: 'lines'; shape: 'spiral' | 'veins' | 'leaf' | 'arcs'; x: number; y: number; z: number; size: number; at: number; after?: CueKind }
  | { kind: 'swatches'; x: number; y: number; z: number; colors: string[]; at: number; after?: CueKind }
  | { kind: 'ripple'; x: number; y: number; z: number; size: number; at: number; after?: CueKind }
  | { kind: 'halo'; x: number; y: number; z: number; size: number; at: number; after?: CueKind };

/** The thing a family takes home: it travels from the table to centre stage and glows. */
export interface KeepsakeSpec {
  art: string;
  from: { x: number; y: number; z: number; height: number };
  to: { x: number; y: number; z: number; height: number };
}

export interface StoryComposition {
  /** Colour grade laid over the whole frame (theme-flavoured). */
  grade: string;
  gradeOpacity: number;
  layers: LayerSpec[];
  hotspots: HotspotSpec[];
  /** null: the brief lists no take-home item for this zone, so none is invented. */
  keepsake: KeepsakeSpec | null;
}

const frameTrees: LayerSpec[] = [
  { id: 'pines-far-l', art: 'paper-pines-left', x: -6.9, y: 0.6, z: -9, height: 11, opacity: 0.8 },
  { id: 'pines-far-r', art: 'paper-pines-right', x: 6.9, y: 0.6, z: -9, height: 11, opacity: 0.8 },
  { id: 'pines-near-l', art: 'paper-pines-left-near', x: -8.4, y: -0.4, z: -2.2, height: 10.6, anim: 'sway', pivot: 'bottom' },
  { id: 'pines-near-r', art: 'paper-pines-right-near', x: 8.5, y: -0.4, z: -2.2, height: 10.6, anim: 'sway', pivot: 'bottom' },
];

const foreground: LayerSpec[] = [
  { id: 'bokeh-l', art: 'bokeh-leaves', x: -5.6, y: 4.2, z: 4.5, height: 2.8, anim: 'sway', pivot: 'top', opacity: 0.55 },
  { id: 'bokeh-r', art: 'bokeh-leaves', x: 5.6, y: 4.2, z: 4.5, height: 2.8, anim: 'sway', pivot: 'top', flip: true, opacity: 0.55 },
];

const COMPOSITIONS: Record<GuardianId, StoryComposition> = {
  // ── Skats · Hornet Garden · the hero scene ──────────────────────────────────────────────────────
  skats: {
    grade: '#ffc766',
    gradeOpacity: 0.12,
    layers: [
      { id: 'backdrop', art: 'photo-forest-soft', x: 0, y: 0, z: -14, height: 9, cover: true },
      ...frameTrees,
      { id: 'pergola', art: 'pergola', x: -0.6, y: 3.2, z: -5, height: 3.7 },
      { id: 'lantern-1', art: 'lantern-a', x: -3.4, y: 2.8, z: -4.6, height: 2.7, anim: 'sway', pivot: 'top' },
      { id: 'lantern-2', art: 'lantern-b', x: 1.3, y: 2.8, z: -4.6, height: 2.3, anim: 'sway', pivot: 'top' },
      { id: 'lantern-3', art: 'lantern-a', x: 5.0, y: 2.8, z: -4.6, height: 2.0, anim: 'sway', pivot: 'top', flip: true },
      { id: 'bush-l', art: 'garden-bush-left', x: -6.2, y: -3.9, z: -2.6, height: 3.4 },
      { id: 'bush-r', art: 'garden-bush-right', x: 6.4, y: -3.9, z: -2.6, height: 3.4 },
      { id: 'mascot', art: '@mascot', x: 4.7, y: -4.3, z: -0.7, height: 6.4, anim: 'breathe', pivot: 'bottom' },
      { id: 'table', art: 'table', x: -0.5, y: -3.55, z: 0, height: 3.0 },
      { id: 'dough', art: 'dough-board', x: -1.7, y: -3.0, z: 0.15, height: 1.35, appear: 'activity', delay: 0.2 },
      { id: 'leaves', art: 'leaves-cluster', x: 1.3, y: -2.85, z: 0.2, height: 1.55, appear: 'activity', delay: 0.7 },
      { id: 'cone', art: 'pine-cone', x: 3.2, y: -3.05, z: 0.25, height: 1.35, appear: 'activity', delay: 1.2 },
      { id: 'seeds', art: 'seeds', x: -0.2, y: -3.55, z: 0.3, height: 0.95, appear: 'activity', delay: 1.6 },
      { id: 'spools', art: 'spools', x: -4.3, y: -2.55, z: 0.15, height: 0.9, appear: 'activity', delay: 2.0 },
      { id: 'magnifier', art: 'magnifier', x: 2.0, y: -3.35, z: 0.4, height: 1.4, appear: 'activity', delay: 2.4 },
      { id: 'parent', art: 'person-parent', x: -6.4, y: -5.0, z: 2.2, height: 5.6, anim: 'breathe', pivot: 'bottom' },
      { id: 'child', art: 'person-child', x: -4.3, y: -5.0, z: 1.6, height: 3.9, anim: 'breathe', pivot: 'bottom' },
      ...foreground,
    ],
    hotspots: [
      { kind: 'outline', layer: 'leaves', at: 3.0 },
      { kind: 'outline', layer: 'cone', at: 4.2 },
      { kind: 'lines', shape: 'spiral', x: 3.2, y: -3.0, z: 0.5, size: 1.25, at: 4.8 },
      { kind: 'outline', layer: 'seeds', at: 6.0 },
      { kind: 'swatches', x: 1.3, y: -2.5, z: 0.6, colors: ['#c4452f', '#e2aa18', '#d6b232', '#7f9a3a', '#d9732a'], at: 6.8 },
      { kind: 'lines', shape: 'leaf', x: -2.7, y: 1.7, z: -8, size: 2.6, at: 7.8 },
      { kind: 'halo', x: -3.4, y: 0.6, z: -4.4, size: 1.8, at: 9.0 },
    ],
    keepsake: {
      art: 'ornament-leaf',
      from: { x: -1.2, y: -3.3, z: 0.4, height: 1.1 },
      to: { x: 0.9, y: 0.0, z: 1.6, height: 4.2 },
    },
  },

  // ── Austiņa · Fairy Tale Forest ──────────────────────────────────────────────────────────────────
  austina: {
    grade: '#7fd0e0',
    gradeOpacity: 0.12,
    layers: [
      { id: 'backdrop', art: 'photo-forest-birch', x: 0, y: 0, z: -14, height: 9, cover: true },
      ...frameTrees,
      { id: 'bush-l', art: 'garden-bush-left', x: -6.2, y: -3.9, z: -2.6, height: 3.4 },
      { id: 'bush-r', art: 'garden-bush-right', x: 6.4, y: -3.9, z: -2.6, height: 3.4 },
      { id: 'mascot', art: '@mascot', x: 4.7, y: -4.3, z: -0.7, height: 6.4, anim: 'breathe', pivot: 'bottom' },
      { id: 'table', art: 'table', x: -0.5, y: -3.55, z: 0, height: 3.0 },
      { id: 'xylophone', art: 'xylophone', x: -1.4, y: -2.9, z: 0.2, height: 2.7, appear: 'activity', delay: 0.2 },
      { id: 'claves', art: 'claves', x: 2.0, y: -3.2, z: 0.3, height: 1.4, appear: 'activity', delay: 0.8 },
      { id: 'child', art: 'person-child', x: -5.2, y: -5.0, z: 1.6, height: 3.9, anim: 'breathe', pivot: 'bottom', appear: 'activity' },
      ...foreground,
    ],
    hotspots: [
      { kind: 'halo', x: -3.2, y: 2.9, z: -9, size: 1.5, at: 3.0 },
      { kind: 'ripple', x: -3.2, y: 2.9, z: -9, size: 2.4, at: 3.0 },
      { kind: 'halo', x: -0.4, y: 3.4, z: -9, size: 1.5, at: 5.0 },
      { kind: 'ripple', x: -0.4, y: 3.4, z: -9, size: 2.4, at: 5.0 },
      { kind: 'halo', x: 2.4, y: 2.7, z: -9, size: 1.5, at: 7.0 },
      { kind: 'ripple', x: 2.4, y: 2.7, z: -9, size: 2.4, at: 7.0 },
      { kind: 'outline', layer: 'xylophone', at: 4.0 },
      { kind: 'ripple', x: -1.4, y: -1.8, z: 0.8, size: 4.2, at: 1.0, after: 'moment' },
      { kind: 'ripple', x: -1.4, y: -1.8, z: 0.8, size: 5.4, at: 2.0, after: 'moment' },
    ],
    keepsake: null,
  },

  // ── Odziņa · Gnome Forest ────────────────────────────────────────────────────────────────────────
  odzina: {
    grade: '#ffb27a',
    gradeOpacity: 0.1,
    layers: [
      { id: 'backdrop', art: 'photo-rukisu-mezs', x: 0, y: 0.3, z: -14, height: 9, cover: true },
      { id: 'pines-near-l', art: 'paper-pines-left-near', x: -8.6, y: -0.4, z: -2.2, height: 10.6, anim: 'sway', pivot: 'bottom', opacity: 0.85 },
      { id: 'mascot', art: '@mascot', x: 5.0, y: -4.3, z: -0.7, height: 6.2, anim: 'breathe', pivot: 'bottom' },
      { id: 'table', art: 'table', x: -0.5, y: -3.55, z: 0, height: 3.0 },
      { id: 'oranges', art: 'orange-slices', x: -1.9, y: -2.95, z: 0.2, height: 1.5, appear: 'activity', delay: 0.2 },
      { id: 'berries', art: 'berries-nuts', x: 1.8, y: -3.0, z: 0.25, height: 1.55, appear: 'activity', delay: 0.8 },
      { id: 'spools', art: 'spools', x: -4.2, y: -2.6, z: 0.15, height: 0.9, appear: 'activity', delay: 1.3 },
      ...foreground,
    ],
    hotspots: [
      { kind: 'outline', layer: 'oranges', at: 3.0 },
      { kind: 'swatches', x: -1.9, y: -2.4, z: 0.6, colors: ['#f08a24', '#ffd28a', '#e98a2a'], at: 4.2 },
      { kind: 'outline', layer: 'berries', at: 5.6 },
      { kind: 'swatches', x: 1.8, y: -2.4, z: 0.6, colors: ['#b3263e', '#3b4a8c', '#9a6a3c', '#c58d4f'], at: 6.6 },
    ],
    keepsake: {
      art: 'necklace',
      from: { x: 0, y: -2.9, z: 0.4, height: 0.9 },
      to: { x: 0, y: 0.5, z: 1.4, height: 3.2 },
    },
  },

  // ── Deguntiņš · Green Classroom–Forest Trail Connector ───────────────────────────────────────────
  deguntins: {
    grade: '#c9a0ff',
    gradeOpacity: 0.1,
    layers: [
      { id: 'backdrop', art: 'photo-forest-soft', x: 0, y: 0, z: -14, height: 9, cover: true },
      ...frameTrees,
      { id: 'bush-l', art: 'garden-bush-left', x: -6.2, y: -3.9, z: -2.6, height: 3.4 },
      { id: 'bush-r', art: 'garden-bush-right', x: 6.4, y: -3.9, z: -2.6, height: 3.4 },
      { id: 'mascot', art: '@mascot', x: 4.9, y: -4.3, z: -0.7, height: 6.4, anim: 'breathe', pivot: 'bottom' },
      { id: 'wheel', art: 'scent-wheel', x: -1.3, y: -4.6, z: 0.2, height: 7.2, appear: 'activity', delay: 0.2, anim: 'sway', pivot: 'bottom' },
      { id: 'child', art: 'person-child', x: -5.2, y: -5.0, z: 1.6, height: 3.9, anim: 'breathe', pivot: 'bottom', appear: 'activity' },
      ...foreground,
    ],
    hotspots: [
      { kind: 'outline', layer: 'wheel', at: 3.0 },
      { kind: 'lines', shape: 'arcs', x: -1.3, y: -0.4, z: 0.8, size: 3.2, at: 4.0 },
      { kind: 'swatches', x: -1.3, y: 0.8, z: 0.9, colors: ['#6c8f3a', '#a67bc9', '#f08a24', '#e8dcb8', '#9a6a3c'], at: 5.4 },
      { kind: 'lines', shape: 'arcs', x: -1.3, y: 0.4, z: 0.9, size: 4.4, at: 1.0, after: 'moment' },
      { kind: 'halo', x: -1.3, y: 1.4, z: 0.9, size: 3.2, at: 1.0, after: 'moment' },
    ],
    keepsake: null,
  },

  // ── Plaukstiņa · Old Pine Park ───────────────────────────────────────────────────────────────────
  plaukstina: {
    grade: '#e0a870',
    gradeOpacity: 0.12,
    layers: [
      { id: 'backdrop', art: 'photo-forest-soft', x: 0, y: 0, z: -14, height: 9, cover: true },
      ...frameTrees,
      { id: 'mascot', art: '@mascot', x: 4.9, y: -4.3, z: -0.7, height: 6.4, anim: 'breathe', pivot: 'bottom' },
      { id: 'panel', art: 'touch-panel', x: -1.8, y: -4.4, z: 0.1, height: 5.2, appear: 'activity', delay: 0.2, pivot: 'bottom' },
      { id: 'trail', art: 'trail-patches', x: 0.6, y: -3.15, z: 1.2, height: 1.15, appear: 'moment' },
      { id: 'child', art: 'person-child', x: -6.0, y: -5.0, z: 1.8, height: 3.9, anim: 'breathe', pivot: 'bottom', appear: 'activity' },
      ...foreground,
    ],
    hotspots: [
      { kind: 'outline', layer: 'panel', at: 3.5 },
      { kind: 'halo', x: -1.8, y: -1.4, z: 0.6, size: 3.6, at: 2.0, after: 'moment' },
      { kind: 'ripple', x: -1.8, y: -1.4, z: 0.6, size: 3.4, at: 2.0, after: 'moment' },
      { kind: 'outline', layer: 'trail', at: 2.8, after: 'moment' },
    ],
    keepsake: null,
  },
};

export function compositionFor(id: GuardianId): StoryComposition {
  return COMPOSITIONS[id];
}

/** Every art key a composition uses (for preloading and for tests). */
export function artKeysOf(comp: StoryComposition): string[] {
  const keys = new Set<string>(comp.layers.map((l) => l.art));
  if (comp.keepsake) keys.add(comp.keepsake.art);
  keys.delete('@mascot');
  return [...keys];
}
