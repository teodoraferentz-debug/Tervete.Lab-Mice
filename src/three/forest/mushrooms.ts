import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  TorusGeometry,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { mulberry32 } from '../util';
import type { Interactable, InteractionManager } from './interaction';
import { canvasTexture } from './procedural';
import type { SceneCtx } from './types';

/**
 * Mushrooms on the forest floor of every scene, modelled on species of the Baltic forest, that you can pick
 * (grab) and put in a wicker basket. Purely a look-and-collect game in VR: the labels say "look, never taste",
 * in line with the safety note of the Taste scene. Not part of the brief (marked as an addition).
 */

export type Species = 'amanita' | 'bolete' | 'chanterelle' | 'birch';

interface Spec {
  name: string;
  /** Hover caption: the name, and the rule. */
  label: string;
  kind: 'dome' | 'funnel';
  /** Cap radius and height (metres, before the per-mushroom scale). */
  R: number;
  H: number;
  stem: { h: number; r0: number; r1: number; bulb: number };
  ring: boolean;
  cap: () => Texture;
  stemTex: () => Texture;
  /** The cap texture: fraction of its height used by the upper surface (the rest is gills / pores). */
  split: number;
}

const rnd = mulberry32(404);

function noisy(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, rgba: () => string, size = 1.4): void {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rgba();
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, 0.5 + rnd() * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gillsTexture(w: number, h: number, top: number, color: string, line: string): (ctx: CanvasRenderingContext2D) => void {
  return (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, top, w, h - top);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.2;
    for (let x = 0; x < w; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  };
}

const SPECS: Record<Species, Spec> = {
  amanita: {
    name: 'Fly agaric',
    label: 'Fly agaric · poisonous: look, never touch in the forest',
    kind: 'dome',
    R: 0.075,
    H: 0.05,
    stem: { h: 0.13, r0: 0.02, r1: 0.014, bulb: 0.034 },
    ring: true,
    split: 0.72,
    cap: () =>
      canvasTexture(256, 160, (ctx, w, h) => {
        const top = h * 0.72;
        const g = ctx.createLinearGradient(0, 0, 0, top);
        g.addColorStop(0, '#9c1d12');
        g.addColorStop(0.7, '#c4301f');
        g.addColorStop(1, '#d9553a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, top);
        for (let i = 0; i < 70; i++) {
          const y = 8 + rnd() * (top - 12);
          const s = 1.5 + (y / top) * 5.5;
          ctx.fillStyle = `rgba(250,244,230,${0.85 + rnd() * 0.15})`;
          ctx.beginPath();
          ctx.ellipse(rnd() * w, y, s * 1.5, s * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        gillsTexture(w, h, top, '#efe6d2', 'rgba(150,130,100,.55)')(ctx);
      }),
    stemTex: () =>
      canvasTexture(64, 128, (ctx, w, h) => {
        ctx.fillStyle = '#efe9da';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 18; i++) {
          ctx.strokeStyle = `rgba(150,135,105,${0.12 + rnd() * 0.18})`;
          ctx.lineWidth = 1 + rnd() * 1.5;
          const x = rnd() * w;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + (rnd() - 0.5) * 6, h);
          ctx.stroke();
        }
      }),
  },
  bolete: {
    name: 'Porcini',
    label: 'Porcini · look, never taste',
    kind: 'dome',
    R: 0.085,
    H: 0.062,
    stem: { h: 0.11, r0: 0.03, r1: 0.024, bulb: 0.042 },
    ring: false,
    split: 0.78,
    cap: () =>
      canvasTexture(256, 160, (ctx, w, h) => {
        const top = h * 0.78;
        const g = ctx.createLinearGradient(0, 0, 0, top);
        g.addColorStop(0, '#5e3519');
        g.addColorStop(0.6, '#7d4c28');
        g.addColorStop(1, '#a8794a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, top);
        noisy(ctx, w, top, 700, () => `rgba(${rnd() > 0.5 ? '60,35,15' : '190,150,100'},${0.1 + rnd() * 0.18})`, 3);
        ctx.fillStyle = '#d8c98a';
        ctx.fillRect(0, top, w, h - top);
        noisy(ctx, w, h, 600, () => `rgba(150,130,70,${0.2 + rnd() * 0.3})`, 1.2);
      }),
    stemTex: () =>
      canvasTexture(64, 128, (ctx, w, h) => {
        ctx.fillStyle = '#d9c7a3';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(250,244,225,.5)';
        ctx.lineWidth = 1.4;
        for (let y = 0; y < h; y += 7) for (let x = 0; x < w; x += 9) {
          ctx.beginPath();
          ctx.ellipse(x + (y % 14 ? 4 : 0), y, 5, 3.4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }),
  },
  chanterelle: {
    name: 'Chanterelle',
    label: 'Chanterelle · look, never taste',
    kind: 'funnel',
    R: 0.052,
    H: 0.11,
    stem: { h: 0, r0: 0, r1: 0, bulb: 0 },
    ring: false,
    split: 0.62,
    cap: () =>
      canvasTexture(256, 192, (ctx, w, h) => {
        const top = h * 0.62;
        ctx.fillStyle = '#e0a22a';
        ctx.fillRect(0, 0, w, top);
        for (let x = 0; x < w; x += 6) {
          ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,215,120' : '170,110,20'},${0.25 + rnd() * 0.3})`;
          ctx.lineWidth = 1.5 + rnd() * 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 5, top * 0.4, x - 4, top * 0.7, x + (rnd() - 0.5) * 8, top);
          ctx.stroke();
        }
        const g = ctx.createLinearGradient(0, top, 0, h);
        g.addColorStop(0, '#f1c456');
        g.addColorStop(1, '#d99a1e');
        ctx.fillStyle = g;
        ctx.fillRect(0, top, w, h - top);
        noisy(ctx, w, h - top, 300, () => `rgba(140,90,20,${0.1 + rnd() * 0.2})`, 2);
      }),
    stemTex: () => canvasTexture(8, 8, () => undefined),
  },
  birch: {
    name: 'Birch bolete',
    label: 'Birch bolete · look, never taste',
    kind: 'dome',
    R: 0.062,
    H: 0.04,
    stem: { h: 0.15, r0: 0.0165, r1: 0.0125, bulb: 0.02 },
    ring: false,
    split: 0.8,
    cap: () =>
      canvasTexture(256, 160, (ctx, w, h) => {
        const top = h * 0.8;
        const g = ctx.createLinearGradient(0, 0, 0, top);
        g.addColorStop(0, '#946a42');
        g.addColorStop(1, '#bd9462');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, top);
        noisy(ctx, w, top, 500, () => `rgba(90,60,30,${0.08 + rnd() * 0.14})`, 3);
        ctx.fillStyle = '#e4dcc0';
        ctx.fillRect(0, top, w, h - top);
      }),
    stemTex: () =>
      canvasTexture(64, 128, (ctx, w, h) => {
        ctx.fillStyle = '#e8e2cf';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 140; i++) {
          ctx.strokeStyle = `rgba(55,40,30,${0.4 + rnd() * 0.4})`;
          ctx.lineWidth = 1.6;
          const x = rnd() * w;
          const y = rnd() * h;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.8, y + 4);
          ctx.stroke();
        }
      }),
  },
};

const textures = new Map<Species, { cap: Texture; stem: Texture }>();

function texturesFor(s: Species): { cap: Texture; stem: Texture } {
  let t = textures.get(s);
  if (!t) {
    t = { cap: SPECS[s].cap(), stem: SPECS[s].stemTex() };
    textures.set(s, t);
  }
  return t;
}

/** Pushes a lathe outline off-round and uneven, so no two caps are the same circle. */
function wobble(geo: BufferGeometry, seed: number, amount: number): void {
  const r = mulberry32(seed);
  const a1 = r() * 6.28;
  const a2 = r() * 6.28;
  const p = geo.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const ang = Math.atan2(z, x);
    const k = 1 + amount * (Math.sin(ang * 2 + a1) * 0.6 + Math.sin(ang * 3 + a2) * 0.4);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
}

function capGeometry(spec: Spec, seed: number): BufferGeometry {
  const pts: Vector2[] = [];
  const { R, H } = spec;
  if (spec.kind === 'dome') {
    const n = 10;
    for (let j = 0; j < n; j++) {
      const phi = (j / (n - 1)) * (Math.PI / 2) * 0.96;
      pts.push(new Vector2(Math.max(0.0001, R * Math.sin(phi)), H * Math.cos(phi) ** 0.9));
    }
    // underside: back in toward the stem (gills or pores)
    const m = 4;
    const [yRim] = [pts[n - 1]!.y];
    for (let j = 1; j <= m; j++) {
      const t = j / m;
      pts.push(new Vector2(R * (1 - t * 0.78), yRim - 0.004 * t - H * 0.04 * Math.sin(t * Math.PI * 0.5)));
    }
  } else {
    // chanterelle: one trumpet, narrow at the foot, flared, with a hollowed top
    const outer: Array<[number, number]> = [
      [0.012, 0],
      [0.014, 0.03],
      [0.019, 0.06],
      [0.03, 0.082],
      [0.05, 0.1],
      [R * 0.95, H * 0.94],
      [R, H],
    ];
    const inner: Array<[number, number]> = [
      [R * 0.9, H * 1.025],
      [R * 0.62, H * 0.97],
      [R * 0.32, H * 0.915],
      [0.0001, H * 0.895],
    ];
    for (const [r, y] of [...outer, ...inner]) pts.push(new Vector2(r, y));
  }
  const geo = new LatheGeometry(pts, 28);
  wobble(geo, seed, spec.kind === 'funnel' ? 0.14 : 0.07);
  return geo;
}

function stemGeometry(spec: Spec, seed: number): BufferGeometry | null {
  const { h, r0, r1, bulb } = spec.stem;
  if (h === 0) return null;
  const pts = [
    new Vector2(0.0001, 0),
    new Vector2(bulb * 0.8, 0.002),
    new Vector2(bulb, h * 0.1),
    new Vector2(r0 * 1.15, h * 0.35),
    new Vector2(r1 * 1.1, h * 0.7),
    new Vector2(r1, h * 1.02),
    new Vector2(0.0001, h * 1.02),
  ];
  const geo = new LatheGeometry(pts, 14);
  wobble(geo, seed + 7, 0.05);
  return geo;
}

export interface Mushroom {
  species: Species;
  group: Group;
  item: Interactable;
  hole: Mesh;
  home: Vector3;
  yaw: number;
  tilt: number;
  scale: number;
  collected: boolean;
}

export const SPOTS: Array<[Species, number, number]> = [
  ['chanterelle', -1.85, -0.5],
  ['chanterelle', -2.02, -0.66],
  ['chanterelle', -1.68, -0.78],
  ['amanita', -2.45, -1.5],
  ['amanita', -2.28, -1.72],
  ['birch', -1.95, -2.4],
  ['bolete', 1.75, -0.35],
  ['bolete', 1.9, -0.55],
  ['amanita', 2.2, -0.95],
  ['chanterelle', 2.35, -0.2],
  ['birch', -0.7, -2.65],
  ['bolete', 0.75, -2.7],
  ['chanterelle', 0.1, -2.95],
  ['birch', 2.5, -1.25],
];

/**
 * The mushroom patch and its wicker basket. Grab a mushroom to pick it (it leaves a hole in the ground), let
 * go over the basket to collect it, or anywhere else to set it down. Everything resets when a scene starts.
 */
export class MushroomPatch {
  readonly group = new Group();
  readonly items: Interactable[] = [];
  private readonly mushrooms: Mushroom[] = [];
  private readonly basket = new Group();
  private basketItem: Interactable | null = null;
  private readonly basketCenter = new Vector3(-1.2, 0, -0.95);
  private basketTop = 0.2;
  private inBasket = 0;

  constructor(
    private readonly ctx: SceneCtx,
    private readonly tableTop: number,
    private readonly overTable: (p: Vector3) => boolean,
  ) {
    this.basket.position.copy(this.basketCenter);
    this.group.add(this.basket);
    this.buildBasket();
    // hit proxy so the basket can be pointed at even before its model arrives
    const hit = new Mesh(new CylinderGeometry(0.24, 0.24, 0.3, 12), new MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.15;
    this.basket.add(hit);
    this.basketItem = {
      id: 'basket',
      object: this.basket,
      kind: 'press',
      label: 'Basket: 0 mushrooms',
      accent: '#d9b27a',
      onPress: () => this.ctx.sound('basket'),
    };
    this.items.push(this.basketItem);

    SPOTS.forEach(([species, x, z], i) => this.plant(species, x, z, i));
  }

  /** A woven wicker basket: a flared bowl with a diagonal-weave texture, a thick rim and an arched handle. */
  private buildBasket(): void {
    const weave = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#6b4a24';
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const sh = h / rows;
      for (let r = 0; r < rows; r++) {
        for (let x = -16; x < w + 16; x += 32) {
          const ox = (r % 2) * 16;
          const g = ctx.createLinearGradient(0, r * sh, 0, (r + 1) * sh);
          g.addColorStop(0, '#d7b074');
          g.addColorStop(0.5, '#c39a5c');
          g.addColorStop(1, '#9a7240');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.roundRect(x + ox, r * sh + 1.5, 29, sh - 3, 5);
          ctx.fill();
        }
      }
      for (let x = 0; x < w; x += 16) {
        ctx.fillStyle = 'rgba(70,45,20,.35)';
        ctx.fillRect(x, 0, 2, h);
      }
    });
    weave.wrapS = weave.wrapT = RepeatWrapping;
    weave.repeat.set(5, 1);
    const wicker = new MeshStandardMaterial({ map: weave, bumpMap: weave, bumpScale: 2.2, roughness: 0.92, side: DoubleSide });
    const profile: Array<[number, number]> = [
      [0.0001, 0],
      [0.13, 0],
      [0.165, 0.02],
      [0.205, 0.1],
      [0.228, 0.19],
      [0.236, 0.245],
      [0.222, 0.25],
      [0.208, 0.2],
      [0.18, 0.1],
      [0.13, 0.035],
      [0.0001, 0.03],
    ];
    const bowl = new Mesh(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), 36), wicker);
    bowl.castShadow = true;
    bowl.receiveShadow = true;
    this.basket.add(bowl);
    const rim = new Mesh(new TorusGeometry(0.229, 0.013, 8, 36), new MeshStandardMaterial({ color: '#a97d45', roughness: 0.9 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.246;
    this.basket.add(rim);
    const handle = new Mesh(new TorusGeometry(0.23, 0.013, 8, 24, Math.PI), new MeshStandardMaterial({ color: '#a97d45', roughness: 0.9 }));
    handle.position.y = 0.246;
    handle.scale.y = 0.75;
    this.basket.add(handle);
    this.basketTop = 0.19;
  }

  private plant(species: Species, x: number, z: number, i: number): void {
    const spec = SPECS[species];
    const r = mulberry32(i * 97 + 5);
    const tex = texturesFor(species);
    const g = new Group();
    const cap = new Mesh(capGeometry(spec, i + 1), new MeshStandardMaterial({ map: tex.cap, roughness: spec.kind === 'funnel' ? 0.8 : 0.55, side: DoubleSide, emissive: '#000000', envMapIntensity: 0.5 }));
    cap.position.y = spec.stem.h;
    cap.castShadow = true;
    g.add(cap);
    const sg = stemGeometry(spec, i + 3);
    if (sg) {
      const stem = new Mesh(sg, new MeshStandardMaterial({ map: tex.stem, roughness: 0.8, emissive: '#000000' }));
      stem.castShadow = true;
      g.add(stem);
      if (spec.ring) {
        const skirt = new Mesh(
          new LatheGeometry([new Vector2(0.0145, 0), new Vector2(0.034, -0.016), new Vector2(0.038, -0.022), new Vector2(0.0145, -0.004)], 16),
          new MeshStandardMaterial({ color: '#f1ebdc', roughness: 0.8, side: DoubleSide, emissive: '#000000' }),
        );
        skirt.position.y = spec.stem.h * 0.8;
        g.add(skirt);
      }
    }
    const scale = (1.35 + r() * 0.5) * (species === 'chanterelle' ? 1.2 : 1);
    g.scale.setScalar(scale);
    g.rotation.y = r() * Math.PI * 2;
    g.rotation.z = (r() - 0.5) * 0.12;
    g.position.set(x, 0, z);
    // an easy-to-hit invisible cylinder around it (thin stems are hard to point at)
    const hit = new Mesh(new CylinderGeometry(0.075, 0.075, spec.stem.h + spec.H + 0.05, 8), new MeshBasicMaterial({ visible: false }));
    hit.position.y = (spec.stem.h + spec.H) / 2;
    g.add(hit);
    const hole = new Mesh(new CircleGeometry(0.06, 14), new MeshBasicMaterial({ color: '#241a10', transparent: true, opacity: 0.85 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, 0.004, z);
    hole.visible = false;
    this.group.add(hole, g);

    const mush: Mushroom = { species, group: g, item: null as unknown as Interactable, hole, home: new Vector3(x, 0, z), yaw: g.rotation.y, tilt: g.rotation.z, scale, collected: false };
    mush.item = {
      id: `mushroom-${i}`,
      object: g,
      kind: 'grab',
      label: spec.label,
      accent: '#ffd27a',
      enabled: () => !mush.collected,
      onGrab: () => {
        hole.visible = true;
        this.ctx.sound('pluck');
      },
      onRelease: (w) => this.released(mush, w),
    };
    this.mushrooms.push(mush);
    this.items.push(mush.item);
  }

  private released(m: Mushroom, world: Vector3): boolean {
    const parent = this.group;
    const local = parent.worldToLocal(world.clone());
    const dx = local.x - this.basketCenter.x;
    const dz = local.z - this.basketCenter.z;
    if (Math.hypot(dx, dz) < 0.36 && local.y < 1.0) {
      this.collect(m);
      return true;
    }
    // set down: on the table when over it, otherwise on the ground
    const onTable = this.overTable(local);
    const y = onTable ? this.tableTop : 0;
    this.ctx.interaction.glide(m.group, new Vector3(local.x, y, local.z), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), m.yaw));
    this.ctx.sound('drop');
    return true;
  }

  private collect(m: Mushroom): void {
    m.collected = true;
    const n = this.inBasket++;
    const a = n * 2.4;
    const ring = 0.05 + (n % 3) * 0.035;
    const slot = new Vector3(this.basketCenter.x + Math.cos(a) * ring, this.basketTop - 0.02 - Math.floor(n / 6) * -0.02, this.basketCenter.z + Math.sin(a) * ring);
    m.group.scale.multiplyScalar(0.6);
    m.group.rotation.set(0, a, 0.9 + (n % 3) * 0.25);
    this.ctx.interaction.glide(m.group, slot, m.group.quaternion);
    this.ctx.sound('basket');
    if (this.basketItem) this.basketItem.label = `Basket: ${this.inBasket} mushroom${this.inBasket === 1 ? '' : 's'}`;
    if (this.inBasket === this.mushrooms.length) this.ctx.sound('chime', 2);
  }

  reset(interaction: InteractionManager): void {
    this.inBasket = 0;
    if (this.basketItem) this.basketItem.label = 'Basket: 0 mushrooms';
    for (const m of this.mushrooms) {
      m.collected = false;
      m.hole.visible = false;
      m.group.scale.setScalar(m.scale);
      m.group.position.copy(m.home);
      m.group.rotation.set(0, m.yaw, m.tilt);
      interaction.resetItem(m.item);
      m.item.home = { position: m.home.clone(), quaternion: m.group.quaternion.clone() };
    }
  }
}
