import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../util';
import { loadMap } from './loaders';
import { canvasTexture } from './procedural';

/** Where the table stands, in front of the player (metres, player at the origin facing -Z). */
export const TABLE = { x: 0, z: -1.15, top: 0.86, width: 1.7, depth: 0.76 };

/** Local position on the tabletop (u = left/right, v = near/far) as a scene position. */
export function onTable(u: number, v: number, lift = 0): Vector3 {
  return new Vector3(TABLE.x + u, TABLE.top + lift, TABLE.z + v);
}

// ── materials ────────────────────────────────────────────────────────────────

/** Weathered planks (CC0 Poly Haven "weathered brown planks"), shared by the table, signs and posts. */
export function planks(tint = '#ffffff', repeatX = 1.6, repeatY = 1): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: loadMap('planks-diff', { srgb: true, repeatX, repeatY }),
    normalMap: loadMap('planks-nor', { repeatX, repeatY }),
    roughnessMap: loadMap('planks-rough', { repeatX, repeatY }),
    roughness: 1,
    envMapIntensity: 0.6,
    color: tint,
  });
}

export function matte(color: string, roughness = 0.85, extra: Partial<MeshStandardMaterial> = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.5, ...extra });
}

export function metal(color: string, roughness = 0.35): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness: 0.85, envMapIntensity: 1 });
}

export function emissiveMat(color: string, intensity = 1.2): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, emissive: new Color(color), emissiveIntensity: intensity, roughness: 0.6 });
}

// ── generic helpers ──────────────────────────────────────────────────────────

export function mesh(geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0, shadow = true): Mesh {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

export function glowSprite(tex: Texture, color: string, size: number, opacity = 0.9): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
}

/** A soft dark spot on the surface under an object: cheap contact shadow, no shadow map needed. */
export function contactShadow(tex: Texture, w: number, d: number, opacity = 0.45): Mesh {
  const m = new Mesh(new PlaneGeometry(w, d), new MeshBasicMaterial({ map: tex, color: '#000000', transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  m.renderOrder = 2;
  return m;
}

/** A thin cord (thread, string, twine) through points. */
export function cord(points: Vector3[], radius: number, color: string, segments = 24): Mesh {
  const curve = new CatmullRomCurve3(points);
  return mesh(new TubeGeometry(curve, segments, radius, 5, false), matte(color, 0.9), 0, 0, 0, false);
}

/** Object whose origin is at its bottom centre, ready to stand on a surface. */
export function stand(obj: Object3D, x: number, y: number, z: number): Object3D {
  obj.position.set(x, y, z);
  return obj;
}

// ── the workshop table ───────────────────────────────────────────────────────

/** A sturdy wooden table of boards (real PBR planks), with a linen runner for the props to sit on. */
export function buildTable(shadowTex: Texture): Group {
  const g = new Group();
  g.position.set(TABLE.x, 0, TABLE.z);
  const { width: w, depth: d, top } = TABLE;
  const board = planks('#e8d4bc', 1.6, 0.5);
  const topMesh = mesh(new RoundedBoxGeometry(w, 0.055, d, 3, 0.012), board, 0, top - 0.0275, 0);
  g.add(topMesh);
  const leg = new BoxGeometry(0.075, top - 0.055, 0.075);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(mesh(leg, planks('#d9c3a8', 0.4, 1.2), sx * (w / 2 - 0.1), (top - 0.055) / 2, sz * (d / 2 - 0.1)));
    }
  }
  g.add(mesh(new BoxGeometry(w - 0.2, 0.07, 0.04), planks('#cfb89c', 1.2, 0.2), 0, top - 0.1, d / 2 - 0.1));
  g.add(mesh(new BoxGeometry(w - 0.2, 0.07, 0.04), planks('#cfb89c', 1.2, 0.2), 0, top - 0.1, -d / 2 + 0.1));
  // Linen runner: a long cloth strip with a soft weave, slightly narrower than the table
  const linen = canvasTexture(256, 256, (ctx, cw, ch) => {
    ctx.fillStyle = '#cfc3a4';
    ctx.fillRect(0, 0, cw, ch);
    const rnd = mulberry32(11);
    for (let i = 0; i < ch; i += 3) {
      ctx.fillStyle = `rgba(140,120,80,${0.05 + rnd() * 0.07})`;
      ctx.fillRect(0, i, cw, 1);
    }
    for (let i = 0; i < cw; i += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`;
      ctx.fillRect(i, 0, 1, ch);
    }
    ctx.strokeStyle = '#2f6b45';
    ctx.lineWidth = 9;
    ctx.strokeRect(12, 12, cw - 24, ch - 24);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, cw - 52, ch - 52);
  });
  const runner = new Mesh(new PlaneGeometry(w - 0.18, d - 0.3), new MeshStandardMaterial({ map: linen, roughness: 1, side: DoubleSide }));
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, top + 0.0015, 0);
  runner.receiveShadow = true;
  g.add(runner);
  g.add(contactShadow(shadowTex, w * 1.5, d * 1.6, 0.5));
  return g;
}

// ── small natural objects ────────────────────────────────────────────────────

/** A spruce / pine cone: overlapping scales on a spindle. ~700 triangles. Height 0.085 m, tip toward +Y. */
export function coneGeometry(seed = 1): BufferGeometry {
  const rnd = mulberry32(seed);
  const parts: BufferGeometry[] = [];
  const rings = 9;
  for (let k = 0; k < rings; k++) {
    const t = k / (rings - 1);
    const y = 0.006 + t * 0.075;
    const r = 0.012 + Math.sin(Math.min(1, t * 1.1 + 0.15) * Math.PI) * 0.026 * (1 - t * 0.35);
    const n = 8 + Math.round((1 - Math.abs(t - 0.35)) * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.45 + rnd() * 0.12;
      const scale = new BoxGeometry(0.019 - t * 0.006, 0.006, 0.02 - t * 0.005, 1, 1, 1);
      scale.translate(0, 0, 0.011 - t * 0.003);
      scale.rotateX(0.55 + t * 0.35);
      scale.translate(0, 0, r - 0.006);
      scale.rotateY(a);
      scale.translate(0, y, 0);
      parts.push(scale);
    }
  }
  parts.push(new CylinderGeometry(0.008, 0.012, 0.09, 6).translate(0, 0.045, 0));
  return mergeGeometries(parts);
}

/** A maple seed (samara): a rounded seed and a thin veined wing. */
export function samaraGeometry(): BufferGeometry {
  const seed = new SphereGeometry(0.0055, 8, 6).scale(1, 0.6, 1);
  const wing = new PlaneGeometry(0.014, 0.032, 1, 3);
  const pos = wing.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    pos.setX(i, x * (1 - Math.abs(y) / 0.03) * 1.2 + y * 0.18);
  }
  wing.rotateX(-Math.PI / 2);
  wing.translate(0.004, 0.0015, -0.022);
  return mergeGeometries([seed, wing]);
}

/** A wooden thread spool with thread wound on it. Origin at the base. */
export function spool(threadColor: string): Group {
  const g = new Group();
  const profile = [
    new Vector2(0, 0),
    new Vector2(0.024, 0),
    new Vector2(0.024, 0.004),
    new Vector2(0.01, 0.006),
    new Vector2(0.01, 0.034),
    new Vector2(0.024, 0.036),
    new Vector2(0.024, 0.04),
    new Vector2(0, 0.04),
  ];
  g.add(mesh(new LatheGeometry(profile, 14), planks('#f1dcc0', 0.3, 0.3)));
  const wound = mesh(new CylinderGeometry(0.0185, 0.0185, 0.028, 16), matte(threadColor, 0.95), 0, 0.02, 0);
  g.add(wound);
  return g;
}

/** A ring-shaped bead / torus. */
export function ring(r: number, tube: number, mat: Material): Mesh {
  return mesh(new TorusGeometry(r, tube, 8, 24), mat);
}

/** Round board (cutting / dough board). */
export function roundBoard(radius: number, thickness = 0.018): Mesh {
  return mesh(new CylinderGeometry(radius, radius * 0.985, thickness, 28), planks('#efd9bb', 0.4, 0.4), 0, thickness / 2, 0);
}

/** Extruded leaf-like ornament silhouette (for the salted-dough ornament). */
export function extrudedShape(shape: import('three').Shape, depth: number): BufferGeometry {
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: depth * 0.45, bevelSegments: 2, curveSegments: 10 });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// ── hover label ──────────────────────────────────────────────────────────────

/** A small floating caption that appears next to the object being pointed at. */
export class HoverLabel {
  readonly sprite: Sprite;
  private readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private text = '';
  private accent = '';

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 112;
    this.ctx = canvas.getContext('2d')!;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.sprite = new Sprite(new SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.sprite.renderOrder = 1002;
    this.sprite.scale.set(0.3, 0.0656, 1);
    this.sprite.visible = false;
  }

  show(text: string, accent: string, at: Vector3): void {
    if (text !== this.text || accent !== this.accent) {
      this.text = text;
      this.accent = accent;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, 512, 112);
      const r = 36;
      ctx.beginPath();
      ctx.moveTo(r, 5);
      ctx.arcTo(507, 5, 507, 107, r);
      ctx.arcTo(507, 107, 5, 107, r);
      ctx.arcTo(5, 107, 5, 5, r);
      ctx.arcTo(5, 5, 507, 5, r);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,26,17,.88)';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = '#f9f2de';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 46px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(text, 256, 58, 470);
      this.texture.needsUpdate = true;
    }
    this.sprite.position.copy(at);
    this.sprite.visible = true;
  }

  hide(): void {
    this.sprite.visible = false;
  }

  dispose(): void {
    this.texture.dispose();
    (this.sprite.material as SpriteMaterial).dispose();
  }
}

/** Rotates `obj` so its local +Y points along `dir`. */
export function alignUp(obj: Object3D, dir: Vector3): void {
  obj.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
}

/** A flat circular dust/shadow texture (radial falloff) for contact shadows. */
export function shadowTexture(): CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export const UP = new Vector3(0, 1, 0);
export const IDENT_Q = new Quaternion();
