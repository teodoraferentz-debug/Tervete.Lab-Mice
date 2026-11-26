import {
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { easeInOut, mulberry32 } from '../../util';
import { doughTexture, drawLeafImprint, leafGeometry, leafShape, leafTexture, type LeafKind } from '../procedural';
import { buildTable, coneGeometry, contactShadow, cord, extrudedShape, glowSprite, matte, mesh, metal, onTable, planks, ring, roundBoard, samaraGeometry, shadowTexture, spool } from '../propKit';
import type { Cues } from '../types';
import { BaseProps, tableSpot } from './base';
import { Gateway } from './dressing';
import type { Interactable } from '../interaction';

const AMBER = '#f0a43a';
/** Props are a little larger than life so they read from a screen and are easy to point at. */
const S = 1.45;
const LEAF_KINDS: Array<{ kind: LeafKind; base: string; tip: string; vein: string; name: string; info: string }> = [
  { kind: 'oak', base: '#9a6a1f', tip: '#c89430', vein: '#5c3a10', name: 'Oak leaf', info: 'lobed · gold-brown · branching veins' },
  { kind: 'birch', base: '#8aa02e', tip: '#cdc23c', vein: '#55661a', name: 'Birch leaf', info: 'oval · yellow-green · toothed edge' },
  { kind: 'maple', base: '#b83a24', tip: '#e2762a', vein: '#6e1d12', name: 'Maple leaf', info: 'pointed lobes · red-orange · fan of veins' },
  { kind: 'aspen', base: '#d8a418', tip: '#f0d060', vein: '#8a6a0c', name: 'Aspen leaf', info: 'round · golden · fine veins' },
  { kind: 'maple', base: '#4f7a2a', tip: '#8fb040', vein: '#2e4a14', name: 'Maple leaf', info: 'pointed lobes · green · fan of veins' },
];

interface Inspectable {
  object: Object3D;
  name: string;
  info: string;
}

/**
 * Skats · Hornet Garden: a forest-detective workshop. Leaves, cones and seeds on a wooden table, a magnifier
 * that reveals shape, colour and pattern, and a salted-dough ornament that takes the print of a leaf and,
 * at the story's moment, rises and glows amber. All of it is the physical activity from the brief; nothing
 * here is a new park activity.
 */
export class SkatsProps extends BaseProps {
  private readonly leafItems: Interactable[] = [];
  private readonly hintable: Interactable[] = [];
  private readonly touched = new Set<Interactable>();
  private readonly inspectables: Inspectable[] = [];
  private readonly gateway: Gateway;
  private readonly ornament = new Group();
  private readonly spinner = new Group();
  private readonly ornamentTex: CanvasTexture;
  private readonly ornamentCtx: CanvasRenderingContext2D;
  private readonly ornamentMat: MeshStandardMaterial;
  private readonly glow: Sprite;
  private readonly sparks: Sprite[] = [];
  private readonly board = new Group();
  private readonly ornamentBase = new Vector3();
  private ornamentItem!: Interactable;
  private magnifier!: Group;
  private magnifierHeld = false;
  private imprints = 0;
  private risen = 0;
  private pressing = false;
  private inspected: Inspectable | null = null;

  constructor(ctx: ConstructorParameters<typeof BaseProps>[0]) {
    super(ctx);
    const shadow = shadowTexture();
    this.group.add(buildTable(shadow));
    this.gateway = new Gateway(ctx.glow, 'IRŠU DĀRZS', 'Skats · Sight', '#e2aa18');
    this.group.add(this.gateway.group);

    // ── dough board with the ornament ──────────────────────────────────────────
    this.board.position.copy(onTable(-0.42, 0.04));
    this.board.scale.setScalar(1.25);
    this.board.add(roundBoard(0.175));
    this.ornamentTex = doughTexture();
    this.ornamentCtx = (this.ornamentTex.image as HTMLCanvasElement).getContext('2d')!;
    this.ornamentMat = new MeshStandardMaterial({ map: this.ornamentTex, roughness: 0.95, emissive: AMBER, emissiveIntensity: 0, color: '#ffffff' });
    const shape = leafShape('maple', 0.17);
    const geo = extrudedShape(shape, 0.012);
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getZ(i) - bb.min.z) / (bb.max.z - bb.min.z));
    }
    geo.translate(-(bb.min.x + bb.max.x) / 2, 0, -(bb.min.z + bb.max.z) / 2);
    const dough = mesh(geo, this.ornamentMat);
    this.spinner.add(dough);
    this.spinner.add(mesh(new TorusGeometry(0.011, 0.0016, 6, 14).rotateX(Math.PI / 2), matte('#c9a86a'), 0.0, 0.014, -0.085, false));
    this.ornament.add(this.spinner);
    this.ornament.position.set(0, 0.0215, 0);
    this.ornamentBase.copy(this.ornament.position);
    this.board.add(this.ornament);
    this.glow = glowSprite(ctx.glow, AMBER, 0.01, 0);
    this.glow.position.set(0, 0.03, 0);
    this.board.add(this.glow);
    for (let i = 0; i < 12; i++) {
      const s = glowSprite(ctx.glow, '#ffd27a', 0.02, 0);
      s.visible = false;
      this.sparks.push(s);
      this.board.add(s);
    }
    this.group.add(this.board);
    this.appear(this.board, 0.2);
    // Twine lying beside the board, and the ornament as a grab item once it has risen
    this.board.add(cord([new Vector3(0.2, 0.01, 0.0), new Vector3(0.26, 0.012, 0.05), new Vector3(0.32, 0.01, 0.0), new Vector3(0.36, 0.012, -0.05)], 0.0018, '#b99a62'));

    this.ornamentItem = this.add(
      { id: 'ornament', object: this.ornament, kind: 'grab', label: 'Salted-dough ornament', accent: AMBER, enabled: () => this.risen >= 1, onGrab: () => this.picked(this.ornamentItem), onRelease: () => false },
      this.board,
    );

    // ── leaves ─────────────────────────────────────────────────────────────────
    const rnd = mulberry32(77);
    const leafSpots: Array<[number, number]> = [
      [0.1, -0.13],
      [0.32, -0.02],
      [0.2, 0.15],
      [0.46, -0.16],
      [0.42, 0.14],
    ];
    LEAF_KINDS.forEach((spec, i) => {
      const holder = new Group();
      const leaf = new Mesh(
        leafGeometry(spec.kind, 0.1),
        new MeshStandardMaterial({ map: leafTexture(spec.base, spec.tip, spec.vein), roughness: 0.75, side: DoubleSide, emissive: '#000000' }),
      );
      leaf.castShadow = true;
      leaf.position.z = 0.05;
      holder.add(leaf);
      const [u, v] = leafSpots[i]!;
      holder.position.copy(onTable(u, v, 0.004));
      holder.rotation.y = rnd() * Math.PI * 2;
      holder.scale.setScalar(S);
      const item: Interactable = this.add({
        id: `leaf-${i}`,
        object: holder,
        kind: 'grab',
        label: spec.name,
        accent: AMBER,
        onGrab: () => this.picked(item),
        onRelease: (w) => this.leafDropped(item, holder, spec.kind, w),
      });
      this.appear(holder, 0.7 + i * 0.22);
      this.leafItems.push(item);
      this.hintable.push(item);
      this.inspectables.push({ object: holder, name: spec.name, info: spec.info });
    });

    // ── cones ──────────────────────────────────────────────────────────────────
    const coneMat = new MeshStandardMaterial({ color: '#7a5532', roughness: 0.92, emissive: '#000000' });
    [
      [-0.05, 0.2, 1],
      [0.58, 0.0, 2],
    ].forEach(([u, v, seed], i) => {
      const holder = new Group();
      const cone = mesh(coneGeometry(seed), coneMat.clone());
      cone.rotation.z = Math.PI / 2;
      cone.position.set(0.045, 0.027, 0);
      holder.add(cone);
      holder.position.copy(onTable(u!, v!, 0));
      holder.rotation.y = 0.6 + i * 1.9;
      holder.scale.setScalar(S);
      const item: Interactable = this.add({
        id: `cone-${i}`,
        object: holder,
        kind: 'grab',
        label: 'Pine cone',
        accent: AMBER,
        onGrab: () => this.picked(item),
        onRelease: (w) => this.settleOnTable(holder, w, 0),
      });
      this.appear(holder, 1.9 + i * 0.25);
      this.hintable.push(item);
      this.inspectables.push({ object: holder, name: 'Pine cone', info: 'spiral · brown · overlapping scales' });
    });

    // ── seeds in a small wooden dish ───────────────────────────────────────────
    const dish = new Group();
    const dishProfile = [new Vector2(0, 0), new Vector2(0.045, 0), new Vector2(0.065, 0.026), new Vector2(0.061, 0.028), new Vector2(0.04, 0.008), new Vector2(0, 0.007)];
    dish.add(mesh(new LatheGeometry(dishProfile, 18), planks('#e9d1b2', 0.3, 0.3)));
    const seedGeo = samaraGeometry();
    const seedMat = matte('#cdae72', 0.8, { side: DoubleSide });
    for (let i = 0; i < 9; i++) {
      const s = mesh(seedGeo, seedMat, (rnd() - 0.5) * 0.06, 0.012 + rnd() * 0.01, (rnd() - 0.5) * 0.06, false);
      s.rotation.y = rnd() * 6.28;
      s.rotation.z = (rnd() - 0.5) * 0.7;
      dish.add(s);
    }
    dish.position.copy(onTable(-0.1, -0.16, 0));
    dish.scale.setScalar(S);
    const dishItem: Interactable = this.add({
      id: 'seeds',
      object: dish,
      kind: 'grab',
      label: 'Seeds',
      accent: AMBER,
      onGrab: () => this.picked(dishItem),
      onRelease: (w) => this.settleOnTable(dish, w, 0),
    });
    this.appear(dish, 2.6);
    this.hintable.push(dishItem);
    this.inspectables.push({ object: dish, name: 'Maple seeds', info: 'winged · tan · they spin in pairs' });

    // ── spools of thread ───────────────────────────────────────────────────────
    ['#b8352a', '#d8c9a0', '#3f7a46'].forEach((c, i) => {
      const sp = spool(c);
      sp.position.copy(onTable(-0.7 + i * 0.1, -0.2 + (i % 2) * 0.09, 0));
      sp.scale.setScalar(S);
      const item: Interactable = this.add({
        id: `spool-${i}`,
        object: sp,
        kind: 'grab',
        label: 'Thread',
        accent: AMBER,
        onGrab: () => this.picked(item),
        onRelease: (w) => this.settleOnTable(sp, w, 0),
      });
      this.appear(sp, 3 + i * 0.2);
    });

    // ── magnifier ──────────────────────────────────────────────────────────────
    this.magnifier = new Group();
    this.magnifier.add(ring(0.046, 0.0045, metal('#b78a3c', 0.3)));
    this.magnifier.children[0]!.rotation.x = Math.PI / 2;
    const lens = new Mesh(
      new CircleGeometry(0.044, 28),
      new MeshStandardMaterial({ color: '#dff3ee', transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0.1, envMapIntensity: 1.6, side: DoubleSide, depthWrite: false }),
    );
    lens.rotation.x = -Math.PI / 2;
    this.magnifier.add(lens);
    const handle = mesh(new CylinderGeometry(0.0085, 0.011, 0.12, 10), planks('#d4b690', 0.2, 0.6), 0, 0, 0.1);
    handle.rotation.x = Math.PI / 2;
    this.magnifier.add(handle);
    this.magnifier.position.copy(onTable(0.68, 0.2, 0.012));
    this.magnifier.rotation.y = -0.5;
    this.magnifier.scale.setScalar(S);
    const magItem: Interactable = this.add({
      id: 'magnifier',
      object: this.magnifier,
      kind: 'grab',
      label: 'Magnifier: hold it over something',
      accent: AMBER,
      onGrab: () => {
        this.magnifierHeld = true;
        this.picked(magItem);
      },
      onRelease: (w) => {
        this.magnifierHeld = false;
        return this.settleOnTable(this.magnifier, w, 0.012);
      },
    });
    this.hintable.push(magItem);
    this.appear(this.magnifier, 3.6);
    this.group.add(contactShadowAt(shadow, onTable(0.68, 0.2, 0.0021), 0.22, 0.2));
  }

  /** The caption the scene should float next to something (the magnifier's reading, or null). */
  callout(): { text: string; at: Vector3 } | null {
    if (!this.inspected) return null;
    const at = this.inspected.object.getWorldPosition(new Vector3());
    return { text: `${this.inspected.name} — ${this.inspected.info}`, at: this.group.worldToLocal(at.add(new Vector3(0, 0.2, 0))) };
  }

  private picked(item: Interactable): void {
    this.touched.add(item);
    item.hint = false;
    this.ctx.sound('pick');
  }

  private settleOnTable(obj: Object3D, world: Vector3, rest: number): boolean {
    const spot = tableSpot(this.group, world, rest);
    if (!spot) return false;
    this.ctx.interaction.glide(obj, spot, obj.quaternion);
    this.ctx.sound('drop');
    return true;
  }

  /** A leaf let go over the ornament presses its print into the dough; anywhere else it rests on the table. */
  private leafDropped(item: Interactable, holder: Group, kind: LeafKind, world: Vector3): boolean {
    const target = this.ornament.getWorldPosition(new Vector3());
    const close = Math.hypot(world.x - target.x, world.z - target.z) < 0.14 && world.y - target.y < 0.3 && this.risen < 1;
    if (close && !this.pressing) {
      this.pressing = true;
      const local = this.group.worldToLocal(target.clone());
      this.ctx.interaction.glide(holder, new Vector3(local.x, local.y + 0.012, local.z), holder.quaternion, () => {
        this.imprint(kind);
        this.ctx.sound('tick');
        const home = item.home!;
        this.ctx.interaction.glide(holder, home.position, home.quaternion, () => {
          this.pressing = false;
        });
      });
      return true;
    }
    return this.settleOnTable(holder, world, 0.004);
  }

  private imprint(kind: LeafKind): void {
    const n = this.imprints++;
    const c = this.ornamentCtx;
    const spots: Array<[number, number, number]> = [
      [0.5, 0.5, 0.5],
      [0.34, 0.58, 0.34],
      [0.66, 0.42, 0.34],
    ];
    const [x, y, size] = spots[n % spots.length]!;
    drawLeafImprint(c, kind, x * 256, y * 256 + 60 * size, size * 256 * 0.9, (n * 1.3) % 6.28, 'rgba(112,78,40,1)');
    this.ornamentTex.needsUpdate = true;
  }

  protected tick(t: number, cues: Cues, time: number, motion: number): void {
    this.gateway.update(time, motion);

    // "Look closer": once the props are out, the finds pulse until picked up
    const activity = cues.activity ?? Infinity;
    for (const item of this.hintable) {
      if (this.touched.has(item) || item.id === 'magnifier') continue;
      item.hint = t >= activity + 2.5 && this.isShown(item.object);
    }
    this.leafItems.forEach((item) => {
      if (this.touched.has(item)) item.hint = false;
    });
    const magItem = this.items.find((i) => i.id === 'magnifier')!;
    if (!this.touched.has(magItem)) magItem.hint = t >= activity + 4.2 && this.isShown(this.magnifier);

    // The magnifier reads whatever it is held over
    this.inspected = null;
    if (this.magnifierHeld) {
      const lens = this.magnifier.getWorldPosition(new Vector3());
      let best = 0.17;
      for (const ins of this.inspectables) {
        if (!ins.object.visible) continue;
        const p = ins.object.getWorldPosition(new Vector3());
        const d = Math.hypot(p.x - lens.x, p.z - lens.z);
        if (d < best && lens.y - p.y < 0.45) {
          best = d;
          this.inspected = ins;
        }
      }
    }
    for (const ins of this.inspectables) {
      const item = this.items.find((i) => i.object === ins.object);
      if (item && this.touched.has(item)) item.hint = false;
    }
    if (this.inspected) {
      const item = this.items.find((i) => i.object === this.inspected!.object);
      if (item) item.hint = true;
    }

    // The moment: the ornament rises and glows amber, showing its leaf print
    const moment = cues.moment ?? Infinity;
    if (t >= moment && this.imprints === 0) this.imprint('maple');
    const k = motion ? Math.min(1, Math.max(0, (t - moment) / 2.2)) : t >= moment ? 1 : 0;
    if (k !== this.risen) {
      const was = this.risen;
      this.risen = k;
      if (was < 1 && k > 0 && was === 0) this.ctx.sound('chime', 0);
      if (k >= 1 && this.ornamentItem.home?.position.y !== this.ornamentBase.y + 0.22) {
        this.ornamentItem.home = { position: new Vector3(0, this.ornamentBase.y + 0.22, 0), quaternion: new Quaternion() };
      }
    }
    const e = easeInOut(this.risen);
    // While rising the ornament is moved here; once risen it belongs to the pointer (held, or gliding back).
    if (this.risen < 1) this.ornament.position.set(0, this.ornamentBase.y + 0.22 * e, 0);
    this.spinner.rotation.y = this.risen > 0 ? time * 0.6 * motion : 0;
    this.ornamentMat.emissiveIntensity = e * (0.55 + Math.sin(time * 2.4) * 0.12 * motion);
    const gs = e * (0.42 + Math.sin(time * 2.4) * 0.04 * motion);
    this.glow.scale.setScalar(Math.max(0.01, gs));
    this.glow.position.copy(this.ornament.position);
    (this.glow.material as SpriteMaterial).opacity = e * 0.85;
    this.sparks.forEach((s, i) => {
      s.visible = this.risen > 0.05;
      const a = time * (0.5 + (i % 3) * 0.15) + i * 0.9;
      const r = 0.1 + (i % 4) * 0.025;
      s.position.set(this.ornament.position.x + Math.cos(a) * r, this.ornament.position.y + Math.sin(time * 1.2 + i) * 0.06 * motion, this.ornament.position.z + Math.sin(a) * r);
      s.scale.setScalar(0.018 + 0.01 * Math.sin(time * 4 + i));
      (s.material as SpriteMaterial).opacity = e * 0.9;
    });
  }

  protected onReset(): void {
    this.touched.clear();
    this.imprints = 0;
    this.risen = 0;
    this.pressing = false;
    this.magnifierHeld = false;
    this.inspected = null;
    this.ornamentItem.home = { position: this.ornamentBase.clone(), quaternion: new Quaternion() };
    this.ornament.position.copy(this.ornamentBase);
    this.ornament.quaternion.identity();
    this.spinner.rotation.set(0, 0, 0);
    const c = this.ornamentCtx;
    c.clearRect(0, 0, 256, 256);
    const fresh = doughTexture();
    c.drawImage(fresh.image as CanvasImageSource, 0, 0);
    fresh.dispose();
    this.ornamentTex.needsUpdate = true;
    this.ornamentMat.emissiveIntensity = 0;
  }
}

function contactShadowAt(tex: import('three').Texture, at: Vector3, w: number, d: number): Mesh {
  const s = contactShadow(tex, w, d, 0.4);
  s.position.copy(at);
  return s;
}
