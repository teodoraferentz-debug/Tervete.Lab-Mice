import { Group } from 'three';
import { BRAND } from '../content/brand';
import { Kit } from './kit';

const C = BRAND.colors;

type LandmarkBuilder = (kit: Kit, root: Group) => void;

/** Stylised stand-ins for each zone's real landmark. Selected by `assetKeys.landmark`. */
const LANDMARKS: Record<string, LandmarkBuilder> = {
  // Hornet Garden: viewing platform, flower beds, honeycomb paving, a paper lantern.
  'landmark-hornet-garden': (k, g) => {
    const deck = k.group(g, 0, 0, -0.05);
    k.box(deck, 0.62, 0.05, 0.42, C.woodLight, 0, 0.3, 0);
    for (const [x, z] of [[-0.26, -0.16], [0.26, -0.16], [-0.26, 0.16], [0.26, 0.16]] as const) {
      k.cyl(deck, 0.026, 0.03, 0.3, C.wood, x, 0, z, 6);
    }
    k.box(deck, 0.62, 0.025, 0.02, C.wood, 0, 0.5, 0.2);
    k.box(deck, 0.62, 0.025, 0.02, C.wood, 0, 0.5, -0.2);
    k.box(deck, 0.02, 0.025, 0.4, C.wood, -0.3, 0.5, 0);
    for (const [x, z] of [[-0.3, 0.2], [0.3, 0.2], [-0.3, -0.2], [0.3, -0.2]] as const) k.box(deck, 0.025, 0.2, 0.025, C.wood, x, 0.3, z);
    // Lantern shaped like a paper nest
    const lantern = k.sphere(deck, 0.07, '#e8d6a8', 0.12, 0.62, 0.04, 8);
    lantern.scale.y = 1.3;
    k.cyl(deck, 0.004, 0.004, 0.14, C.bark, 0.12, 0.66, 0.04, 4);
    // Honeycomb paving
    const hexes: Array<[number, number]> = [[0.38, 0.28], [0.52, 0.28], [0.45, 0.15], [0.59, 0.15], [0.31, 0.14]];
    hexes.forEach(([x, z], i) => {
      k.cyl(g, 0.065, 0.065, 0.02, i % 2 ? '#d9a521' : '#e8bb3a', x, 0, z, 6);
    });
    // Flower beds
    const blooms = ['#f3b6c4', '#fff2b0', '#ffffff', '#f09a6a'];
    const beds: Array<[number, number]> = [[-0.42, 0.18], [-0.5, -0.05], [-0.36, -0.22], [0.5, -0.18], [0.36, -0.3]];
    beds.forEach(([x, z], i) => {
      k.sphere(g, 0.1, i % 2 ? C.moss : C.leaf, x, 0.07, z, 7).scale.y = 0.7;
      for (let n = 0; n < 4; n++) k.sphere(g, 0.022, blooms[(i + n) % blooms.length]!, x + Math.cos(n * 1.7) * 0.07, 0.15 + (n % 2) * 0.02, z + Math.sin(n * 1.7) * 0.07, 5);
    });
  },

  // Fairy Tale Forest: the king's wooden tower and carved storybook figures.
  'landmark-fairy-tale-forest': (k, g) => {
    const tower = k.group(g, -0.12, 0, -0.1);
    k.box(tower, 0.22, 0.5, 0.22, C.wood, 0, 0, 0);
    k.box(tower, 0.3, 0.05, 0.3, C.woodLight, 0, 0.5, 0);
    k.box(tower, 0.2, 0.14, 0.2, C.woodLight, 0, 0.55, 0);
    const roof = k.cone(tower, 0.22, 0.26, '#3e6b3a', 0, 0.69, 0, 4);
    roof.rotation.y = Math.PI / 4;
    k.box(tower, 0.05, 0.09, 0.012, '#2a1a10', 0, 0.02, 0.112);
    // Carved figures
    const figures: Array<[number, number, number, string]> = [
      [0.3, 0.1, 0.34, '#a8743f'],
      [0.46, -0.1, 0.26, '#8c5f32'],
      [-0.4, 0.2, 0.3, '#9b6a38'],
    ];
    figures.forEach(([x, z, h, col]) => {
      const f = k.group(g, x, 0, z);
      k.cyl(f, 0.05, 0.065, h, col, 0, 0, 0, 7);
      k.sphere(f, 0.055, col, 0, h + 0.03, 0, 8);
      k.cone(f, 0.06, 0.1, '#3e6b3a', 0, h + 0.07, 0, 6);
      k.box(f, 0.012, 0.012, 0.03, '#2a1a10', -0.02, h + 0.04, 0.05);
      k.box(f, 0.012, 0.012, 0.03, '#2a1a10', 0.02, h + 0.04, 0.05);
    });
    // Mushrooms
    const shrooms: Array<[number, number]> = [[0.1, 0.32], [-0.2, 0.3]];
    shrooms.forEach(([x, z]) => {
      k.cyl(g, 0.012, 0.016, 0.05, '#f2e6c8', x, 0, z, 5);
      const cap = k.sphere(g, 0.04, '#c4452f', x, 0.055, z, 7);
      cap.scale.y = 0.6;
    });
  },

  // Gnome Forest: a village of tiny coloured houses.
  'landmark-gnome-forest': (k, g) => {
    const roofs = ['#c4452f', '#2f7fa8', '#e2aa18', '#e8743b', '#3a9a8a', '#d86a96'];
    const walls = ['#f0e0b8', '#e8d4a4', '#f4e6c4'];
    const spots: Array<[number, number, number]> = [
      [-0.3, -0.12, 0.2],
      [0.0, -0.22, 0.24],
      [0.3, -0.1, 0.18],
      [-0.12, 0.12, 0.17],
      [0.2, 0.18, 0.2],
      [-0.42, 0.18, 0.15],
    ];
    spots.forEach(([x, z, h], i) => {
      const house = k.group(g, x, 0, z);
      house.rotation.y = (i - 2.5) * 0.18;
      k.box(house, h * 0.85, h * 0.7, h * 0.85, walls[i % walls.length]!, 0, 0, 0);
      const roof = k.cone(house, h * 0.75, h * 0.55, roofs[i % roofs.length]!, 0, h * 0.7, 0, 4);
      roof.rotation.y = Math.PI / 4;
      k.box(house, h * 0.16, h * 0.3, 0.012, '#5e3b22', 0, 0, h * 0.43);
      k.box(house, h * 0.18, h * 0.16, 0.012, '#8ecae6', h * 0.24, h * 0.34, h * 0.43);
    });
    // Cobbled street
    for (let i = 0; i < 6; i++) k.cyl(g, 0.04, 0.04, 0.012, '#b8a888', -0.3 + i * 0.12, 0, 0.03 + Math.sin(i) * 0.04, 6);
    // Little lookout tower
    k.box(g, 0.1, 0.4, 0.1, C.wood, 0.5, 0, -0.22);
    const top = k.cone(g, 0.13, 0.14, '#3e6b3a', 0.5, 0.4, -0.22, 4);
    top.rotation.y = Math.PI / 4;
  },

  // Green Classroom–Forest Trail Connector: open pavilion, herb beds, a scent table.
  'landmark-green-classroom': (k, g) => {
    const pav = k.group(g, -0.1, 0, -0.08);
    for (const [x, z] of [[-0.24, -0.18], [0.24, -0.18], [-0.24, 0.18], [0.24, 0.18]] as const) k.cyl(pav, 0.028, 0.03, 0.32, C.wood, x, 0, z, 6);
    const roof = k.cone(pav, 0.42, 0.2, '#4a7729', 0, 0.32, 0, 4);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.75);
    k.box(pav, 0.34, 0.03, 0.12, C.woodLight, 0, 0.1, -0.05);
    k.box(pav, 0.34, 0.03, 0.12, C.woodLight, 0, 0.1, 0.1);
    // Herb beds
    ['#6c8f3a', '#7ea84a', '#9aa84a'].forEach((col, i) => {
      k.box(g, 0.2, 0.05, 0.1, C.wood, 0.34, 0, -0.2 + i * 0.16);
      for (let n = 0; n < 3; n++) k.sphere(g, 0.04, col, 0.28 + n * 0.06, 0.08, -0.2 + i * 0.16, 6);
    });
    // Scent table
    k.cyl(g, 0.12, 0.12, 0.02, C.woodLight, -0.42, 0.16, 0.22, 10);
    k.cyl(g, 0.02, 0.025, 0.16, C.wood, -0.42, 0, 0.22, 6);
  },

  // Old Pine Park: a few very old, very tall pines on mossy ground.
  'landmark-old-pine-park': (k, g) => {
    const pines: Array<[number, number, number]> = [
      [-0.3, -0.1, 1.15],
      [0.05, -0.28, 1.35],
      [0.38, 0.0, 1.2],
      [-0.08, 0.2, 1.0],
    ];
    pines.forEach(([x, z, h]) => {
      const p = k.group(g, x, 0, z);
      k.cyl(p, 0.045, 0.085, h, '#9a5d38', 0, 0, 0, 7);
      k.cone(p, 0.26, 0.34, '#2c5a35', 0, h * 0.55, 0, 7);
      k.cone(p, 0.2, 0.3, '#34663a', 0, h * 0.75, 0, 7);
      k.cone(p, 0.14, 0.28, '#3b7340', 0, h * 0.93, 0, 7);
    });
    const mounds: Array<[number, number, number]> = [[-0.1, -0.02, 0.17], [0.28, 0.2, 0.12], [-0.4, 0.14, 0.13]];
    mounds.forEach(([x, z, r]) => {
      const moss = k.sphere(g, r, C.moss, x, 0.02, z, 7);
      moss.scale.y = 0.35;
    });
    const cones: Array<[number, number]> = [[0.5, 0.18], [-0.2, 0.34], [0.2, -0.05]];
    cones.forEach(([x, z]) => k.cone(g, 0.018, 0.04, C.bark, x, 0, z, 5));
    const rock = k.sphere(g, 0.07, '#8a8d86', 0.5, 0.03, -0.2, 6);
    rock.scale.set(1.2, 0.7, 1);
  },
};

export function buildLandmark(key: string, kit: Kit): Group {
  const g = new Group();
  const build = LANDMARKS[key];
  if (build) build(kit, g);
  else kit.cyl(g, 0.3, 0.3, 0.03, BRAND.colors.woodLight, 0, 0, 0, 12); // unknown key → plain clearing
  return g;
}

/** Keys with an implemented landmark (used by tests to catch data/code drift). */
export const LANDMARK_KEYS: readonly string[] = Object.keys(LANDMARKS);
