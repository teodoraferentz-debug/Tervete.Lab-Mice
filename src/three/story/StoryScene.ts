import {
  AdditiveBlending,
  type Camera,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Texture,
  Vector2,
  Vector3,
} from 'three';
import { isReady } from '../../content/assets';
import type { CueKind, Guardian } from '../../content/guardians';
import { clamp01, easeInOut, easeOutBack, lerp, mulberry32 } from '../util';
import { loadArt } from './art';
import type { HotspotSpec, KeepsakeSpec, LayerSpec, StoryComposition } from './compositions';

/** Distance from the camera to the focus plane (where authored "screen units" are exact). */
export const STAGE_DISTANCE = 16;
const HALF_H = 4.5; // half the height of the 16 × 9 stage
/** The screen camera looks slightly below the stage centre, so the content sits higher and clear of the captions. */
export const LOOK_Y = -0.6;

type Cues = Partial<Record<CueKind, number>>;

interface LayerRT {
  spec: LayerSpec;
  mesh: Mesh;
  mat: MeshBasicMaterial;
  aspect: number;
  loaded: boolean;
  phase: number;
}

interface HotspotRT {
  spec: HotspotSpec;
  group: Group;
  update(p: number, t: number, ctx: UpdateCtx): void;
}

interface UpdateCtx {
  time: number;
  motion: number;
  fade: number;
  theme: Color;
}

const depthScale = (z: number): number => (STAGE_DISTANCE - z) / STAGE_DISTANCE;

function planeFor(pivot: LayerSpec['pivot']): PlaneGeometry {
  const g = new PlaneGeometry(1, 1);
  if (pivot === 'top') g.translate(0, -0.5, 0);
  if (pivot === 'bottom') g.translate(0, 0.5, 0);
  return g;
}

/** A ribbon (thin triangle strip) along a polyline, so lines glow at a visible width. */
function ribbon(lines: Vector2[][], width: number): { geo: BufferGeometry; count: number } {
  const pos: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const pts of lines) {
    for (let i = 0; i < pts.length; i++) {
      const prev = pts[Math.max(0, i - 1)]!;
      const next = pts[Math.min(pts.length - 1, i + 1)]!;
      const tx = next.x - prev.x;
      const ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = (-ty / len) * (width / 2);
      const ny = (tx / len) * (width / 2);
      const p = pts[i]!;
      pos.push(p.x + nx, p.y + ny, 0, p.x - nx, p.y - ny, 0);
      if (i < pts.length - 1) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    base += pts.length * 2;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.setIndex(idx);
  return { geo, count: idx.length };
}

/** Pattern line work, in a unit box centred on 0,0. */
function patternLines(shape: 'spiral' | 'veins' | 'leaf' | 'arcs'): Vector2[][] {
  const out: Vector2[][] = [];
  if (shape === 'spiral') {
    const n = 150;
    const turns = 1.9 * Math.PI * 2;
    const b = 0.2;
    const a = 0.5 / Math.exp(b * turns);
    for (const dir of [1, -1]) {
      const pts: Vector2[] = [];
      for (let i = 0; i < n; i++) {
        const th = (i / (n - 1)) * turns;
        const r = a * Math.exp(b * th);
        pts.push(new Vector2(Math.cos(dir * th) * r * 0.9, Math.sin(dir * th) * r));
      }
      out.push(pts);
    }
    return out;
  }
  if (shape === 'arcs') {
    for (let k = 0; k < 3; k++) {
      const pts: Vector2[] = [];
      for (let i = 0; i < 60; i++) {
        const t = i / 59;
        pts.push(new Vector2((k - 1) * 0.28 + Math.sin(t * 7 + k * 2) * 0.12 * t, t - 0.5));
      }
      out.push(pts);
    }
    return out;
  }
  // leaf / veins
  const mid: Vector2[] = [new Vector2(0, -0.5), new Vector2(0, 0.46)];
  out.push([new Vector2(0, -0.5), new Vector2(0, -0.2), new Vector2(0, 0.1), mid[1]!]);
  for (let i = 0; i < 6; i++) {
    const y = -0.28 + i * 0.12;
    for (const s of [1, -1]) {
      out.push([new Vector2(0, y), new Vector2(s * 0.12, y + 0.05), new Vector2(s * 0.24 * (1 - i * 0.1), y + 0.15)]);
    }
  }
  if (shape === 'leaf') {
    const outline: Vector2[] = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      outline.push(new Vector2(0.3 * Math.pow(Math.sin(Math.PI * t), 0.75) * (0.7 + 0.3 * Math.abs(Math.sin(t * Math.PI * 3.5))), 0.5 - t));
    }
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      outline.push(new Vector2(-0.3 * Math.pow(Math.sin(Math.PI * t), 0.75) * (0.7 + 0.3 * Math.abs(Math.sin(t * Math.PI * 3.5))), 0.5 - t));
    }
    out.unshift(outline);
  }
  return out;
}

/**
 * A cinematic story scene built from flat illustrated layers placed in depth, with subtle parallax,
 * gentle idle animation and additive AR highlights. It replaces the old 3D "set": no low-poly objects.
 */
export class StoryScene {
  readonly group = new Group();
  private readonly layers: LayerRT[] = [];
  private readonly byId = new Map<string, LayerRT>();
  private readonly hotspots: HotspotRT[] = [];
  private readonly extras = new Group();
  private readonly shafts: Mesh[] = [];
  private readonly motes: Points;
  private readonly moteSeed: Float32Array;
  private keepsake: {
    spec: KeepsakeSpec;
    mesh: Mesh;
    mat: MeshBasicMaterial;
    halo: Sprite;
    aspect: number;
    loaded: boolean;
  } | null = null;
  private readonly theme: Color;
  private fovHalfTan = Math.tan((31.4 * Math.PI) / 360);
  private screenAspect = 16 / 9;
  private popup = false;
  /** Inside a headset: fixed in the room, no billboard, a backdrop big enough to surround the player. */
  private vr = false;
  private readonly mascotKey: string;
  private disposed = false;

  constructor(
    readonly guardian: Guardian,
    private readonly comp: StoryComposition,
    private readonly glow: Texture,
    beam: Texture,
  ) {
    this.theme = new Color(guardian.themeColor);
    this.mascotKey = isReady(guardian.assetKeys.mascot) ? guardian.assetKeys.mascot : 'mascot-default';
    this.group.add(this.extras);

    comp.layers.forEach((spec, i) => this.addLayer(spec, i));
    this.addLayer({ id: 'grade', art: '@grade', x: 0, y: 0, z: 6, height: 9, cover: true, opacity: comp.gradeOpacity }, 900);
    this.addLayer({ id: 'vignette', art: 'vignette', x: 0, y: 0, z: 6.2, height: 9, cover: true }, 901);

    // Warm light through the trees
    [-4.4, 1.2, 5.6].forEach((x, i) => {
      const shaft = new Mesh(
        new PlaneGeometry(2.2, 12),
        new MeshBasicMaterial({ map: beam, color: '#ffe0a0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, depthTest: false }),
      );
      shaft.position.set(x * depthScale(-8), 1.2, -8);
      shaft.rotation.z = 0.35 - i * 0.08;
      shaft.renderOrder = -8 * 10;
      this.shafts.push(shaft);
      this.extras.add(shaft);
    });

    // Drifting motes of light
    const N = 80;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
    this.moteSeed = new Float32Array(N * 4);
    const rnd = mulberry32(guardian.name.length * 31 + 5);
    for (let i = 0; i < N; i++) {
      this.moteSeed[i * 4] = (rnd() - 0.5) * 17;
      this.moteSeed[i * 4 + 1] = rnd();
      this.moteSeed[i * 4 + 2] = -6 + rnd() * 8;
      this.moteSeed[i * 4 + 3] = rnd() * Math.PI * 2;
    }
    this.motes = new Points(
      geo,
      new PointsMaterial({ size: 0.16, map: glow, color: '#ffe3a0', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true }),
    );
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 4 * 10;
    this.extras.add(this.motes);

    if (comp.keepsake) this.addKeepsake(comp.keepsake);
    comp.hotspots.forEach((h) => this.addHotspot(h));
  }

  /** Loads all art; layers appear as their images arrive. Resolves when everything is ready. */
  async load(): Promise<void> {
    const jobs = this.layers.map(async (l) => {
      if (l.spec.art === '@grade') {
        l.mat.color.set(this.comp.grade);
        l.aspect = 1;
        l.loaded = true;
        return;
      }
      const key = l.spec.art === '@mascot' ? this.mascotKey : l.spec.art;
      try {
        const art = await loadArt(key);
        if (this.disposed) return;
        l.mat.map = art.texture;
        l.mat.needsUpdate = true;
        l.aspect = art.aspect;
        l.loaded = true;
      } catch (error) {
        console.warn(`[story] missing art "${key}" for ${this.guardian.id}`, error);
      }
    });
    if (this.keepsake) {
      const k = this.keepsake;
      jobs.push(
        loadArt(k.spec.art)
          .then((art) => {
            if (this.disposed) return;
            k.mat.map = art.texture;
            k.mat.needsUpdate = true;
            k.aspect = art.aspect;
            k.loaded = true;
          })
          .catch((e) => console.warn('[story] keepsake art', e)),
      );
    }
    await Promise.all(jobs);
  }

  /** Screen mode fills the viewport; popup mode (AR) floats the scene above the map, facing the camera. */
  setView(fovDeg: number, aspect: number, mode: 'screen' | 'popup' | 'vr'): void {
    this.fovHalfTan = Math.tan((fovDeg * Math.PI) / 360);
    this.screenAspect = aspect;
    this.popup = mode !== 'screen';
    this.vr = mode === 'vr';
  }

  placeScreen(): void {
    this.group.position.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.group.rotation.set(0, 0, 0);
  }

  /** In a headset the stage is a fixed "theatre" in front of the player. */
  placeVr(at: Vector3, scale: number, yaw = 0): void {
    this.group.position.copy(at);
    this.group.scale.setScalar(scale);
    this.group.rotation.set(0, yaw, 0);
  }

  placePopup(at: Vector3, scale = 0.15): void {
    this.group.position.copy(at);
    this.group.scale.setScalar(scale);
  }

  // ── per frame ───────────────────────────────────────────────────────────────

  update(t: number, cues: Cues, time: number, motion: number, duration: number, camera: Camera | null): void {
    const fade = clamp01(t / 0.9) * clamp01((duration - t) / 1.0);
    const ctx: UpdateCtx = { time, motion, fade, theme: this.theme };
    const cue = (c: CueKind | undefined): number => cues[c ?? 'enter'] ?? 0;

    if (this.popup && !this.vr && camera) {
      // AR pop-up: stay parallel to the camera image (a full billboard), so it reads from any angle,
      // including when the phone looks straight down at the map.
      const camQ = camera.getWorldQuaternion(new Quaternion());
      const parent = this.group.parent;
      if (parent) this.group.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert().multiply(camQ));
      else this.group.quaternion.copy(camQ);
    }

    for (const l of this.layers) this.updateLayer(l, t, cue, ctx);
    this.updateKeepsake(t, cue(this.comp.keepsake ? 'moment' : undefined), ctx);

    for (const h of this.hotspots) {
      const start = cue(h.spec.after ?? 'activity') + h.spec.at;
      h.update(clamp01((t - start) / 0.8), t - start, ctx);
    }

    this.shafts.forEach((s, i) => {
      (s.material as MeshBasicMaterial).opacity = (0.1 + (motion ? Math.sin(time * 0.35 + i * 1.9) * 0.035 : 0)) * fade;
    });

    const pos = this.motes.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const sx = this.moteSeed[i * 4]!;
      const rise = motion ? (time * 0.03 + this.moteSeed[i * 4 + 1]!) % 1 : this.moteSeed[i * 4 + 1]!;
      const z = this.moteSeed[i * 4 + 2]!;
      const s = depthScale(z);
      pos.setXYZ(i, (sx + (motion ? Math.sin(time * 0.5 + this.moteSeed[i * 4 + 3]!) * 0.25 : 0)) * s, (-5 + rise * 10) * s, z);
    }
    pos.needsUpdate = true;
    (this.motes.material as PointsMaterial).opacity = 0.75 * fade;
  }

  private visibleHalf(z: number): { halfH: number; halfW: number } {
    if (this.popup) {
      const s = depthScale(z);
      const k = this.vr ? 3.4 : 1.12; // a headset backdrop must surround the player, an AR pop-up is a card
      return { halfH: HALF_H * s * k, halfW: HALF_H * s * k * (16 / 9) };
    }
    const halfH = (STAGE_DISTANCE - z) * this.fovHalfTan;
    return { halfH, halfW: halfH * this.screenAspect };
  }

  private updateLayer(l: LayerRT, t: number, cue: (c: CueKind | undefined) => number, ctx: UpdateCtx): void {
    const { spec, mesh, mat } = l;
    if (!l.loaded) {
      mesh.visible = false;
      return;
    }
    const s = depthScale(spec.z);
    const since = t - cue(spec.appear) - (spec.delay ?? 0);
    const p = spec.appear === undefined && !spec.delay ? 1 : clamp01(since / 0.9);
    const ap = spec.id === 'grade' || spec.id === 'vignette' ? 1 : easeInOut(p);
    mesh.visible = ap > 0.001 && !(this.popup && (spec.id === 'grade' || spec.id === 'vignette'));
    mat.opacity = (spec.opacity ?? 1) * ap * (spec.id === 'grade' || spec.id === 'vignette' ? 1 : ctx.fade);
    if (spec.id === 'vignette') mat.opacity = ctx.fade * 0.95;

    let w: number;
    let h: number;
    if (spec.cover) {
      const { halfH, halfW } = this.visibleHalf(spec.z);
      h = Math.max(halfH * 2, (halfW * 2) / l.aspect) * 1.1;
      w = h * l.aspect;
      if (spec.id === 'grade' || spec.id === 'vignette') {
        w = halfW * 2.2;
        h = halfH * 2.2;
      }
      mesh.position.set(spec.x, spec.y + (this.popup ? 0 : LOOK_Y), spec.z);
    } else {
      h = spec.height * s;
      w = h * l.aspect;
      const rise = (1 - ap) * 0.35 * s;
      mesh.position.set(spec.x * s, spec.y * s - rise, spec.z);
    }
    mesh.scale.set(spec.flip ? -w : w, h, 1);

    const phase = l.phase;
    if (spec.anim === 'sway') mesh.rotation.z = (spec.pivot === 'bottom' ? 0.012 : 0.05) * Math.sin(ctx.time * 0.8 + phase) * ctx.motion;
    else if (spec.anim === 'breathe') {
      mesh.scale.y = h * (1 + 0.014 * Math.sin(ctx.time * 1.5 + phase) * ctx.motion);
      mesh.rotation.z = 0.006 * Math.sin(ctx.time * 0.7 + phase) * ctx.motion;
    } else if (spec.anim === 'float') mesh.position.y += Math.sin(ctx.time * 1.1 + phase) * 0.08 * ctx.motion;
  }

  private updateKeepsake(t: number, momentAt: number, ctx: UpdateCtx): void {
    const k = this.keepsake;
    if (!k || !k.loaded) return;
    const p = clamp01((t - momentAt - 0.2) / 2.0);
    k.mesh.visible = p > 0.001;
    k.halo.visible = k.mesh.visible;
    if (!k.mesh.visible) return;
    const e = ctx.motion ? easeInOut(p) : 1;
    const { from, to } = k.spec;
    const z = lerp(from.z, to.z, e);
    const s = depthScale(z);
    const h = lerp(from.height, to.height, e) * s * (ctx.motion ? 1 + 0.35 * Math.sin(Math.PI * e) * 0.3 : 1);
    const bob = ctx.motion ? Math.sin(ctx.time * 1.3) * 0.07 * e : 0;
    k.mesh.position.set(lerp(from.x, to.x, e) * s, (lerp(from.y, to.y, e) + bob) * s, z);
    k.mesh.scale.set(h * k.aspect, h, 1);
    k.mesh.rotation.z = ctx.motion ? Math.sin(ctx.time * 0.9) * 0.05 * e : 0;
    k.mat.opacity = easeOutBack(p) > 1 ? ctx.fade : clamp01(p * 2) * ctx.fade;
    k.halo.position.copy(k.mesh.position).setZ(z - 0.05);
    k.halo.scale.setScalar(h * 2.3);
    (k.halo.material as SpriteMaterial).opacity = e * (0.95 + (ctx.motion ? Math.sin(ctx.time * 2) * 0.12 : 0)) * ctx.fade;
  }

  // ── construction ────────────────────────────────────────────────────────────

  private addLayer(spec: LayerSpec, order: number): void {
    const mat = new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const mesh = new Mesh(planeFor(spec.pivot), mat);
    mesh.renderOrder = spec.z * 10 + order * 0.001;
    mesh.visible = false;
    this.group.add(mesh);
    const rt: LayerRT = { spec, mesh, mat, aspect: 1, loaded: false, phase: this.layers.length * 1.7 };
    this.layers.push(rt);
    this.byId.set(spec.id, rt);
  }

  private addKeepsake(spec: KeepsakeSpec): void {
    const mat = new MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0 });
    const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
    mesh.renderOrder = spec.to.z * 10 + 5;
    mesh.visible = false;
    const halo = new Sprite(new SpriteMaterial({ map: this.glow, color: this.theme, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, depthTest: false }));
    halo.renderOrder = spec.to.z * 10 + 4;
    halo.visible = false;
    this.group.add(halo, mesh);
    this.keepsake = { spec, mesh, mat, halo, aspect: 1, loaded: false };
  }

  private addHotspot(spec: HotspotSpec): void {
    const group = new Group();
    this.group.add(group);
    const theme = this.theme;
    const mkAdditive = (color: Color | string, opacity = 0) =>
      new MeshBasicMaterial({ color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, depthTest: false });
    const order = (z: number) => z * 10 + 6;

    if (spec.kind === 'outline') {
      const target = this.byId.get(spec.layer);
      const mat = new MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, depthTest: false });
      const mesh = new Mesh(planeFor(target?.spec.pivot), mat);
      mesh.renderOrder = order(target?.spec.z ?? 0);
      group.add(mesh);
      this.hotspots.push({
        spec,
        group,
        update: (p, _t, ctx) => {
          if (!target || !target.loaded) return;
          mat.map = target.mat.map;
          mesh.visible = p > 0.001 && target.mesh.visible;
          mesh.position.copy(target.mesh.position);
          mesh.rotation.copy(target.mesh.rotation);
          mesh.scale.set(target.mesh.scale.x * 1.05, target.mesh.scale.y * 1.05, 1);
          mat.color.copy(theme).lerp(new Color('#fff2c4'), 0.55);
          mat.opacity = p * (0.5 + (ctx.motion ? 0.28 * Math.sin(ctx.time * 3 + target.phase) : 0)) * ctx.fade;
        },
      });
      return;
    }

    if (spec.kind === 'lines') {
      const s = depthScale(spec.z);
      const lines = patternLines(spec.shape).map((pts) => pts.map((q) => new Vector2(q.x * spec.size * s, q.y * spec.size * s)));
      const core = ribbon(lines, 0.045 * s * Math.max(1, spec.size / 2));
      const soft = ribbon(lines, 0.16 * s * Math.max(1, spec.size / 2));
      const coreMat = mkAdditive('#fff2c4');
      const softMat = mkAdditive(theme);
      const m1 = new Mesh(core.geo, coreMat);
      const m2 = new Mesh(soft.geo, softMat);
      for (const m of [m1, m2]) {
        m.renderOrder = order(spec.z);
        m.position.set(spec.x * s, spec.y * s, spec.z);
        m.frustumCulled = false;
        group.add(m);
      }
      this.hotspots.push({
        spec,
        group,
        update: (p, t, ctx) => {
          const reveal = ctx.motion ? easeInOut(clamp01(t / 2.2)) : 1;
          const n = Math.floor((core.count * reveal) / 6) * 6;
          core.geo.setDrawRange(0, n);
          soft.geo.setDrawRange(0, Math.floor((soft.count * reveal) / 6) * 6);
          m1.visible = m2.visible = p > 0.001;
          const pulse = ctx.motion ? 0.85 + 0.15 * Math.sin(ctx.time * 3) : 1;
          coreMat.opacity = p * pulse * ctx.fade;
          softMat.opacity = p * 0.3 * pulse * ctx.fade;
        },
      });
      return;
    }

    if (spec.kind === 'halo') {
      const s = depthScale(spec.z);
      const sprite = new Sprite(new SpriteMaterial({ map: this.glow, color: theme, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, depthTest: false }));
      sprite.position.set(spec.x * s, spec.y * s, spec.z);
      sprite.scale.setScalar(spec.size * s);
      sprite.renderOrder = order(spec.z);
      group.add(sprite);
      this.hotspots.push({
        spec,
        group,
        update: (p, _t, ctx) => {
          sprite.visible = p > 0.001;
          const pulse = ctx.motion ? 0.8 + 0.2 * Math.sin(ctx.time * 2.2 + spec.x) : 1;
          (sprite.material as SpriteMaterial).opacity = p * 0.8 * pulse * ctx.fade;
          sprite.scale.setScalar(spec.size * s * (1 + 0.08 * (pulse - 1)));
        },
      });
      return;
    }

    if (spec.kind === 'ripple') {
      const s = depthScale(spec.z);
      const rings = Array.from({ length: 3 }, () => {
        const m = new Mesh(new RingGeometry(0.93, 1, 72), mkAdditive(theme));
        m.position.set(spec.x * s, spec.y * s, spec.z);
        m.renderOrder = order(spec.z);
        group.add(m);
        return m;
      });
      this.hotspots.push({
        spec,
        group,
        update: (p, t, ctx) => {
          rings.forEach((r, i) => {
            const phase = ctx.motion ? (t * 0.45 + i / 3) % 1 : 0.25 + i * 0.3;
            r.visible = p > 0.001;
            r.scale.setScalar(Math.max(0.0001, phase * spec.size * s * 0.5));
            (r.material as MeshBasicMaterial).opacity = p * (1 - phase) * 0.6 * ctx.fade;
          });
        },
      });
      return;
    }

    // swatches: colours picked out of the real objects, floating up like a palette
    const s = depthScale(spec.z);
    const dots = spec.colors.map((c) => {
      const disc = new Mesh(new CircleGeometry(0.17 * s, 24), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
      const rim = new Mesh(new RingGeometry(0.17 * s, 0.215 * s, 32), mkAdditive('#fff6dc'));
      disc.renderOrder = order(spec.z);
      rim.renderOrder = order(spec.z) + 0.1;
      group.add(disc, rim);
      return { disc, rim };
    });
    this.hotspots.push({
      spec,
      group,
      update: (p, t, ctx) => {
        dots.forEach(({ disc, rim }, i) => {
          const cycle = ctx.motion ? ((t - i * 0.35) / 3.2) % 1 : 0.45;
          const live = p > 0.001 && (ctx.motion ? t - i * 0.35 > 0 : true);
          disc.visible = rim.visible = live;
          const q = Math.max(0, cycle);
          const x = (spec.x + (i - (spec.colors.length - 1) / 2) * 0.55 + Math.sin(q * 5 + i) * 0.1) * s;
          const y = (spec.y + q * 1.5) * s;
          disc.position.set(x, y, spec.z);
          rim.position.copy(disc.position);
          const a = Math.sin(Math.PI * Math.min(1, q * 1.15)) * ctx.fade;
          (disc.material as MeshBasicMaterial).opacity = a;
          (rim.material as MeshBasicMaterial).opacity = a * 0.9;
        });
      },
    });
  }

  dispose(): void {
    this.disposed = true;
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
