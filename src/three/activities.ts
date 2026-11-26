import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Object3D,
  type Texture,
} from 'three';
import { BRAND } from '../content/brand';
import type { Guardian } from '../content/guardians';
import { Kit } from './kit';
import { clamp01, easeInOut, easeOutBack, lerp } from './util';

/**
 * Stylised stand-ins for the *physical* activities each guardian previews.
 * Each visual is a pure function of time: `a` = seconds since the "activity" cue,
 * `m` = seconds since the "moment" cue (the memorable visual moment). -1 means "not yet".
 * `motion` is 0 when the user prefers reduced motion: flights and loops become fades/cuts.
 */
export interface ActivityCtx {
  t: number;
  a: number;
  m: number;
  motion: number;
}

export interface ActivityVisual {
  group: Group;
  update(ctx: ActivityCtx): void;
}

const C = BRAND.colors;
const pop = (s: number, dur = 0.5): number => (s < 0 ? 0 : easeOutBack(s / dur));

function glowSprite(tex: Texture, color: string | Color, size: number): Sprite {
  const s = new Sprite(
    new SpriteMaterial({ map: tex, color, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 }),
  );
  s.scale.setScalar(size);
  return s;
}

function leafShape(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, -0.06);
  s.quadraticCurveTo(0.065, -0.02, 0, 0.075);
  s.quadraticCurveTo(-0.065, -0.02, 0, -0.06);
  return new ShapeGeometry(s);
}

function flatMat(color: string | number, double = false): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...(double ? { side: DoubleSide } : {}) });
}

function additiveMat(color: string | Color, opacity = 0): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
}

function pointsCloud(count: number, tex: Texture, size: number): { points: Points; pos: BufferAttribute; col: BufferAttribute } {
  const geo = new BufferGeometry();
  const pos = new BufferAttribute(new Float32Array(count * 3), 3);
  const col = new BufferAttribute(new Float32Array(count * 3).fill(0), 3);
  geo.setAttribute('position', pos);
  geo.setAttribute('color', col);
  const points = new Points(
    geo,
    new PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
  );
  points.frustumCulled = false;
  return { points, pos, col };
}

// ───────────────────────────── Skats: forest detectives ─────────────────────────────
function forestDetective(g: Guardian, glow: Texture): ActivityVisual {
  const group = new Group();
  const theme = new Color(g.themeColor);
  const target = new Vector3(0, 0.4, 0);

  // Loose finds: leaves, cones, seeds scattered on the ground.
  interface Find {
    obj: Object3D;
    home: Vector3;
    delay: number;
  }
  const finds: Find[] = [];
  const leafGeo = leafShape();
  const leafColors = ['#d9a521', '#c4452f', '#6c8f3a'];
  const kit = new Kit();
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI * 2 + 0.4;
    const home = new Vector3(Math.cos(ang) * 0.42, 0.06, Math.sin(ang) * 0.3 + 0.1);
    let obj: Object3D;
    if (i % 3 === 0) {
      obj = new Mesh(leafGeo, flatMat(leafColors[(i / 3) % 3 | 0]!, true));
      obj.rotation.x = -Math.PI / 2 + 0.5;
      obj.scale.setScalar(1.2);
    } else if (i % 3 === 1) {
      obj = kit.cone(group, 0.03, 0.075, '#7a4f2d', 0, 0, 0, 6);
      obj.rotation.z = 0.8;
    } else {
      obj = kit.sphere(group, 0.022, '#c9a56a', 0, 0, 0, 6);
      obj.scale.set(1, 1.6, 1);
    }
    if (!obj.parent) group.add(obj);
    finds.push({ obj, home, delay: i * 0.18 });
  }

  // The salted-dough ornament with a leaf imprint and thread.
  const ornament = new Group();
  ornament.position.copy(target);
  group.add(ornament);
  const disc = new Mesh(new CylinderGeometry(0.17, 0.17, 0.035, 20), flatMat('#ead9ae'));
  disc.rotation.x = Math.PI / 2;
  ornament.add(disc);
  const imprint = new Mesh(leafGeo, flatMat('#b99b63', true));
  imprint.scale.setScalar(1.9);
  imprint.position.z = 0.022;
  ornament.add(imprint);
  const dots = new Group();
  ornament.add(dots);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const dot = new Mesh(new CircleGeometry(0.01, 6), flatMat('#b99b63'));
    dot.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.019);
    dots.add(dot);
  }
  const thread = new Mesh(new TorusGeometry(0.05, 0.007, 5, 14), flatMat('#c4452f'));
  thread.position.set(0, 0.19, 0);
  ornament.add(thread);
  const halo = glowSprite(glow, theme, 1.1);
  halo.position.z = -0.03;
  ornament.add(halo);

  // Detective's lens sweeping over the pattern during the moment
  const lens = new Mesh(new TorusGeometry(0.2, 0.012, 6, 28), additiveMat(C.gold, 0));
  lens.position.copy(target);
  group.add(lens);

  const sparks = pointsCloud(40, glow, 0.06);
  group.add(sparks.points);
  const dirs = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2 + (i % 3) * 0.3;
    const s = 0.25 + (i % 5) * 0.07;
    return new Vector3(Math.cos(a) * s, Math.sin(a) * s + 0.1, ((i % 4) - 1.5) * 0.04);
  });

  return {
    group,
    update({ t, a, m, motion }) {
      const conv = a < 0 ? 0 : clamp01((a - 6.5) / 3); // converge toward the ornament
      finds.forEach((f, i) => {
        const s = pop(a - f.delay);
        const hover = motion ? 0.07 + Math.sin(t * 2 + i) * 0.02 : 0.05;
        if (motion) {
          const lift = Math.sin(conv * Math.PI) * 0.25;
          f.obj.position.set(
            lerp(f.home.x, target.x, easeInOut(conv)),
            lerp(f.home.y + hover, target.y, easeInOut(conv)) + lift,
            lerp(f.home.z, target.z, easeInOut(conv)),
          );
          f.obj.scale.setScalar(Math.max(0.0001, s * (conv >= 1 ? 0 : 1)));
        } else {
          f.obj.position.set(f.home.x, f.home.y + hover, f.home.z);
          f.obj.scale.setScalar(Math.max(0.0001, s * (1 - clamp01((a - 6.5) / 1))));
        }
      });

      const base = motion ? conv : a >= 7.5 ? 1 : 0;
      const dough = base > 0 ? easeOutBack(base) : 0;
      const lifted = m < 0 ? 0 : easeInOut(m / 1.4);
      ornament.visible = dough > 0.01 || m >= 0;
      ornament.scale.setScalar(Math.max(0.0001, m >= 0 ? 1 : dough));
      ornament.position.set(0, target.y + lifted * 0.22, 0);
      const detail = pop(m - 0.2);
      imprint.scale.setScalar(1.9 * Math.max(0.0001, detail));
      dots.scale.setScalar(Math.max(0.0001, detail));
      thread.scale.setScalar(Math.max(0.0001, pop(m - 0.5)));
      (halo.material as SpriteMaterial).opacity = m < 0 ? 0 : Math.min(0.85, lifted * 0.85) * (0.8 + 0.2 * Math.sin(t * 3) * motion);

      const sweep = m < 0.6 || m > 3 ? 0 : (m - 0.6) / 2.4;
      lens.visible = sweep > 0 && motion > 0;
      lens.position.set(lerp(-0.34, 0.34, easeInOut(sweep)), target.y + lifted * 0.22, 0.05);
      (lens.material as MeshBasicMaterial).opacity = Math.sin(sweep * Math.PI) * 0.8;

      // Golden burst when the ornament lights up
      const b = m - 0.4;
      sparks.points.visible = b >= 0;
      if (b >= 0) {
        const age = Math.min(b, 2);
        const fade = Math.max(0, 1 - age / 2);
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i]!;
          sparks.pos.setXYZ(i, d.x * age * (motion ? 1 : 0.4), target.y + 0.22 + d.y * age - age * age * 0.05, d.z);
          sparks.col.setXYZ(i, theme.r * fade, theme.g * fade, theme.b * fade);
        }
        sparks.pos.needsUpdate = true;
        sparks.col.needsUpdate = true;
      }
    },
  };
}

// ───────────────────────────── Austiņa: layers of sound ─────────────────────────────
function soundLayers(g: Guardian, glow: Texture): ActivityVisual {
  void glow;
  const group = new Group();
  const theme = new Color(g.themeColor);
  const kit = new Kit();

  // Wooden xylophone
  const xylo = kit.group(group, 0, 0, 0.12);
  kit.box(xylo, 0.5, 0.02, 0.025, C.bark, 0, 0.08, -0.05);
  kit.box(xylo, 0.5, 0.02, 0.025, C.bark, 0, 0.08, 0.05);
  const bars: Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const bar = kit.box(xylo, 0.07, 0.025, 0.2 - i * 0.02, i % 2 ? C.wood : C.woodLight, -0.215 + i * 0.086, 0.1, 0);
    bar.material = new MeshStandardMaterial({ color: i % 2 ? C.wood : C.woodLight, roughness: 0.8, flatShading: true, emissive: theme, emissiveIntensity: 0 });
    bars.push(bar);
  }
  const mallet = kit.group(group, 0.3, 0.2, 0.15);
  kit.cyl(mallet, 0.007, 0.007, 0.16, C.woodLight, 0, 0, 0, 5).rotation.z = 0.7;
  kit.sphere(mallet, 0.02, C.bark, -0.055, 0.115, 0, 6);

  // Three sound sources: bird, leaf, wind
  const bird = new Group();
  kit.sphere(bird, 0.035, '#2f7fa8', 0, 0, 0, 7);
  kit.cone(bird, 0.013, 0.04, '#f0b43c', 0.045, 0, 0, 4).rotation.z = -Math.PI / 2;
  kit.cone(bird, 0.025, 0.07, '#245f80', -0.01, 0.025, 0.02, 3);
  kit.cone(bird, 0.025, 0.07, '#245f80', -0.01, 0.025, -0.02, 3);
  group.add(bird);

  const leaf = new Mesh(leafShape(), flatMat(C.leaf, true));
  leaf.scale.setScalar(1.6);
  group.add(leaf);

  const wind = new Group();
  group.add(wind);
  for (let i = 0; i < 3; i++) {
    const arc = new Mesh(new TorusGeometry(0.1 + i * 0.045, 0.006, 4, 18, Math.PI * 1.15), additiveMat('#ffffff', 0.6));
    arc.rotation.z = i * 0.9;
    wind.add(arc);
  }

  const sources = [
    { obj: bird, color: theme, delay: 0.4 },
    { obj: leaf, color: new Color(C.leaf).lerp(new Color('#ffffff'), 0.25), delay: 1.2 },
    { obj: wind, color: new Color('#ffffff'), delay: 2.0 },
  ];
  const rings: Mesh[][] = sources.map((s) =>
    Array.from({ length: 3 }, () => {
      const r = new Mesh(new RingGeometry(0.92, 1, 40), additiveMat(s.color, 0));
      group.add(r);
      return r;
    }),
  );

  // Moment: the three layers become glowing stacked rings above the forest
  const layers = [theme, new Color(C.leaf).lerp(new Color('#ffffff'), 0.2), new Color('#ffffff')].map((col, i) => {
    const disc = new Mesh(new RingGeometry(0.2 + i * 0.05, 0.42 + i * 0.05, 48), additiveMat(col, 0));
    disc.rotation.x = -Math.PI / 2;
    group.add(disc);
    return disc;
  });

  return {
    group,
    update({ t, a, m, motion }) {
      xylo.scale.setScalar(Math.max(0.0001, pop(a)));
      mallet.scale.setScalar(Math.max(0.0001, pop(a, 0.6)));
      const step = a < 0.8 ? -1 : Math.floor((a - 0.8) / 0.7) % 6;
      bars.forEach((b, i) => {
        const hit = step === i ? 1 - (((a - 0.8) % 0.7) / 0.7) : 0;
        (b.material as MeshStandardMaterial).emissiveIntensity = hit * 0.9;
        b.position.y = 0.1 + 0.0125 + hit * 0.012 * motion;
      });
      mallet.rotation.z = step >= 0 && motion ? Math.sin(a * 9) * 0.25 : 0;

      const w = t * 0.9 * motion;
      bird.position.set(Math.cos(w) * 0.32 - 0.05, 0.95 + Math.sin(w * 2) * 0.05, Math.sin(w) * 0.12 + 0.05);
      bird.rotation.y = -w + Math.PI;
      bird.scale.setScalar(Math.max(0.0001, pop(a - sources[0]!.delay)));
      const fall = motion ? (t * 0.22) % 1 : 0.3;
      leaf.position.set(-0.5 + Math.sin(fall * 6) * 0.06, 0.95 - fall * 0.45, 0.1);
      leaf.rotation.set(0.3, t * 0.6 * motion, Math.sin(fall * 8) * 0.6);
      leaf.scale.setScalar(1.6 * Math.max(0.0001, pop(a - sources[1]!.delay)));
      wind.position.set(0.5 + Math.sin(t * 0.8 * motion) * 0.04, 0.8, 0.1);
      wind.rotation.z = t * 0.9 * motion;
      wind.scale.setScalar(Math.max(0.0001, pop(a - sources[2]!.delay)));

      sources.forEach((src, si) => {
        rings[si]!.forEach((ring, ri) => {
          const age = a - src.delay;
          if (age < 0) {
            ring.visible = false;
            return;
          }
          const phase = motion ? (age * 0.55 + ri / 3) % 1 : (0.2 + ri * 0.3) % 1;
          ring.visible = true;
          ring.position.copy(src.obj.position);
          ring.scale.setScalar(lerp(0.05, 0.42, phase));
          (ring.material as MeshBasicMaterial).opacity = (1 - phase) * 0.5;
        });
      });

      layers.forEach((disc, i) => {
        const s = pop(m - i * 0.35, 0.7);
        disc.visible = s > 0.01;
        disc.position.set(0, 0.5 + i * 0.22 + Math.sin(t * 1.5 + i) * 0.015 * motion, 0.05);
        disc.scale.setScalar(Math.max(0.0001, s));
        disc.rotation.z = t * (0.4 + i * 0.2) * motion;
        (disc.material as MeshBasicMaterial).opacity = m < 0 ? 0 : 0.28 + Math.sin(t * 2.2 + i) * 0.08 * motion;
      });
    },
  };
}

// ───────────────────────────── Odziņa: tasting and the necklace ─────────────────────────────
function tasteNecklace(g: Guardian, glow: Texture): ActivityVisual {
  const group = new Group();
  const theme = new Color(g.themeColor);
  const kit = new Kit();

  kit.cyl(group, 0.32, 0.34, 0.03, C.woodLight, 0, 0, 0.12, 14);

  type Bead = { mesh: Mesh; type: 0 | 1 | 2; from: Vector3; to: Vector3 };
  const pileSpot: Record<number, Vector3> = {
    0: new Vector3(-0.19, 0.05, 0.12),
    1: new Vector3(0, 0.05, 0.12),
    2: new Vector3(0.19, 0.05, 0.12),
  };

  // Ingredient piles on a wooden tray
  const piles = new Group();
  group.add(piles);
  const orangeMat = flatMat('#f08a24');
  const sliceInner = flatMat('#ffc067');
  for (let i = 0; i < 3; i++) {
    const slice = new Mesh(new CylinderGeometry(0.075, 0.075, 0.016, 14), orangeMat);
    slice.position.set(-0.19, 0.04 + i * 0.016, 0.12);
    slice.rotation.y = i;
    piles.add(slice);
    const inner = new Mesh(new CylinderGeometry(0.055, 0.055, 0.018, 8), sliceInner);
    inner.position.copy(slice.position);
    piles.add(inner);
  }
  for (let i = 0; i < 6; i++) {
    kit.sphere(piles, 0.028, i % 2 ? '#b3263e' : '#3b4a8c', Math.cos(i * 1.4) * 0.05, 0.06 + (i > 3 ? 0.03 : 0), 0.12 + Math.sin(i * 1.4) * 0.05, 7);
  }
  for (let i = 0; i < 4; i++) {
    const nut = kit.sphere(piles, 0.03, '#8a5a33', 0.19 + Math.cos(i * 1.7) * 0.05, 0.055, 0.12 + Math.sin(i * 1.7) * 0.05, 7);
    nut.scale.set(1, 1.2, 0.9);
  }

  // Necklace hangs from two pegs
  const arc = (u: number) => new Vector3(lerp(-0.3, 0.3, u), 0.86 - Math.sin(Math.PI * u) * 0.3, -0.02);
  for (const x of [-0.32, 0.32]) kit.cyl(group, 0.012, 0.012, 0.08, C.wood, x, 0.82, -0.02, 5);
  const curve = new CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => arc(i / 11)));
  const thread = new Mesh(new TubeGeometry(curve, 24, 0.005, 4), flatMat('#6b4a2c'));
  group.add(thread);

  const beads: Bead[] = [];
  const pattern: Array<0 | 1 | 2> = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0];
  const sliceGeo = new CylinderGeometry(0.06, 0.06, 0.014, 12);
  const berryGeo = new SphereGeometry(0.03, 8, 6);
  const nutGeo = new SphereGeometry(0.032, 8, 6);
  const redMat = flatMat('#b3263e');
  const blueMat = flatMat('#3b4a8c');
  const nutMat = flatMat('#8a5a33');
  pattern.forEach((type, i) => {
    let mesh: Mesh;
    if (type === 0) {
      mesh = new Mesh(sliceGeo, orangeMat);
      mesh.rotation.x = Math.PI / 2;
    } else if (type === 1) {
      mesh = new Mesh(berryGeo, i % 4 === 1 ? redMat : blueMat);
    } else {
      mesh = new Mesh(nutGeo, nutMat);
      mesh.scale.set(1, 1.25, 0.9);
    }
    mesh.castShadow = true;
    group.add(mesh);
    beads.push({ mesh, type, from: pileSpot[type]!.clone(), to: arc(i / (pattern.length - 1)) });
  });

  const halo = glowSprite(glow, theme, 1.2);
  halo.position.set(0, 0.62, -0.06);
  group.add(halo);

  return {
    group,
    update({ t, a, m, motion }) {
      piles.scale.setScalar(Math.max(0.0001, pop(a, 0.6)));
      thread.visible = m >= 0.8;
      beads.forEach((b, i) => {
        const p = m < 0 ? 0 : clamp01((m - i * 0.14) / 1.1);
        if (p <= 0) {
          b.mesh.visible = false;
          return;
        }
        b.mesh.visible = true;
        const e = motion ? easeInOut(p) : 1;
        b.mesh.position.set(lerp(b.from.x, b.to.x, e), lerp(b.from.y, b.to.y, e) + Math.sin(e * Math.PI) * 0.18 * motion, lerp(b.from.z, b.to.z, e));
        const s = motion ? 1 : clamp01(p * 3);
        const k = Math.max(0.0001, s);
        if (b.type === 2) b.mesh.scale.set(k, k * 1.25, k * 0.9);
        else b.mesh.scale.setScalar(k);
      });
      const glowIn = m < 1.6 ? 0 : easeInOut((m - 1.6) / 1.2);
      (halo.material as SpriteMaterial).opacity = glowIn * (0.55 + Math.sin(t * 2.5) * 0.12 * motion);
    },
  };
}

// ───────────────────────────── Deguntiņš: the scent wheel ─────────────────────────────
function scentWheel(g: Guardian, glow: Texture): ActivityVisual {
  const group = new Group();
  const kit = new Kit();
  void g;
  const sectorColors = [C.moss, '#8a5a33', '#a67bc9', '#f08a24', '#2c5a35', '#f3e9cf'];
  const center = new Vector3(0, 0.66, 0.05);

  const stand = new Group();
  group.add(stand);
  kit.cyl(stand, 0.02, 0.026, 0.5, C.wood, 0, 0, 0, 6);
  kit.cyl(stand, 0.16, 0.18, 0.03, C.woodLight, 0, 0, 0, 10);

  const wheel = new Group();
  wheel.position.copy(center);
  group.add(wheel);
  const face = new Group();
  face.rotation.x = Math.PI / 2; // stand the disc up so it faces the audience
  wheel.add(face);
  sectorColors.forEach((col, i) => {
    const sector = new Mesh(new CylinderGeometry(0.33, 0.33, 0.04, 14, 1, false, (i * Math.PI) / 3, Math.PI / 3), flatMat(col));
    face.add(sector);
    // Small icon per sector: a coloured bead near the rim
    const a = (i + 0.5) * (Math.PI / 3);
    const bead = new Mesh(new CylinderGeometry(0.045, 0.045, 0.05, 8), flatMat(i % 2 ? '#fff3d0' : '#2a1a10'));
    bead.position.set(Math.sin(a) * 0.21, 0, Math.cos(a) * 0.21);
    face.add(bead);
  });
  const hub = kit.sphere(wheel, 0.045, C.gold, 0, 0, 0.03, 8);
  hub.castShadow = false;
  const pointer = kit.cone(group, 0.035, 0.08, C.gold, center.x, center.y + 0.35, center.z + 0.04, 3);
  pointer.rotation.x = Math.PI;

  // Rising scent wisps from the wheel
  const wisps = pointsCloud(48, glow, 0.075);
  group.add(wisps.points);
  const wisp = Array.from({ length: 48 }, (_, i) => ({ sector: i % 6, offset: i / 48 }));

  // Moment: a coloured ribbon of scent spirals up through the trees
  const SPIRAL = 110;
  const spiral = pointsCloud(SPIRAL, glow, 0.085);
  group.add(spiral.points);
  const tmp = new Color();

  return {
    group,
    update({ t, a, m, motion }) {
      const s = Math.max(0.0001, pop(a, 0.6));
      stand.scale.setScalar(s);
      wheel.scale.setScalar(s);
      pointer.scale.setScalar(s);
      wheel.rotation.z = a < 0 ? 0 : easeInOut(a / 3) * 0.9 + (a * 0.35 * motion);

      wisps.points.visible = a > 0.8;
      if (a > 0.8) {
        for (let i = 0; i < wisp.length; i++) {
          const w = wisp[i]!;
          const phase = motion ? ((a - 0.8) * 0.28 + w.offset) % 1 : 0.35;
          const ang = (w.sector + 0.5) * (Math.PI / 3) + wheel.rotation.z;
          const x = center.x + Math.sin(ang) * 0.2 + Math.sin(phase * 7 + i) * 0.06 * phase;
          const y = center.y + Math.cos(ang) * 0.2 + phase * 0.55;
          wisps.pos.setXYZ(i, x, y, center.z + 0.06);
          tmp.set(sectorColors[w.sector]!).multiplyScalar((1 - phase) * 0.9);
          wisps.col.setXYZ(i, tmp.r, tmp.g, tmp.b);
        }
        wisps.pos.needsUpdate = true;
        wisps.col.needsUpdate = true;
      }

      spiral.points.visible = m >= 0;
      if (m >= 0) {
        const grow = motion ? clamp01(m / 3) : 1;
        const fadeIn = motion ? 1 : clamp01(m / 0.8);
        const spin = t * 0.7 * motion;
        for (let i = 0; i < SPIRAL; i++) {
          const u = i / (SPIRAL - 1);
          const shown = u <= grow;
          const ang = u * Math.PI * 5 + spin;
          const r = 0.14 + u * 0.4;
          spiral.pos.setXYZ(i, Math.cos(ang) * r, 0.25 + u * 1.15, 0.15 + Math.sin(ang) * r * 0.55);
          tmp.set(sectorColors[Math.floor(u * 12) % 6]!).multiplyScalar(shown ? fadeIn * (0.45 + 0.55 * (1 - u * 0.5)) : 0);
          spiral.col.setXYZ(i, tmp.r, tmp.g, tmp.b);
        }
        spiral.pos.needsUpdate = true;
        spiral.col.needsUpdate = true;
      }
    },
  };
}

// ───────────────────────────── Plaukstiņa: touch panel and sensory trail ─────────────────────────────
function touchTrail(g: Guardian, glow: Texture): ActivityVisual {
  const group = new Group();
  const theme = new Color(g.themeColor);
  const kit = new Kit();

  // Touch panel with four hidden objects behind wooden flaps
  const panel = kit.group(group, 0, 0, -0.02);
  kit.box(panel, 0.74, 0.54, 0.05, C.wood, 0, 0.06, 0);
  kit.box(panel, 0.66, 0.46, 0.012, '#3a2616', 0, 0.1, 0.03);
  const hiddenSpots: Array<[number, number]> = [[-0.17, 0.43], [0.17, 0.43], [-0.17, 0.2], [0.17, 0.2]];
  const flaps: Group[] = [];
  const objects: Object3D[] = [];
  hiddenSpots.forEach(([x, y], i) => {
    kit.cyl(panel, 0.085, 0.085, 0.012, '#150d07', x, y - 0.06, 0.04, 14).rotation.x = Math.PI / 2;
    // Hidden object: pine cone, moss, wood block, bark
    let obj: Object3D;
    if (i === 0) obj = kit.cone(panel, 0.04, 0.1, '#7a4f2d', x, y - 0.11, 0.07, 7);
    else if (i === 1) obj = kit.sphere(panel, 0.05, C.moss, x, y - 0.06, 0.07, 8);
    else if (i === 2) obj = kit.box(panel, 0.07, 0.07, 0.07, C.woodLight, x, y - 0.1, 0.07);
    else obj = kit.cyl(panel, 0.05, 0.05, 0.035, '#9a5d38', x, y - 0.075, 0.07, 6);
    obj.visible = false;
    objects.push(obj);
    const flap = kit.group(panel, x, y + 0.06, 0.05);
    kit.box(flap, 0.17, 0.17, 0.014, C.woodLight, 0, -0.17, 0.0);
    kit.sphere(flap, 0.013, C.bark, 0, -0.1, 0.014, 5);
    flaps.push(flap);
  });

  // Sensory trail: bark, cones, moss, sand, wood
  type Patch = { g: Group; ring: Mesh; base: number };
  const patches: Patch[] = [];
  const trailX = [-0.56, -0.28, 0, 0.28, 0.56];
  const trailZ = [0.62, 0.74, 0.78, 0.74, 0.62];
  const makers: Array<(p: Group) => void> = [
    (p) => {
      kit.box(p, 0.2, 0.025, 0.16, '#6b4a2c', 0, 0, 0);
      for (let i = 0; i < 4; i++) kit.box(p, 0.19, 0.012, 0.014, '#3d2815', 0, 0.025, -0.06 + i * 0.04);
    },
    (p) => {
      kit.cyl(p, 0.1, 0.1, 0.02, '#8a6b45', 0, 0, 0, 10);
      for (let i = 0; i < 4; i++) kit.cone(p, 0.022, 0.05, '#5e3b22', Math.cos(i * 1.6) * 0.05, 0.02, Math.sin(i * 1.6) * 0.05, 5);
    },
    (p) => {
      kit.cyl(p, 0.1, 0.1, 0.02, '#3f6b2b', 0, 0, 0, 10);
      for (let i = 0; i < 5; i++) kit.sphere(p, 0.04, C.moss, Math.cos(i * 1.3) * 0.055, 0.035, Math.sin(i * 1.3) * 0.055, 6).scale.y = 0.55;
    },
    (p) => {
      kit.cyl(p, 0.1, 0.1, 0.02, '#e0cf9a', 0, 0, 0, 10);
      for (let i = 0; i < 6; i++) kit.sphere(p, 0.012, '#c9b27a', Math.cos(i * 1.1) * 0.06, 0.025, Math.sin(i * 1.1) * 0.06, 4);
    },
    (p) => {
      kit.box(p, 0.2, 0.025, 0.16, C.woodLight, 0, 0, 0);
      for (let i = 0; i < 3; i++) kit.box(p, 0.19, 0.008, 0.01, C.wood, 0, 0.025, -0.05 + i * 0.05);
    },
  ];
  makers.forEach((make, i) => {
    const pg = kit.group(group, trailX[i]!, 0, trailZ[i]!);
    make(pg);
    const ring = new Mesh(new RingGeometry(0.12, 0.17, 24), additiveMat(theme, 0));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    pg.add(ring);
    patches.push({ g: pg, ring, base: i });
  });

  // Glowing hand-print blooming on the panel
  const hand = new Group();
  hand.position.set(0, 0.32, 0.0);
  group.add(hand);
  const handMat = additiveMat(theme, 0);
  hand.add(new Mesh(new CircleGeometry(0.085, 20), handMat));
  for (let i = 0; i < 5; i++) {
    const ang = -0.9 + i * 0.45;
    const len = i === 0 ? 0.07 : 0.1;
    const finger = new Mesh(new CircleGeometry(0.026, 10), handMat);
    finger.scale.y = len / 0.026;
    const r = 0.1 + len * 0.45;
    finger.position.set(Math.sin(ang) * (i === 0 ? r + 0.02 : r), Math.cos(ang) * (i === 0 ? r - 0.02 : r) + (i === 0 ? -0.03 : 0), 0);
    finger.rotation.z = -ang;
    hand.add(finger);
  }
  hand.position.z = 0.1;
  const halo = glowSprite(glow, theme, 1.0);
  halo.position.set(0, 0.32, 0.09);
  group.add(halo);
  const ripple = new Mesh(new RingGeometry(0.92, 1, 40), additiveMat(theme, 0));
  ripple.position.set(0, 0.32, 0.12);
  group.add(ripple);

  return {
    group,
    update({ t, a, m, motion }) {
      panel.scale.setScalar(Math.max(0.0001, pop(a, 0.6)));
      flaps.forEach((f, i) => {
        const open = a < 0 ? 0 : easeInOut((a - (1.0 + i * 1.1)) / 0.7);
        f.rotation.x = -open * 1.45;
        const o = objects[i]!;
        o.visible = open > 0.05;
        o.scale.setScalar(Math.max(0.0001, easeOutBack(open)));
        o.position.z = 0.07 + open * 0.05 * motion;
      });

      patches.forEach((p, i) => {
        const s = pop(m - i * 0.3, 0.5);
        p.g.scale.setScalar(Math.max(0.0001, s));
        const cycle = m < 0 ? 0 : Math.max(0, 1 - Math.abs(((m * 0.9 - i * 0.28) % 2.6) - 0.5) * 2.2);
        (p.ring.material as MeshBasicMaterial).opacity = cycle * 0.85 * (motion ? 1 : 0.6);
        p.g.position.y = motion ? cycle * 0.03 : 0;
      });

      const bloom = m < 0.3 ? 0 : easeOutBack((m - 0.3) / 0.8);
      hand.scale.setScalar(Math.max(0.0001, bloom));
      handMat.opacity = m < 0.3 ? 0 : 0.5 + Math.sin(t * 3) * 0.12 * motion;
      (halo.material as SpriteMaterial).opacity = m < 0.3 ? 0 : 0.5 * Math.min(1, bloom);
      const r = m < 0.6 ? -1 : motion ? ((m - 0.6) * 0.5) % 1 : 0.4;
      ripple.visible = r >= 0;
      ripple.scale.setScalar(Math.max(0.0001, lerp(0.1, 0.55, Math.max(0, r))));
      (ripple.material as MeshBasicMaterial).opacity = r < 0 ? 0 : (1 - r) * 0.5;
    },
  };
}

const ACTIVITIES: Record<string, (g: Guardian, glow: Texture) => ActivityVisual> = {
  'activity-forest-detective': forestDetective,
  'activity-sound-layers': soundLayers,
  'activity-taste-necklace': tasteNecklace,
  'activity-scent-wheel': scentWheel,
  'activity-touch-trail': touchTrail,
};

export function buildActivity(guardian: Guardian, glow: Texture): ActivityVisual {
  const build = ACTIVITIES[guardian.assetKeys.activity];
  if (!build) return { group: new Group(), update() {} };
  return build(guardian, glow);
}

/** Keys with an implemented visual (used by tests to catch data/code drift). */
export const ACTIVITY_KEYS: readonly string[] = Object.keys(ACTIVITIES);
