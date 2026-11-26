import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type Material,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GuardianId } from '../../content/guardians';
import { mulberry32 } from '../util';
import { canvasTexture } from './procedural';

/**
 * The guardians as 3D characters, modelled from the brand illustrations: soft rounded bodies, a big mushroom
 * cap, simple black eyes with two highlights, and the thick black outline of the drawings (drawn with an
 * inverted hull). Shaded in three soft steps (cel shading) with a fine paper grain, like the artwork.
 *
 * Units: about 2.2 tall, feet on y = 0, facing +Z. Parts carry the names the animation looks for (Body, Head,
 * Cap, Eye Left/Right, Mouth, Arm Left/Right, Foot Left/Right).
 */

// ── materials ───────────────────────────────────────────────────────────────

let steps: DataTexture | null = null;
let grain: CanvasTexture | null = null;

function gradient(): DataTexture {
  if (!steps) {
    steps = new DataTexture(new Uint8Array([86, 150, 214, 255]), 4, 1, RedFormat);
    steps.minFilter = steps.magFilter = NearestFilter;
    steps.needsUpdate = true;
  }
  return steps;
}

/** A faint speckled paper grain (the drawings are printed on textured paper). */
function paper(): CanvasTexture {
  if (!grain) {
    const rnd = mulberry32(12);
    grain = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const dark = rnd() > 0.5;
        ctx.fillStyle = dark ? `rgba(0,0,0,${0.025 + rnd() * 0.04})` : `rgba(255,255,255,${0.5})`;
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.2, 1 + rnd() * 1.4);
      }
    });
    grain.wrapS = grain.wrapT = RepeatWrapping;
    grain.repeat.set(3, 3);
    grain.colorSpace = SRGBColorSpace;
  }
  return grain;
}

/** The forest is brightly lit: colours are drawn a little darker so they land on the artwork's values. */
const EXPOSURE = 0.7;

function toon(color: string, vertexColors = false): MeshToonMaterial {
  const m = new MeshToonMaterial({ color, gradientMap: gradient(), map: paper(), vertexColors });
  m.color.multiplyScalar(EXPOSURE);
  return m;
}

const BLACK = new MeshBasicMaterial({ color: '#0e0a0a', side: BackSide });

// ── geometry helpers ────────────────────────────────────────────────────────

const ellipsoid = (rx: number, ry: number, rz: number, seg = 40): BufferGeometry => new SphereGeometry(1, seg, Math.round(seg * 0.7)).scale(rx, ry, rz);

/** The black outline: the same shape pushed outwards along its normals, drawn from the inside. */
function hull(geo: BufferGeometry, t: number): Mesh {
  let g = geo.clone();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g.deleteAttribute('color');
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  return new Mesh(g, BLACK);
}

/** A shape and its outline, in one group. */
function inked(geo: BufferGeometry, mat: Material, t = 0.034): Group {
  const g = new Group();
  g.add(new Mesh(geo, mat), hull(geo, t));
  return g;
}

/** Darkens the parts of a mesh that face down (the underside of a cap sits in shade). */
function shadeUnderside(geo: BufferGeometry, light: string, dark: string): BufferGeometry {
  geo.computeVertexNormals();
  const n = geo.getAttribute('normal');
  const a = new Color(light);
  const b = new Color(dark);
  const c = new Color();
  const colors: number[] = [];
  for (let i = 0; i < n.count; i++) {
    const k = Math.min(1, Math.max(0, (0.15 - n.getY(i)) / 0.5));
    c.copy(a).lerp(b, k);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/** A point on the front of an ellipsoid head, for placing eyes and mouth on it. */
function onFace(rx: number, ry: number, rz: number, cy: number, x: number, y: number, lift = 0): Vector3 {
  const k = 1 - (x / rx) ** 2 - ((y - cy) / ry) ** 2;
  return new Vector3(x, y, rz * Math.sqrt(Math.max(0.02, k)) + lift);
}

function named<T extends Group>(g: T, name: string, x = 0, y = 0, z = 0): T {
  g.name = name;
  g.position.set(x, y, z);
  return g;
}

function eye(side: -1 | 1, r: number, p: Vector3): Group {
  const g = new Group();
  const ball = new Mesh(new SphereGeometry(r, 24, 18), new MeshStandardMaterial({ color: '#0b0909', roughness: 0.25, metalness: 0 }));
  ball.scale.z = 0.7;
  g.add(ball);
  const white = new MeshBasicMaterial({ color: '#fbf6e6' });
  const big = new Mesh(new SphereGeometry(r * 0.3, 12, 10), white);
  big.position.set(r * 0.32 * side * -1 + r * 0.1, r * 0.36, r * 0.62);
  const small = new Mesh(new SphereGeometry(r * 0.14, 10, 8), white);
  small.position.set(-r * 0.3, -r * 0.34, r * 0.6);
  g.add(big, small);
  return named(g, side < 0 ? 'Eye Left' : 'Eye Right', p.x, p.y, p.z);
}

/** The mouth: a smile, and an open mouth (scaled by the animation while the guardian talks). */
function mouth(p: Vector3, width: number, tilt = 0): Group {
  const g = new Group();
  const smile = new CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((u) => new Vector3(u * width, -Math.cos(u * 1.3) * width * 0.34 + width * 0.34, 0)));
  const arc = new Mesh(new TubeGeometry(smile, 14, 0.014, 6), new MeshBasicMaterial({ color: '#0e0a0a' }));
  arc.name = 'Smile';
  g.add(arc);
  const open = new Mesh(new SphereGeometry(width * 0.55, 16, 12), new MeshBasicMaterial({ color: '#2a0d12' }));
  open.name = 'MouthOpen';
  open.scale.set(1, 0.001, 0.4);
  open.position.y = -width * 0.12;
  g.add(open);
  g.rotation.z = tilt;
  return named(g, 'Mouth', p.x, p.y, p.z);
}

let blushTex: CanvasTexture | null = null;
function blush(p: Vector3, size: number, color = '#e88aa0'): Mesh {
  if (!blushTex) {
    blushTex = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
  }
  const m = new Mesh(new CircleGeometry(size, 20), new MeshBasicMaterial({ map: blushTex, color, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.copy(p);
  m.scale.y = 0.7;
  return m;
}

/** A glossy highlight: a thin curved streak laid on the surface of a cap. */
function streak(points: Vector3[], width = 0.022): Mesh {
  const m = new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 16, width, 5), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4 }));
  m.scale.z = 0.4;
  return m;
}

function arm(side: -1 | 1, mat: Material, len = 0.3, rz?: number, x = 0.43, y = 0.86): Group {
  const g = new Group();
  const geo = new CapsuleGeometry(0.1, len, 8, 16);
  geo.translate(0, -len / 2 - 0.02, 0);
  g.add(...inked(geo, mat, 0.028).children);
  g.rotation.z = rz ?? -side * 0.32;
  return named(g, side < 0 ? 'Arm Left' : 'Arm Right', side * x, y, 0);
}

function foot(side: -1 | 1, mat: Material): Group {
  const g = new Group();
  g.add(...inked(ellipsoid(0.15, 0.1, 0.2, 24), mat, 0.028).children);
  return named(g, side < 0 ? 'Foot Left' : 'Foot Right', side * 0.2, 0.09, 0.05);
}

/** Body: a short pear shape with two stumpy legs. */
function body(mat: Material): Group {
  const g = new Group();
  g.add(...inked(ellipsoid(0.4, 0.44, 0.32), mat, 0.036).children);
  return named(g, 'Body', 0, 0.58, 0);
}

function legs(mat: Material): Group {
  const g = new Group();
  for (const s of [-1, 1] as const) {
    const leg = inked(new CapsuleGeometry(0.135, 0.12, 8, 14), mat, 0.03);
    leg.position.set(s * 0.19, 0.2, 0.02);
    g.add(leg);
  }
  return g;
}

function head(rx: number, ry: number, rz: number, y: number, mat: Material): Group {
  const g = new Group();
  g.add(...inked(ellipsoid(rx, ry, rz), mat, 0.038).children);
  return named(g, 'Head', 0, y, 0);
}

// ── caps ────────────────────────────────────────────────────────────────────

function lathe(points: Array<[number, number]>, seg = 56, wobble?: (angle: number, r: number) => number): BufferGeometry {
  const g = new LatheGeometry(points.map(([r, y]) => new Vector2(Math.max(0.0001, r), y)), seg);
  if (wobble) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x, z);
      const k = wobble(Math.atan2(z, x), r);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Plaukstiņa's cap: a broad, thick, rounded slab (a button mushroom). */
function slabCap(R: number, H: number): BufferGeometry {
  const pts: Array<[number, number]> = [];
  pts.push([0.001, 0.02]);
  pts.push([R * 0.5, 0.0]);
  pts.push([R * 0.9, 0.01]);
  pts.push([R * 0.99, H * 0.08]);
  pts.push([R, H * 0.35]);
  pts.push([R * 0.99, H * 0.62]);
  pts.push([R * 0.96, H * 0.82]);
  pts.push([R * 0.88, H * 0.94]);
  pts.push([R * 0.7, H * 0.99]);
  pts.push([R * 0.4, H * 1.015]);
  pts.push([0.001, H * 1.02]);
  const geo = shadeUnderside(lathe(pts, 64, (a) => 1 + 0.012 * Math.sin(a * 3 + 1)), '#cb68a1', '#8c3b69');
  // the lower band of the slab's side is in shade, as drawn
  const p = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  const band = new Color('#9a4574');
  const c = new Color();
  for (let i = 0; i < p.count; i++) {
    const k = Math.min(1, Math.max(0, (H * 0.34 - p.getY(i)) / (H * 0.3))) * 0.85;
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(band, k);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  return geo;
}

/** Deguntiņš's cap: a tall cone, tip softly rounded. */
function coneCap(R: number, H: number): BufferGeometry {
  const pts: Array<[number, number]> = [[0.001, 0.03], [R * 0.45, 0.015], [R * 0.85, 0.0], [R, 0.02]];
  const n = 18;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const r = R * (1 - t) ** 0.78 * (1 - 0.1 * Math.sin(t * Math.PI));
    pts.push([Math.max(0.012, r), 0.02 + (H - 0.02) * t ** 0.92]);
  }
  pts.push([0.001, H + 0.015]);
  return shadeUnderside(lathe(pts, 64, (a) => 1 + 0.015 * Math.sin(a * 2 + 0.7)), '#46aed4', '#0a86a7');
}

let veinTex: CanvasTexture | null = null;
function veins(): CanvasTexture {
  if (!veinTex) {
    const rnd = mulberry32(21);
    veinTex = canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      // radial folds: dark lines running from the centre to the rim (u around, v along the profile)
      for (let i = 0; i < 22; i++) {
        const x = (i / 22) * w + (rnd() - 0.5) * 14;
        ctx.strokeStyle = `rgba(150,110,20,${0.2 + rnd() * 0.25})`;
        ctx.lineWidth = 2 + rnd() * 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 8, h * 0.3, x - 8, h * 0.6, x + (rnd() - 0.5) * 12, h);
        ctx.stroke();
      }
      for (let i = 0; i < 700; i++) {
        ctx.strokeStyle = `rgba(160,120,30,${0.05 + rnd() * 0.09})`;
        ctx.lineWidth = 1;
        const x = rnd() * w;
        const y = rnd() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18);
        ctx.stroke();
      }
    });
    veinTex.wrapS = RepeatWrapping;
  }
  return veinTex;
}

/** Skats's cap: a chanterelle funnel with wavy lobes and folded veins (tilted by the caller). */
function funnelCap(R: number, H: number): BufferGeometry {
  const pts: Array<[number, number]> = [
    [0.001, H * 0.16],
    [R * 0.18, H * 0.2],
    [R * 0.45, H * 0.36],
    [R * 0.75, H * 0.68],
    [R * 0.95, H * 0.94],
    [R, H],
    [R * 1.02, H * 0.98],
    [R * 0.99, H * 0.9],
    [R * 0.82, H * 0.58],
    [R * 0.58, H * 0.28],
    [R * 0.4, 0.02],
    [R * 0.3, -H * 0.2],
  ];
  const g = lathe(pts, 72, (a, r) => 1 + (r / R) * 0.075 * (Math.sin(a * 5 + 0.4) * 0.7 + Math.sin(a * 8) * 0.3));
  return g;
}

// ── the three guardians ─────────────────────────────────────────────────────

function plaukstina(): Group {
  const root = new Group();
  const skin = toon('#cd6a9d');
  root.add(legs(skin), body(skin));
  root.add(foot(-1, skin), foot(1, skin));
  const hy = 1.36;
  const H = { rx: 0.54, ry: 0.44, rz: 0.46 };
  root.add(head(H.rx, H.ry, H.rz, hy, skin));
  // cap: a broad slab
  const capMat = toon('#ffffff', true);
  const capGeo = slabCap(1.02, 0.84);
  const cap = new Group();
  cap.add(...inked(capGeo, capMat, 0.05).children);
  cap.add(streak([new Vector3(0.4, 0.5, 0.45), new Vector3(0.62, 0.55, 0.3), new Vector3(0.78, 0.5, 0.05)]));
  root.add(named(cap, 'Cap', 0, hy + 0.16, -0.02));
  // face
  const e = 0.085;
  root.add(eye(-1, e, onFace(H.rx, H.ry, H.rz, hy, -0.22, hy + 0.02, 0.01).add(new Vector3(0, 0, 0.0))));
  root.add(eye(1, e, onFace(H.rx, H.ry, H.rz, hy, 0.22, hy + 0.02, 0.01)));
  root.add(mouth(onFace(H.rx, H.ry, H.rz, hy, 0, hy - 0.2, 0.012), 0.12));
  root.add(blush(onFace(H.rx, H.ry, H.rz, hy, -0.36, hy - 0.1, 0.01), 0.1, '#b04a7c'), blush(onFace(H.rx, H.ry, H.rz, hy, 0.36, hy - 0.1, 0.01), 0.1, '#b04a7c'));
  root.add(arm(-1, skin, 0.3, -0.5, 0.42, 0.84), arm(1, skin, 0.3, 0.5, 0.42, 0.84));
  // the log she holds, with a twig and a leaf
  const log = new Group();
  const bark = toon('#6f4c22');
  const rnd = mulberry32(5);
  const barkTex = canvasTexture(64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = 'rgba(30,18,6,.7)';
      ctx.lineWidth = 2;
      const x = rnd() * w;
      ctx.beginPath();
      ctx.moveTo(x, rnd() * h * 0.4);
      ctx.lineTo(x + (rnd() - 0.5) * 8, h * (0.5 + rnd() * 0.5));
      ctx.stroke();
    }
  });
  bark.map = barkTex;
  log.add(...inked(new CylinderGeometry(0.15, 0.15, 0.4, 24), bark, 0.022).children);
  const endTex = canvasTexture(64, 64, (ctx, w) => {
    ctx.fillStyle = '#f0dc86';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#1a1208';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let t = 0; t < 4.5 * Math.PI; t += 0.1) {
      const r = 2 + t * 2.1;
      ctx.lineTo(w / 2 + Math.cos(t) * r, w / 2 + Math.sin(t) * r);
    }
    ctx.stroke();
  });
  const top = new Mesh(new CircleGeometry(0.15, 24), new MeshBasicMaterial({ map: endTex }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.201;
  log.add(top);
  const twig = new Mesh(new CylinderGeometry(0.022, 0.03, 0.2, 8), bark);
  twig.position.set(-0.17, 0.06, 0.02);
  twig.rotation.z = 0.9;
  log.add(twig);
  const leaf = new Mesh(new SphereGeometry(0.06, 12, 8), toon('#5cae4a'));
  leaf.scale.set(1.3, 0.28, 0.7);
  leaf.position.set(-0.27, 0.13, 0.02);
  leaf.rotation.z = 0.5;
  log.add(leaf);
  log.position.set(0.0, 0.56, 0.34);
  log.rotation.x = 0.3;
  log.scale.setScalar(1.3);
  root.add(log);
  return root;
}

function deguntins(): Group {
  const root = new Group();
  const skin = toon('#4fb7db');
  root.add(legs(skin), body(skin));
  root.add(foot(-1, skin), foot(1, skin));
  const hy = 1.34;
  const H = { rx: 0.5, ry: 0.44, rz: 0.43 };
  root.add(head(H.rx, H.ry, H.rz, hy, skin));
  const cap = new Group();
  cap.add(...inked(coneCap(0.98, 1.3), toon('#ffffff', true), 0.05).children);
  cap.add(streak([new Vector3(0.12, 1.0, 0.25), new Vector3(0.22, 0.7, 0.4), new Vector3(0.28, 0.4, 0.5)], 0.02));
  root.add(named(cap, 'Cap', 0, hy + 0.2, -0.02));
  const e = 0.078;
  root.add(eye(-1, e, onFace(H.rx, H.ry, H.rz, hy, -0.19, hy + 0.05, 0.005)));
  root.add(eye(1, e, onFace(H.rx, H.ry, H.rz, hy, 0.19, hy + 0.05, 0.005)));
  // nose: a short slanted wedge, as drawn
  const nose = new Group();
  nose.add(...inked(new CylinderGeometry(0.005, 0.045, 0.12, 10), toon('#3fa5ca'), 0.02).children);
  nose.position.copy(onFace(H.rx, H.ry, H.rz, hy, 0.02, hy - 0.1, 0.03));
  nose.rotation.set(0.9, 0, -0.55);
  root.add(nose);
  root.add(mouth(onFace(H.rx, H.ry, H.rz, hy, 0.16, hy - 0.2, 0.012), 0.085, -0.55));
  root.add(arm(-1, skin, 0.3, -0.35, 0.43, 0.8), arm(1, skin, 0.3, 0.38, 0.43, 0.8));
  // the flower at his cheek
  const flower = new Group();
  const petal = toon('#cb6b9d');
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const p = inked(ellipsoid(0.17, 0.2, 0.075, 24), petal, 0.024);
    p.position.set(Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0);
    p.rotation.z = a - Math.PI / 2;
    flower.add(p);
  }
  const centre = inked(new SphereGeometry(0.11, 20, 14), toon('#f5ea6b'), 0.022);
  centre.scale.z = 0.7;
  centre.position.z = 0.07;
  flower.add(centre);
  const stem = inked(new CylinderGeometry(0.022, 0.022, 0.42, 8), toon('#6dbb5d'), 0.016);
  stem.position.set(0.1, -0.34, -0.02);
  stem.rotation.z = 0.5;
  flower.add(stem);
  flower.position.set(-0.46, 1.02, 0.34);
  flower.rotation.set(-0.1, 0.18, 0);
  root.add(flower);
  return root;
}

function skats(): Group {
  const root = new Group();
  const skin = toon('#f6e45e');
  root.add(legs(skin), body(skin));
  root.add(foot(-1, skin), foot(1, skin));
  const hy = 1.3;
  const H = { rx: 0.5, ry: 0.5, rz: 0.43 };
  root.add(head(H.rx, H.ry, H.rz, hy, skin));
  // the chanterelle funnel on top, tilted
  const capMat = toon('#f3de55');
  capMat.map = veins();
  capMat.side = DoubleSide;
  const capGeo = funnelCap(1.12, 0.66);
  const cap = new Group();
  cap.add(new Mesh(capGeo, capMat), hull(capGeo, 0.045));
  const capNode = named(cap, 'Cap', 0.1, hy + 0.42, -0.08);
  capNode.rotation.set(-0.3, 0, 0.4);
  root.add(capNode);
  // big eyes, blush, a small smile
  const e = 0.115;
  root.add(eye(-1, e, onFace(H.rx, H.ry, H.rz, hy, -0.2, hy - 0.04, 0.0)));
  root.add(eye(1, e, onFace(H.rx, H.ry, H.rz, hy, 0.2, hy + 0.0, 0.0)));
  root.add(mouth(onFace(H.rx, H.ry, H.rz, hy, 0.04, hy - 0.27, 0.012), 0.075, 0));
  root.add(blush(onFace(H.rx, H.ry, H.rz, hy, -0.36, hy - 0.18, 0.01), 0.1, '#f0a070'), blush(onFace(H.rx, H.ry, H.rz, hy, 0.34, hy - 0.14, 0.01), 0.09, '#f0a070'));
  root.add(arm(-1, skin, 0.3, -0.7, 0.42, 0.82), arm(1, skin, 0.3, 0.5, 0.42, 0.82));
  // the magnifying glass he holds
  const mag = new Group();
  const gold = toon('#b98f38');
  const ringMesh = new Mesh(new TorusGeometry(0.17, 0.034, 14, 36), gold);
  const glass = new Mesh(new CircleGeometry(0.162, 28), new MeshStandardMaterial({ color: '#c5e6ec', transparent: true, opacity: 0.7, roughness: 0.08, side: DoubleSide }));
  glass.position.z = -0.004;
  const ringHull = new Mesh(new TorusGeometry(0.17, 0.034, 14, 36), BLACK);
  ringHull.scale.set(1.14, 1.14, 1.5);
  const handle = inked(new CylinderGeometry(0.03, 0.036, 0.32, 10), gold, 0.02);
  handle.position.set(0.17, -0.27, 0);
  handle.rotation.z = 0.62;
  const hi = new Mesh(new TorusGeometry(0.105, 0.012, 6, 14, 1.2), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  hi.rotation.z = 1.9;
  hi.position.z = 0.01;
  mag.add(ringHull, ringMesh, glass, handle, hi);
  mag.position.set(-0.72, 0.62, 0.3);
  mag.rotation.set(0.05, 0.25, 0.15);
  root.add(mag);
  return root;
}

/** The guardian as a 3D character, or null while its illustration has not been modelled yet. */
export function buildMascot3D(id: GuardianId): Group | null {
  switch (id) {
    case 'plaukstina':
      return named(plaukstina(), 'Plaukstiņa');
    case 'deguntins':
      return named(deguntins(), 'Deguntiņš');
    case 'skats':
      return named(skats(), 'Skats');
    default:
      return null;
  }
}
