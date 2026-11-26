import { CanvasTexture, LinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { getAsset } from '../../content/assets';
import { mulberry32 } from '../util';

/**
 * Art library for the story scenes: illustrated props, set pieces and papercut forest layers, drawn as
 * vector illustrations (SVG) or on canvas, plus the photographic backdrops. Everything is a flat,
 * layered illustration (never a 3D model), so the scenes read as a storybook with real depth.
 *
 * INTERIM ART: these illustrations stand in until commissioned art arrives. To replace one, register a
 * `ready` image under the same key in content/assets.ts; `loadArt` prefers it over the drawn version.
 */

export interface Art {
  texture: Texture;
  /** width / height */
  aspect: number;
}

type Maker = () => Promise<Art>;

// ───────────────────────────── helpers ─────────────────────────────

const INK = '#3a2616';
const WOOD_D = '#6b4426';
const WOOD_M = '#9a6a3c';
const WOOD_L = '#c79a62';
const DOUGH = '#ecd7a8';
const DOUGH_D = '#c9a766';

const svg = (w: number, h: number, body: string, defs = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${body}</svg>`;

const lin = (id: string, a: string, b: string, vertical = true): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const rad = (id: string, inner: string, outer: string, outerOpacity = 1): string =>
  `<radialGradient id="${id}"><stop offset="0" stop-color="${inner}"/><stop offset="1" stop-color="${outer}" stop-opacity="${outerOpacity}"/></radialGradient>`;

/** Smooth closed/open path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: Array<[number, number]>, closed = true): string {
  const n = pts.length;
  const p = (i: number) => pts[(i + n) % n]!;
  let d = `M${p(0)[0].toFixed(1)} ${p(0)[1].toFixed(1)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = closed ? p(i - 1) : pts[Math.max(0, i - 1)]!;
    const p1 = p(i);
    const p2 = closed ? p(i + 1) : pts[i + 1]!;
    const p3 = closed ? p(i + 2) : pts[Math.min(n - 1, i + 2)]!;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + (closed ? 'Z' : '');
}

async function rasterize(markup: string, w: number, h: number, scale = 1): Promise<Art> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return fromCanvas(canvas);
}

function fromCanvas(canvas: HTMLCanvasElement): Art {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 4;
  return { texture, aspect: canvas.width / canvas.height };
}

async function loadPhoto(url: string): Promise<Art> {
  const texture = await new TextureLoader().loadAsync(url);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const img = texture.image as { width: number; height: number };
  return { texture, aspect: img.width / img.height };
}

// ───────────────────────────── natural objects ─────────────────────────────

type LeafKind = 'oak' | 'maple' | 'birch';

/** Outline of a leaf of the given kind, centred on (0,0), about 100 units tall, stem at the bottom. */
function leafOutline(kind: LeafKind): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  if (kind === 'maple') {
    const tips = 5;
    for (let i = 0; i < tips * 2; i++) {
      const a = -Math.PI / 2 + (i / (tips * 2)) * Math.PI * 2 + Math.PI / tips;
      const r = i % 2 === 0 ? 52 : 24;
      const lobeScale = i % 2 === 0 ? (Math.abs(Math.cos(a + Math.PI / 2)) > 0.6 ? 0.78 : 1) : 1;
      pts.push([Math.cos(a) * r * lobeScale, Math.sin(a) * r * lobeScale - 6]);
    }
    return pts;
  }
  const N = 18;
  const side = (s: number) => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const base = Math.pow(Math.sin(Math.PI * t), 0.75);
      const lobes = kind === 'oak' ? 0.64 + 0.36 * Math.abs(Math.sin(t * Math.PI * 3.5)) : 1 + (i % 2 ? 0.05 : -0.05);
      out.push([s * 32 * base * lobes * (kind === 'birch' ? 0.95 : 1), 50 - t * 100]);
    }
    return out;
  };
  const right = side(1);
  const left = side(-1).reverse();
  return [...right, ...left.slice(1, -1)];
}

let leafSeq = 0;
function leafSvg(kind: LeafKind, base: string, dark: string, light: string, vein: string): string {
  const gid = `lg-${kind}-${leafSeq++}`;
  const outline = leafOutline(kind);
  const path = kind === 'maple' ? `M${outline.map((p) => p.join(' ')).join('L')}Z` : smooth(outline);
  const veins: string[] = [`<path d="M0 48 L0 -42" stroke="${vein}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`];
  for (let i = 0; i < 6; i++) {
    const y = 34 - i * 14;
    veins.push(`<path d="M0 ${y} Q${14 + i} ${y - 8} ${24 - i * 2} ${y - 18}" stroke="${vein}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`);
    veins.push(`<path d="M0 ${y} Q${-14 - i} ${y - 8} ${-24 + i * 2} ${y - 18}" stroke="${vein}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`);
  }
  return `
    <g>
      <path d="${path}" fill="url(#${gid})" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="${path}" fill="none" stroke="${light}" stroke-opacity=".55" stroke-width="1.4" transform="scale(.94)"/>
      ${veins.join('')}
      <path d="M0 48 q-2 8 -6 12" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <defs>${lin(gid, light, dark)}</defs>
    <!-- ${base} -->`;
}

function leavesCluster(): string {
  const items: Array<[LeafKind, number, number, number, number, string, string, string]> = [
    ['oak', 150, 120, 1.15, -28, '#c4452f', '#8f2d1e', '#e7894a'],
    ['maple', 330, 100, 1.0, 22, '#e2aa18', '#b57a0c', '#f4d36a'],
    ['birch', 500, 125, 0.95, -62, '#d6b232', '#9b7f16', '#f1e08a'],
    ['oak', 640, 105, 0.8, 38, '#7f9a3a', '#4d6a22', '#b5c967'],
    ['maple', 240, 235, 0.75, 70, '#d9732a', '#a24a12', '#f0a45c'],
    ['birch', 420, 250, 0.8, 18, '#a9b83a', '#6c7b1a', '#d4dc7a'],
  ];
  const body = items
    .map(([kind, x, y, s, rot, base, dark, light]) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s * 1.35})">${leafSvg(kind, base, dark, light, 'rgba(58,38,22,.55)')}</g>`)
    .join('');
  return svg(760, 340, body);
}

function leafSingle(kind: LeafKind, base: string, dark: string, light: string): string {
  return svg(160, 170, `<g transform="translate(80 85) scale(1.4)">${leafSvg(kind, base, dark, light, 'rgba(58,38,22,.55)')}</g>`);
}

function pineCone(): string {
  const rows = 9;
  let scales = '';
  const rnd = mulberry32(5);
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const y = 205 - r * 21;
    const half = 52 * Math.sin(Math.PI * (0.12 + 0.82 * (1 - t) * 0.85 + 0.05)) + 6;
    const count = Math.max(2, Math.round(half / 12));
    for (let c = -count; c <= count; c++) {
      const x = 80 + c * (half / count) * 0.92 + (r % 2 ? 6 : 0);
      const w = 25 - t * 8;
      const hgt = 26 - t * 6;
      const shade = 0.82 + rnd() * 0.3;
      const fill = `rgb(${Math.round(139 * shade)},${Math.round(92 * shade)},${Math.round(52 * shade)})`;
      scales += `<path d="M${x} ${y - hgt * 0.55} Q${x + w * 0.62} ${y - hgt * 0.1} ${x + w * 0.5} ${y + hgt * 0.45} Q${x} ${y + hgt * 0.7} ${x - w * 0.5} ${y + hgt * 0.45} Q${x - w * 0.62} ${y - hgt * 0.1} ${x} ${y - hgt * 0.55}Z" fill="${fill}" stroke="${INK}" stroke-width="1.6"/><path d="M${x - w * 0.25} ${y - hgt * 0.15} Q${x} ${y - hgt * 0.4} ${x + w * 0.25} ${y - hgt * 0.15}" stroke="rgba(255,225,170,.5)" stroke-width="1.4" fill="none"/>`;
    }
  }
  return svg(
    160,
    240,
    `<path d="M80 235 q-6 -14 0 -24" stroke="${INK}" stroke-width="7" fill="none" stroke-linecap="round"/>${scales}`,
  );
}

function seeds(): string {
  const rnd = mulberry32(11);
  let body = '';
  // acorns
  for (const [x, y, r] of [[70, 90, -20], [150, 110, 28]] as const) {
    body += `<g transform="translate(${x} ${y}) rotate(${r})">
      <ellipse cx="0" cy="8" rx="17" ry="24" fill="url(#ac)" stroke="${INK}" stroke-width="2.4"/>
      <path d="M-20 -8 Q0 -34 20 -8 Q10 -2 0 -2 Q-10 -2 -20 -8Z" fill="#7a5230" stroke="${INK}" stroke-width="2.4"/>
      <path d="M-14 -12 l6 6 M-4 -16 l6 8 M7 -14 l6 8" stroke="rgba(255,225,170,.5)" stroke-width="1.4"/>
      <path d="M0 -26 q2 -10 6 -12" stroke="${INK}" stroke-width="3" fill="none"/></g>`;
  }
  // maple samaras
  for (const [x, y, r] of [[240, 70, 30], [300, 120, -35], [220, 140, 80]] as const) {
    body += `<g transform="translate(${x} ${y}) rotate(${r})">
      <ellipse cx="0" cy="0" rx="8" ry="9" fill="#a9803a" stroke="${INK}" stroke-width="2"/>
      <path d="M2 -4 Q36 -30 52 -6 Q34 8 6 6Z" fill="#d9b86c" stroke="${INK}" stroke-width="2"/>
      <path d="M8 -2 Q30 -14 44 -6" stroke="rgba(140,100,40,.7)" stroke-width="1.2" fill="none"/></g>`;
  }
  // small seeds
  for (let i = 0; i < 16; i++) {
    const x = 30 + rnd() * 300;
    const y = 190 + rnd() * 50;
    const r = rnd() * 180;
    body += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${r.toFixed(0)})"><ellipse rx="6" ry="10" fill="${i % 3 ? '#d8c28a' : '#6b4a2c'}" stroke="${INK}" stroke-width="1.6"/><path d="M0 -6 L0 6" stroke="rgba(58,38,22,.45)" stroke-width="1.1"/></g>`;
  }
  return svg(360, 260, body, `<linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c58d4f"/><stop offset="1" stop-color="#8d5d2c"/></linearGradient>`);
}

// ───────────────────────────── craft: dough, thread, tools ─────────────────────────────

function ornamentShape(kind: 'leaf' | 'round' | 'star'): { path: string; imprint: string } {
  if (kind === 'round') {
    return {
      path: 'M0 -46 A46 46 0 1 1 -0.1 -46Z',
      imprint: '<circle r="30" fill="none" stroke="#b99560" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/><circle r="16" fill="none" stroke="#b99560" stroke-width="3"/><circle r="4" fill="#b99560"/>',
    };
  }
  if (kind === 'star') {
    const p: Array<[number, number]> = [];
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? 50 : 26;
      p.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return {
      path: `M${p.map((q) => q.map((n) => n.toFixed(1)).join(' ')).join('L')}Z`,
      imprint: '<circle r="9" fill="none" stroke="#b99560" stroke-width="3"/><path d="M0 -34 L0 34 M-34 0 L34 0 M-24 -24 L24 24 M24 -24 L-24 24" stroke="#b99560" stroke-width="2.4" stroke-linecap="round"/>',
    };
  }
  return {
    path: smooth(leafOutline('oak').map(([x, y]) => [x * 1.05, y * 0.95] as [number, number])),
    imprint: '<path d="M0 38 L0 -34" stroke="#b99560" stroke-width="3" stroke-linecap="round"/>' +
      [-26, -12, 2, 16, 28].map((y) => `<path d="M0 ${-y} q14 -4 20 -14 M0 ${-y} q-14 -4 -20 -14" stroke="#b99560" stroke-width="2.4" fill="none" stroke-linecap="round" transform="translate(0 ${-4})"/>`).join(''),
  };
}

/** One salted-dough ornament, hung from a loop of red thread. */
function ornament(kind: 'leaf' | 'round' | 'star', tint = DOUGH): string {
  const { path, imprint } = ornamentShape(kind);
  return svg(
    150,
    190,
    `<g transform="translate(75 112)">
      <path d="M0 -62 C-14 -92 14 -92 0 -62" stroke="#c4452f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M0 -66 L0 -102" stroke="#c4452f" stroke-width="3" stroke-linecap="round"/>
      <path d="${path}" fill="url(#dg)" stroke="${DOUGH_D}" stroke-width="5" stroke-linejoin="round"/>
      <path d="${path}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" transform="scale(1.06)" opacity=".7"/>
      <g opacity=".95">${imprint}</g>
      <circle cx="0" cy="-48" r="5" fill="#a98448" stroke="${INK}" stroke-width="1.5"/>
      <path d="${path}" fill="url(#hl)" opacity=".55"/>
    </g>`,
    `<radialGradient id="dg" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff0cf"/><stop offset=".6" stop-color="${tint}"/><stop offset="1" stop-color="#d7b673"/></radialGradient>
     <linearGradient id="hl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
  );
}

function doughOnBoard(): string {
  // wooden board with rolled dough, rolling pin and a few unbaked shapes
  return svg(
    520,
    240,
    `<ellipse cx="260" cy="205" rx="230" ry="26" fill="rgba(40,24,12,.28)"/>
     <rect x="30" y="80" width="460" height="120" rx="22" fill="url(#bd)" stroke="${INK}" stroke-width="3"/>
     <path d="M48 118 H470 M48 150 H470 M48 178 H470" stroke="rgba(58,38,22,.25)" stroke-width="2"/>
     <path d="M70 118 Q250 86 450 120 Q462 160 440 176 Q250 196 80 176 Q58 150 70 118Z" fill="url(#dh)" stroke="${DOUGH_D}" stroke-width="3"/>
     <g fill="#e6cd96" stroke="${DOUGH_D}" stroke-width="2.4">
       <circle cx="160" cy="146" r="24" fill="#f2dfb6"/><path d="M260 128 l12 20 l22 4 l-16 16 l4 22 l-22 -10 l-20 10 l4 -22 l-16 -16 l22 -4z" transform="translate(-2 -14)"/>
     </g>
     <g transform="translate(330 70) rotate(-8)">
       <rect x="-4" y="0" width="190" height="34" rx="17" fill="url(#rp)" stroke="${INK}" stroke-width="3"/>
       <rect x="-40" y="9" width="46" height="16" rx="8" fill="${WOOD_L}" stroke="${INK}" stroke-width="3"/>
       <rect x="178" y="9" width="46" height="16" rx="8" fill="${WOOD_L}" stroke="${INK}" stroke-width="3"/>
     </g>`,
    `${lin('bd', WOOD_L, WOOD_M)}${lin('rp', '#dcb27a', '#a97a45')}${rad('dh', '#fff0cf', DOUGH)}`,
  );
}

function spools(): string {
  const spool = (x: number, y: number, thread: string, dark: string) => `
    <g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="44" rx="30" ry="9" fill="rgba(40,24,12,.28)"/>
      <rect x="-26" y="-34" width="52" height="9" rx="4" fill="${WOOD_L}" stroke="${INK}" stroke-width="2.4"/>
      <rect x="-26" y="30" width="52" height="9" rx="4" fill="${WOOD_L}" stroke="${INK}" stroke-width="2.4"/>
      <rect x="-20" y="-26" width="40" height="58" rx="6" fill="${thread}" stroke="${INK}" stroke-width="2.4"/>
      ${[-18, -9, 0, 9, 18, 27].map((yy) => `<path d="M-20 ${yy} Q0 ${yy + 4} 20 ${yy}" stroke="${dark}" stroke-width="1.8" fill="none"/>`).join('')}
    </g>`;
  return svg(
    360,
    130,
    `${spool(50, 60, '#c4452f', '#8f2d1e')}${spool(130, 70, '#e8dcb8', '#bfae82')}${spool(205, 58, '#4a7729', '#2f5018')}
     <path d="M250 96 C290 60 320 120 350 84 S 330 40 296 62" stroke="#c4452f" stroke-width="3.6" fill="none" stroke-linecap="round"/>
     <path d="M240 106 C280 120 300 100 330 112" stroke="#e8dcb8" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
  );
}

function magnifier(): string {
  return svg(
    190,
    260,
    `<g transform="rotate(18 95 130)">
      <rect x="86" y="118" width="18" height="112" rx="9" fill="url(#mh)" stroke="${INK}" stroke-width="3.2"/>
      <circle cx="95" cy="72" r="56" fill="none" stroke="#c9972b" stroke-width="12"/>
      <circle cx="95" cy="72" r="56" fill="none" stroke="${INK}" stroke-width="3.2"/>
      <circle cx="95" cy="72" r="49" fill="url(#gl)" opacity=".85"/>
      <path d="M62 48 Q80 30 108 34" stroke="#fff" stroke-opacity=".8" stroke-width="6" fill="none" stroke-linecap="round"/>
    </g>`,
    `${lin('mh', WOOD_L, WOOD_D)}<radialGradient id="gl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e9f8ff" stop-opacity=".95"/><stop offset="1" stop-color="#9cc9d8" stop-opacity=".45"/></radialGradient>`,
  );
}

// ───────────────────────────── furniture and set pieces ─────────────────────────────

function woodGrain(x0: number, y0: number, w: number, h: number, seed: number, lines: number, stroke = 'rgba(58,38,22,.22)'): string {
  const rnd = mulberry32(seed);
  let d = '';
  for (let i = 0; i < lines; i++) {
    const y = y0 + (i + rnd() * 0.8) * (h / lines);
    const a = (rnd() - 0.5) * 7;
    d += `<path d="M${x0} ${y.toFixed(1)} Q${x0 + w * 0.3} ${(y + a).toFixed(1)} ${x0 + w * 0.6} ${(y - a * 0.6).toFixed(1)} T${x0 + w} ${(y + a * 0.4).toFixed(1)}" stroke="${stroke}" stroke-width="${(1 + rnd() * 1.6).toFixed(1)}" fill="none"/>`;
  }
  return d;
}

/** Workshop table seen at a slight angle: planks, thick top, apron and legs. */
function workshopTable(): string {
  const W = 1700;
  const planks = [0, 1, 2, 3, 4].map((i) => {
    const y = 40 + i * 44;
    const inset = 150 - i * 30;
    return `<path d="M${inset} ${y} L${W - inset} ${y} L${W - inset + 18} ${y + 44} L${inset - 18} ${y + 44}Z" fill="${i % 2 ? '#b98650' : '#c6935a'}" stroke="${INK}" stroke-width="3"/>${woodGrain(inset, y + 6, W - 2 * inset, 34, 20 + i, 3)}`;
  });
  return svg(
    W,
    470,
    `<ellipse cx="${W / 2}" cy="452" rx="760" ry="20" fill="rgba(30,18,8,.35)"/>
     <rect x="90" y="262" width="62" height="200" rx="8" fill="url(#tl)" stroke="${INK}" stroke-width="4"/>
     <rect x="${W - 152}" y="262" width="62" height="200" rx="8" fill="url(#tl)" stroke="${INK}" stroke-width="4"/>
     ${planks.join('')}
     <path d="M52 260 L${W - 52} 260 L${W - 40} 318 L40 318Z" fill="url(#ta)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
     ${woodGrain(60, 266, W - 120, 46, 77, 4, 'rgba(40,24,12,.3)')}
     <path d="M52 260 L${W - 52} 260" stroke="rgba(255,230,180,.55)" stroke-width="4"/>
     <circle cx="620" cy="112" r="9" fill="rgba(58,38,22,.35)"/><circle cx="1180" cy="196" r="7" fill="rgba(58,38,22,.3)"/>`,
    `${lin('tl', WOOD_M, WOOD_D)}${lin('ta', '#b98650', '#7c4f2b')}`,
  );
}

function hornetLantern(variant: 0 | 1): string {
  // A paper hornets' nest turned into a lantern: layered paper shells with a warm light inside.
  const bands = 9;
  const shells = Array.from({ length: bands }, (_, i) => {
    const t = i / (bands - 1);
    const y = 70 + i * 24;
    const half = 22 + 46 * Math.sin(Math.PI * (0.2 + t * 0.62)) * (variant ? 0.92 : 1);
    const shade = [`#e8d3a0`, `#d9bd82`, `#c9a766`, `#b8914f`][i % 4]!;
    return `<path d="M${130 - half} ${y} Q130 ${y - 22} ${130 + half} ${y} Q${130 + half * 0.96} ${y + 30} 130 ${y + 34} Q${130 - half * 0.96} ${y + 30} ${130 - half} ${y}Z" fill="${shade}" stroke="${INK}" stroke-width="2.4"/>`;
  });
  return svg(
    260,
    360,
    `<path d="M130 0 L130 74" stroke="${INK}" stroke-width="4"/><path d="M130 6 l-10 14 M130 6 l10 14" stroke="${INK}" stroke-width="3"/>
     <ellipse cx="130" cy="190" rx="86" ry="120" fill="url(#lanternGlow)"/>
     ${shells.join('')}
     <ellipse cx="130" cy="292" rx="20" ry="11" fill="#6b4a2c" stroke="${INK}" stroke-width="2.4"/>
     <ellipse cx="130" cy="190" rx="52" ry="76" fill="url(#inner)" opacity=".5"/>`,
    `<radialGradient id="lanternGlow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
     <radialGradient id="inner"><stop offset="0" stop-color="#fff2c4"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>`,
  );
}

/** Wooden pergola beam with posts, the Hornet Garden's entrance. */
function pergola(): string {
  return svg(
    1500,
    520,
    `<rect x="40" y="40" width="1420" height="64" rx="10" fill="url(#bm)" stroke="${INK}" stroke-width="4"/>
     ${woodGrain(50, 46, 1400, 52, 4, 4, 'rgba(40,24,12,.3)')}
     <rect x="70" y="90" width="64" height="430" rx="8" fill="url(#ps)" stroke="${INK}" stroke-width="4"/>
     <rect x="1366" y="90" width="64" height="430" rx="8" fill="url(#ps)" stroke="${INK}" stroke-width="4"/>
     <path d="M134 98 L250 98 L134 200Z" fill="${WOOD_M}" stroke="${INK}" stroke-width="3.5"/>
     <path d="M1366 98 L1250 98 L1366 200Z" fill="${WOOD_M}" stroke="${INK}" stroke-width="3.5"/>
     <path d="M40 40 H1460" stroke="rgba(255,230,180,.6)" stroke-width="3"/>
     <g stroke="#c4452f" stroke-width="3" fill="none"><path d="M360 104 q40 18 80 0 M900 104 q40 18 80 0"/></g>
     <path d="M96 140 q-30 40 0 90 q-34 40 -4 100 M1404 150 q30 40 0 90 q34 40 4 100" stroke="#4a7729" stroke-width="7" fill="none" stroke-linecap="round"/>
     ${[[84, 200], [96, 280], [88, 360], [1412, 210], [1402, 300]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#4a7729" stroke="${INK}" stroke-width="2"/>`).join('')}`,
    `${lin('bm', WOOD_L, WOOD_D)}${lin('ps', WOOD_M, WOOD_D, false)}`,
  );
}

// ───────────────────────────── people (paper-doll, seen from behind) ─────────────────────────────

function person(kind: 'parent' | 'child'): string {
  // Seen from behind and a little from the side, leaning toward the table: no face to get wrong.
  const parent = kind === 'parent';
  const jacket = parent ? '#2f6a4a' : '#e2aa18';
  const jacketD = parent ? '#1f4a33' : '#b57a0c';
  const hair = parent ? '#5b3a24' : '#b9803c';
  const hairL = parent ? '#8a6140' : '#e2b36a';
  const skin = parent ? '#e8b48b' : '#f1c4a0';
  const s = parent ? 1 : 0.8;
  const strands = [-48, -26, -6, 16, 38, 56]
    .map((x) => `<path d="M${190 + x} 78 Q${190 + x * 1.15} 130 ${190 + x * 0.9} 196" stroke="${hairL}" stroke-opacity=".5" stroke-width="3.2" fill="none" stroke-linecap="round"/>`)
    .join('');
  return svg(
    430,
    540,
    `<g transform="translate(${parent ? 30 : 60} ${parent ? 0 : 80}) scale(${s})">
      <!-- torso and jacket -->
      <path d="M36 540 L40 340 Q44 262 150 240 L190 234 Q310 250 336 340 L346 540Z" fill="url(#jk)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M190 246 L190 540" stroke="${jacketD}" stroke-width="4"/>
      <path d="M96 318 Q124 380 112 460 M286 318 Q262 380 276 460" stroke="${jacketD}" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
      <!-- collar / hood -->
      <path d="M116 252 Q190 218 264 252 Q250 292 190 300 Q130 292 116 252Z" fill="${jacketD}" stroke="${INK}" stroke-width="4.5"/>
      <!-- neck -->
      <rect x="164" y="212" width="52" height="46" rx="16" fill="${skin}" stroke="${INK}" stroke-width="4"/>
      <!-- ears -->
      <ellipse cx="116" cy="156" rx="11" ry="17" fill="${skin}" stroke="${INK}" stroke-width="4"/>
      <ellipse cx="264" cy="156" rx="11" ry="17" fill="${skin}" stroke="${INK}" stroke-width="4"/>
      <!-- back of the head: all hair -->
      <path d="M190 62 C118 62 112 132 120 180 C128 214 160 222 190 220 C220 222 252 214 260 180 C268 132 262 62 190 62Z" fill="url(#hr)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      ${strands}
      <path d="M190 70 Q184 120 190 184" stroke="${INK}" stroke-opacity=".45" stroke-width="3" fill="none"/>
      ${parent ? '' : `<path d="M236 66 Q312 40 304 142 Q298 180 270 196 Q286 150 258 118Z" fill="${hair}" stroke="${INK}" stroke-width="4.5"/><path d="M258 82 q36 -14 40 12" stroke="#c4452f" stroke-width="9" fill="none" stroke-linecap="round"/>`}
      <path d="M120 120 Q190 76 260 118" stroke="rgba(255,226,160,.6)" stroke-width="5" fill="none" stroke-linecap="round"/>
      <!-- reaching arm toward the table with a hand -->
      <path d="M304 304 Q380 350 408 448 L372 470 Q334 392 282 358Z" fill="${jacket}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M408 448 q22 10 14 36 q-12 10 -34 -2z" fill="${skin}" stroke="${INK}" stroke-width="4"/>
      <path d="M74 304 Q30 364 40 444 L84 454 Q94 384 126 344Z" fill="${jacket}" stroke="${INK}" stroke-width="5" stroke-linejoin="round" opacity=".92"/>
      <!-- sun rim light from the right -->
      <path d="M334 340 L346 540" stroke="rgba(255,226,160,.75)" stroke-width="7" stroke-linecap="round"/>
      <path d="M262 100 Q276 130 266 176" stroke="rgba(255,226,160,.75)" stroke-width="6" fill="none" stroke-linecap="round"/>
    </g>`,
    `${lin('jk', jacket, jacketD)}<linearGradient id="hr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${hair}"/><stop offset=".75" stop-color="${hair}"/><stop offset="1" stop-color="${hairL}"/></linearGradient>`,
  );
}

// ───────────────────────────── garden & forest layers (canvas) ─────────────────────────────

/** Papercut pine silhouettes. `edge` hugs the left or right side of the frame; transparent in the middle. */
function paperPines(edge: 'left' | 'right' | 'both', tone: string, seed: number): HTMLCanvasElement {
  const W = 900;
  const H = 1200;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  const trees = edge === 'both' ? 9 : 6;
  for (let i = 0; i < trees; i++) {
    const side = edge === 'both' ? (i % 2 ? 1 : 0) : edge === 'left' ? 0 : 1;
    const base = side === 0 ? W * (0.12 + rnd() * 0.3) : W * (0.58 + rnd() * 0.3);
    const h = H * (0.55 + rnd() * 0.45);
    const w = h * (0.22 + rnd() * 0.08);
    const g = ctx.createLinearGradient(0, H - h, 0, H);
    g.addColorStop(0, tone);
    g.addColorStop(1, 'rgba(8,38,26,.96)');
    ctx.fillStyle = g;
    // trunk
    ctx.fillRect(base - w * 0.04, H - h * 0.18, w * 0.08, h * 0.18);
    // tiers with ragged edges
    const tiers = 7;
    for (let t = 0; t < tiers; t++) {
      const ty = H - h * (0.1 + (t / tiers) * 0.9);
      const tw = w * (1 - t / (tiers + 0.7));
      ctx.beginPath();
      ctx.moveTo(base, ty - h / tiers * 1.5);
      const steps = 9;
      for (let k = 0; k <= steps; k++) {
        const f = k / steps;
        ctx.lineTo(base + tw * f + (k % 2 ? -tw * 0.08 : 0), ty + f * (h / tiers) * 0.8 + (rnd() - 0.5) * 6);
      }
      for (let k = steps; k >= 0; k--) {
        const f = k / steps;
        ctx.lineTo(base - tw * f + (k % 2 ? tw * 0.08 : 0), ty + f * (h / tiers) * 0.8 + (rnd() - 0.5) * 6);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  // faint mist at the feet gives depth between layers
  const mist = ctx.createLinearGradient(0, H * 0.78, 0, H);
  mist.addColorStop(0, 'rgba(255,240,200,0)');
  mist.addColorStop(1, 'rgba(255,240,200,.18)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, W, H);
  return c;
}

/** Soft garden bushes with flowers, for the bottom corners. */
function gardenBush(seed: number, flowers: string[]): HTMLCanvasElement {
  const W = 900;
  const H = 520;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  const greens = ['#2f6a3a', '#3f7d3e', '#4a8a3a', '#2a5a36'];
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W;
    const y = H - 30 - rnd() * 200 * Math.sin((x / W) * Math.PI);
    const r = 40 + rnd() * 70;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, greens[(rnd() * greens.length) | 0]!);
    g.addColorStop(1, '#1c4a2c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    const x = 60 + rnd() * (W - 120);
    const y = H - 70 - rnd() * 200 * Math.sin((x / W) * Math.PI);
    const col = flowers[(rnd() * flowers.length) | 0]!;
    ctx.fillStyle = col;
    const pr = 8 + rnd() * 8;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * pr * 0.9, y + Math.sin(a) * pr * 0.9, pr * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e2aa18';
    ctx.beginPath();
    ctx.arc(x, y, pr * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

/** Out-of-focus leaves at the frame corners: a foreground veil of depth. */
function bokehLeaves(seed: number): HTMLCanvasElement {
  const W = 1000;
  const H = 520;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  ctx.filter = 'blur(10px)';
  for (let i = 0; i < 14; i++) {
    // leaves cluster in the corner (top-left of the sprite) and thin out toward the centre
    const x = Math.pow(rnd(), 1.8) * W * 0.85;
    const y = Math.pow(rnd(), 1.6) * H * 0.8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI * 2);
    const sz = 36 + rnd() * 54;
    ctx.fillStyle = ['#1f4d2c', '#2d6a3a', '#3f7d3e', '#6c8f3a', '#c9892a'][(rnd() * 5) | 0]!;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, 0, sz * 0.36, sz, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

// ───────────────────────────── other zones' set pieces ─────────────────────────────

function xylophone(): string {
  const bars = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const h = 150 - i * 12;
    const x = 40 + i * 70;
    const col = ['#c79a62', '#b98650', '#c79a62', '#b98650', '#c79a62', '#b98650', '#c79a62'][i]!;
    return `<rect x="${x}" y="${96 + (150 - h) / 2}" width="58" height="${h}" rx="10" fill="${col}" stroke="${INK}" stroke-width="3.4"/>${woodGrain(x + 4, 100 + (150 - h) / 2, 50, h - 8, 90 + i, 3, 'rgba(58,38,22,.25)')}<circle cx="${x + 29}" cy="${106 + (150 - h) / 2}" r="4" fill="${INK}"/><circle cx="${x + 29}" cy="${88 + (150 + h) / 2}" r="4" fill="${INK}"/>`;
  });
  return svg(
    560,
    330,
    `<ellipse cx="280" cy="300" rx="250" ry="18" fill="rgba(40,24,12,.3)"/>
     <rect x="20" y="108" width="520" height="16" rx="8" fill="${WOOD_D}" stroke="${INK}" stroke-width="3.4"/>
     <rect x="20" y="214" width="520" height="16" rx="8" fill="${WOOD_D}" stroke="${INK}" stroke-width="3.4"/>
     <path d="M30 124 L70 290 M530 124 L490 290" stroke="${WOOD_D}" stroke-width="16" stroke-linecap="round"/>
     <path d="M30 124 L70 290 M530 124 L490 290" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".4"/>
     ${bars.join('')}
     <g transform="translate(440 30) rotate(24)"><rect x="0" y="0" width="12" height="150" rx="6" fill="${WOOD_L}" stroke="${INK}" stroke-width="3"/><circle cx="6" cy="0" r="17" fill="#c4452f" stroke="${INK}" stroke-width="3"/></g>
     <g transform="translate(110 20) rotate(-18)"><rect x="0" y="0" width="12" height="150" rx="6" fill="${WOOD_L}" stroke="${INK}" stroke-width="3"/><circle cx="6" cy="0" r="17" fill="#e2aa18" stroke="${INK}" stroke-width="3"/></g>`,
  );
}

function claves(): string {
  return svg(
    320,
    200,
    `<g transform="rotate(-16 160 100)"><rect x="40" y="70" width="230" height="26" rx="13" fill="url(#c1)" stroke="${INK}" stroke-width="3.4"/><rect x="50" y="108" width="230" height="26" rx="13" fill="url(#c1)" stroke="${INK}" stroke-width="3.4"/></g>
     <g transform="translate(250 130)"><ellipse cx="0" cy="40" rx="34" ry="8" fill="rgba(40,24,12,.3)"/><path d="M-22 -40 Q-40 0 -26 32 Q0 46 26 32 Q40 0 22 -40Z" fill="url(#gd)" stroke="${INK}" stroke-width="3.4"/><rect x="-8" y="-72" width="16" height="36" rx="8" fill="${WOOD_L}" stroke="${INK}" stroke-width="3"/><path d="M-18 -10 q18 14 36 0 M-22 6 q22 16 44 0" stroke="rgba(58,38,22,.5)" stroke-width="2.4" fill="none"/></g>`,
    `${lin('c1', '#d9b27a', '#a97a45')}<linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9b86c"/><stop offset="1" stop-color="#a47a34"/></linearGradient>`,
  );
}

function orangeSlices(): string {
  const slice = (x: number, y: number, r: number, rot: number) => {
    let seg = '';
    for (let i = 0; i < 9; i++) {
      const a0 = (i / 9) * Math.PI * 2;
      const a1 = ((i + 1) / 9) * Math.PI * 2;
      const r1 = r * 0.82;
      seg += `<path d="M0 0 L${Math.cos(a0) * r1} ${Math.sin(a0) * r1} A${r1} ${r1} 0 0 1 ${Math.cos(a1) * r1} ${Math.sin(a1) * r1}Z" fill="url(#og)" stroke="#f6c26b" stroke-width="2.2" stroke-linejoin="round"/>`;
    }
    return `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse cx="3" cy="${r * 0.9}" rx="${r}" ry="${r * 0.18}" fill="rgba(40,24,12,.25)"/><circle r="${r}" fill="#e98a2a" stroke="${INK}" stroke-width="3"/><circle r="${r * 0.9}" fill="#f6b04c"/>${seg}<circle r="${r * 0.07}" fill="#fff0cf"/></g>`;
  };
  return svg(
    420,
    190,
    `${slice(80, 94, 66, 10)}${slice(210, 80, 56, -20)}${slice(334, 100, 62, 34)}`,
    '<radialGradient id="og" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffd28a"/><stop offset="1" stop-color="#f08a24"/></radialGradient>',
  );
}

function berriesAndNuts(): string {
  const berries = (x: number, y: number, col: string, dark: string) =>
    Array.from({ length: 9 }, (_, i) => {
      const a = i * 2.4;
      const rr = 8 + (i % 3) * 14;
      return `<g transform="translate(${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr * 0.6 - (i % 3) * 5})"><circle r="14" fill="${col}" stroke="${INK}" stroke-width="2.4"/><circle cx="-4" cy="-5" r="4" fill="rgba(255,255,255,.55)"/><path d="M-4 -12 l4 5 l4 -5" stroke="${dark}" stroke-width="2" fill="none"/></g>`;
    }).join('');
  const nut = (x: number, y: number, r: number) =>
    `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="22" ry="29" fill="url(#hz)" stroke="${INK}" stroke-width="3"/><path d="M-16 -8 Q0 -20 16 -8" stroke="rgba(255,225,170,.5)" stroke-width="2.4" fill="none"/><ellipse cy="-24" rx="9" ry="6" fill="#7a5230" stroke="${INK}" stroke-width="2.2"/></g>`;
  return svg(
    470,
    200,
    `<ellipse cx="90" cy="156" rx="78" ry="18" fill="rgba(40,24,12,.28)"/><path d="M14 90 Q90 168 166 90Z" fill="${WOOD_L}" stroke="${INK}" stroke-width="3.4"/>${berries(90, 78, '#b3263e', '#4a7729')}
     <ellipse cx="260" cy="156" rx="70" ry="18" fill="rgba(40,24,12,.28)"/><path d="M190 90 Q260 168 330 90Z" fill="${WOOD_L}" stroke="${INK}" stroke-width="3.4"/>${berries(260, 78, '#3b4a8c', '#4a7729')}
     ${nut(380, 120, -24)}${nut(432, 134, 30)}${nut(404, 76, 8)}`,
    '<linearGradient id="hz" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c58d4f"/><stop offset="1" stop-color="#8d5d2c"/></linearGradient>',
  );
}

function necklace(): string {
  const beads: string[] = [];
  const arc = (u: number): [number, number] => [40 + u * 520, 60 + Math.sin(Math.PI * u) * 150];
  beads.push(`<path d="${smooth(Array.from({ length: 14 }, (_, i) => arc(i / 13)), false)}" stroke="${INK}" stroke-width="5" fill="none"/><path d="${smooth(Array.from({ length: 14 }, (_, i) => arc(i / 13)), false)}" stroke="#a9834d" stroke-width="2.6" fill="none"/>`);
  const kinds = ['slice', 'berry', 'nut', 'berry'];
  for (let i = 0; i < 13; i++) {
    const [x, y] = arc((i + 0.5) / 13);
    const k = kinds[i % 4]!;
    if (k === 'slice') {
      beads.push(`<g transform="translate(${x} ${y + 20}) rotate(${(i * 23) % 40 - 20})"><circle r="25" fill="#e98a2a" stroke="${INK}" stroke-width="3"/><circle r="21" fill="#f6b04c"/>${Array.from({ length: 8 }, (_, s) => `<path d="M0 0 L${Math.cos((s / 8) * 6.283) * 20} ${Math.sin((s / 8) * 6.283) * 20}" stroke="#fff0cf" stroke-width="1.8"/>`).join('')}</g>`);
    } else if (k === 'berry') {
      beads.push(`<g transform="translate(${x} ${y + 12})"><circle r="13" fill="${i % 8 === 1 ? '#b3263e' : '#3b4a8c'}" stroke="${INK}" stroke-width="2.6"/><circle cx="-4" cy="-4" r="3.6" fill="rgba(255,255,255,.55)"/></g>`);
    } else {
      beads.push(`<g transform="translate(${x} ${y + 16}) rotate(${(i * 31) % 50 - 25})"><ellipse rx="14" ry="19" fill="#9a6a3c" stroke="${INK}" stroke-width="2.8"/><path d="M-8 -6 Q0 -12 8 -6" stroke="rgba(255,225,170,.55)" stroke-width="2" fill="none"/></g>`);
    }
  }
  return svg(600, 260, beads.join(''));
}

function scentWheel(): string {
  const cols = ['#6c8f3a', '#9a6a3c', '#a67bc9', '#f08a24', '#2c5a35', '#e8dcb8'];
  const icons = [
    // moss/herb leaf, wood slice, lavender, citrus, pine twig, resin drop
    '<path d="M0 22 Q-20 0 0 -24 Q20 0 0 22Z" fill="#dff0b0" stroke="#2a3a14" stroke-width="2.6"/><path d="M0 20 V-18" stroke="#2a3a14" stroke-width="2"/>',
    '<circle r="20" fill="#d9b27a" stroke="#4a2c14" stroke-width="2.6"/><circle r="12" fill="none" stroke="#a97a45" stroke-width="2"/><circle r="5" fill="none" stroke="#a97a45" stroke-width="2"/>',
    '<path d="M0 24 V-6" stroke="#2a3a14" stroke-width="2.6"/>' + [-16, -9, -2, 5].map((y, i) => `<ellipse cx="${i % 2 ? 6 : -6}" cy="${y}" rx="4" ry="7" fill="#f3e6ff" stroke="#4a2c7a" stroke-width="2"/>`).join(''),
    '<circle r="20" fill="#ffd28a" stroke="#8a3d0a" stroke-width="2.6"/>' + Array.from({ length: 6 }, (_, i) => `<path d="M0 0 L${Math.cos((i / 6) * 6.283) * 17} ${Math.sin((i / 6) * 6.283) * 17}" stroke="#f08a24" stroke-width="2.2"/>`).join(''),
    '<path d="M0 24 V-24" stroke="#143a22" stroke-width="3"/>' + [-16, -6, 4, 14].map((y) => `<path d="M0 ${y} l-16 8 M0 ${y} l16 8" stroke="#a9e6b8" stroke-width="3" stroke-linecap="round"/>`).join(''),
    '<path d="M0 -24 Q22 4 0 22 Q-22 4 0 -24Z" fill="#ffe08a" stroke="#7a5a0a" stroke-width="2.6"/><ellipse cx="-5" cy="2" rx="4" ry="8" fill="rgba(255,255,255,.6)"/>',
  ];
  const sectors = cols
    .map((c, i) => {
      const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      const am = (a0 + a1) / 2;
      const r = 180;
      return `<path d="M0 0 L${Math.cos(a0) * r} ${Math.sin(a0) * r} A${r} ${r} 0 0 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r}Z" fill="${c}" stroke="${INK}" stroke-width="4"/><g transform="translate(${Math.cos(am) * 112} ${Math.sin(am) * 112}) scale(1.35)">${icons[i]}</g>`;
    })
    .join('');
  return svg(
    460,
    700,
    `<ellipse cx="230" cy="672" rx="150" ry="16" fill="rgba(40,24,12,.32)"/>
     <path d="M200 380 L190 660 L270 660 L260 380Z" fill="url(#st)" stroke="${INK}" stroke-width="4"/>
     <rect x="120" y="640" width="220" height="32" rx="12" fill="${WOOD_M}" stroke="${INK}" stroke-width="4"/>
     <g transform="translate(230 200)"><circle r="196" fill="${WOOD_L}" stroke="${INK}" stroke-width="5"/><circle r="186" fill="${WOOD_D}"/>${sectors}<circle r="26" fill="#c9972b" stroke="${INK}" stroke-width="4"/><circle r="9" fill="#fff0cf"/></g>
     <path d="M230 -4 L212 -34 L248 -34Z" fill="#c9972b" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`,
    lin('st', WOOD_M, WOOD_D, false),
  );
}

function touchPanel(): string {
  const cell = (cx: number, cy: number, obj: string) => `
    <rect x="${cx - 84}" y="${cy - 84}" width="168" height="168" rx="20" fill="#2a190c" stroke="${INK}" stroke-width="4"/>
    <g transform="translate(${cx} ${cy + 6})">${obj}</g>
    <path d="M${cx - 84} ${cy - 84} H${cx + 84} L${cx + 96} ${cy - 120} H${cx - 72}Z" fill="${WOOD_L}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="${cx + 6}" cy="${cy - 100}" r="7" fill="${WOOD_D}" stroke="${INK}" stroke-width="2.4"/>`;
  const cone = '<g transform="scale(.58) translate(-80 -120)"><path d="M80 20 Q150 60 138 150 Q80 232 22 150 Q10 60 80 20Z" fill="#8b5c34" stroke="#3a2616" stroke-width="5"/><path d="M40 90 Q80 70 120 90 M34 130 Q80 108 126 130 M48 168 Q80 150 112 168" stroke="rgba(255,225,170,.55)" stroke-width="6" fill="none"/></g>';
  const moss = '<g fill="#6c8f3a" stroke="#2a3a14" stroke-width="2.6"><circle cx="-24" cy="6" r="22"/><circle cx="6" cy="-8" r="26"/><circle cx="30" cy="10" r="20"/><circle cx="0" cy="22" r="22"/></g><g fill="#9bc25a"><circle cx="-8" cy="-14" r="6"/><circle cx="20" cy="2" r="5"/></g>';
  const bark = '<path d="M-44 30 L-32 -34 L-4 -44 L30 -30 L46 24 L22 42 L-20 44Z" fill="#7a4f2d" stroke="#3a2616" stroke-width="4"/><path d="M-26 20 L-18 -26 M-4 30 L2 -34 M18 24 L24 -18" stroke="#3a2616" stroke-width="3.2" stroke-linecap="round" opacity=".7"/>';
  const sand = '<ellipse cx="0" cy="18" rx="52" ry="26" fill="#e0cf9a" stroke="#6b5a2c" stroke-width="3.4"/><g fill="#c9b27a"><circle cx="-18" cy="14" r="4"/><circle cx="8" cy="22" r="5"/><circle cx="24" cy="12" r="3.6"/><circle cx="-4" cy="6" r="3.4"/></g>';
  return svg(
    480,
    470,
    `<ellipse cx="240" cy="452" rx="210" ry="16" fill="rgba(40,24,12,.32)"/>
     <rect x="14" y="20" width="452" height="420" rx="30" fill="url(#pb)" stroke="${INK}" stroke-width="5"/>
     ${woodGrain(24, 28, 432, 404, 301, 9, 'rgba(40,24,12,.22)')}
     ${cell(130, 150, cone)}${cell(350, 150, moss)}${cell(130, 350, bark)}${cell(350, 350, sand)}`,
    lin('pb', '#b98650', '#7c4f2b'),
  );
}

function trailPatches(): string {
  const patch = (x: number, base: string, dark: string, deco: string) =>
    `<g transform="translate(${x} 70)"><ellipse cx="0" cy="40" rx="84" ry="16" fill="rgba(30,18,8,.3)"/><path d="M-80 -6 L80 -6 L96 40 L-96 40Z" fill="${base}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M-80 -6 L80 -6" stroke="${dark}" stroke-width="3"/>${deco}</g>`;
  return svg(
    1060,
    130,
    `${patch(100, '#7a4f2d', '#3d2815', [-50, -20, 10, 40].map((x) => `<path d="M${x} -2 q4 16 -2 36" stroke="#3a2616" stroke-width="3.4" fill="none"/>`).join(''))}
     ${patch(310, '#8a6b45', '#4a3a20', [-40, 0, 36].map((x) => `<path d="M${x} 6 l-8 20 l16 0z" fill="#5e3b22" stroke="#3a2616" stroke-width="2.4"/>`).join(''))}
     ${patch(530, '#4f7a2f', '#2a3a14', [-50, -20, 14, 44].map((x, i) => `<circle cx="${x}" cy="${14 + (i % 2) * 8}" r="15" fill="#6c8f3a" stroke="#2a3a14" stroke-width="2.4"/>`).join(''))}
     ${patch(750, '#e0cf9a', '#a9945a', [-46, -14, 18, 46].map((x, i) => `<circle cx="${x}" cy="${12 + (i % 2) * 10}" r="3.4" fill="#b8a36a"/>`).join(''))}
     ${patch(960, '#c79a62', '#7a5530', [-40, -4, 32].map((x) => `<path d="M${x} -2 L${x} 36" stroke="#8a5a33" stroke-width="2.4"/>`).join(''))}`,
  );
}

/** Soft dark frame + warm centre that holds the eye on the scene and keeps captions readable. */
function vignetteCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 288;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(256, 130, 70, 256, 144, 330);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.55, 'rgba(4,22,14,0.1)');
  g.addColorStop(1, 'rgba(4,22,14,0.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 288);
  const b = ctx.createLinearGradient(0, 180, 0, 288);
  b.addColorStop(0, 'rgba(4,22,14,0)');
  b.addColorStop(1, 'rgba(4,22,14,0.45)');
  ctx.fillStyle = b;
  ctx.fillRect(0, 180, 512, 108);
  return c;
}

// ───────────────────────────── registry ─────────────────────────────

const base = (): string => import.meta.env.BASE_URL;

const svgArt =
  (build: () => { markup: string; w: number; h: number }, scale = 1): Maker =>
  () => {
    const { markup, w, h } = build();
    return rasterize(markup, w, h, scale);
  };

const sized = (w: number, h: number, fn: () => string) => () => ({ markup: fn(), w, h });
const canvasArt = (fn: () => HTMLCanvasElement): Maker => async () => fromCanvas(fn());

const MAKERS: Record<string, Maker> = {
  // photographic backdrops (official park photos, interim)
  'photo-forest-soft': () => loadPhoto(`${base()}assets/illustrations/backdrops/forest-soft.webp`),
  'photo-forest-birch': () => loadPhoto(`${base()}assets/illustrations/backdrops/forest-birch.webp`),
  'photo-rukisu-mezs': () => loadPhoto(`${base()}assets/illustrations/backdrops/rukisu-mezs.webp`),

  // papercut forest + garden
  'paper-pines-left': canvasArt(() => paperPines('left', 'rgba(24,78,52,.95)', 3)),
  'paper-pines-right': canvasArt(() => paperPines('right', 'rgba(24,78,52,.95)', 9)),
  'paper-pines-left-near': canvasArt(() => paperPines('left', 'rgba(12,52,36,.98)', 21)),
  'paper-pines-right-near': canvasArt(() => paperPines('right', 'rgba(12,52,36,.98)', 17)),
  'garden-bush-left': canvasArt(() => gardenBush(4, ['#f3b6c4', '#fff2b0', '#ffffff', '#f09a6a'])),
  'garden-bush-right': canvasArt(() => gardenBush(8, ['#fff2b0', '#f3b6c4', '#d9c2ff'])),
  'bokeh-leaves': canvasArt(() => bokehLeaves(6)),
  vignette: canvasArt(vignetteCanvas),

  // Hornet Garden (Skats)
  'pergola': svgArt(sized(1500, 520, pergola), 0.8),
  'lantern-a': svgArt(sized(260, 360, () => hornetLantern(0)), 1.2),
  'lantern-b': svgArt(sized(260, 360, () => hornetLantern(1)), 1.2),
  'table': svgArt(sized(1700, 470, workshopTable), 0.9),
  'leaves-cluster': svgArt(sized(760, 340, leavesCluster), 1.1),
  'leaf-oak': svgArt(sized(160, 170, () => leafSingle('oak', '#c4452f', '#8f2d1e', '#e7894a')), 1.6),
  'leaf-maple': svgArt(sized(160, 170, () => leafSingle('maple', '#e2aa18', '#b57a0c', '#f4d36a')), 1.6),
  'pine-cone': svgArt(sized(160, 240, pineCone), 1.4),
  'seeds': svgArt(sized(360, 260, seeds), 1.3),
  'dough-board': svgArt(sized(520, 240, doughOnBoard), 1.2),
  'spools': svgArt(sized(360, 130, spools), 1.3),
  'magnifier': svgArt(sized(190, 260, magnifier), 1.4),
  'ornament-leaf': svgArt(sized(150, 190, () => ornament('leaf')), 2.2),
  'ornament-round': svgArt(sized(150, 190, () => ornament('round')), 2.2),
  'ornament-star': svgArt(sized(150, 190, () => ornament('star')), 2.2),
  'person-parent': svgArt(sized(420, 540, () => person('parent')), 1.4),
  'person-child': svgArt(sized(420, 540, () => person('child')), 1.4),

  // Austiņa
  'xylophone': svgArt(sized(560, 330, xylophone), 1.3),
  'claves': svgArt(sized(320, 200, claves), 1.3),
  // Odziņa
  'orange-slices': svgArt(sized(420, 190, orangeSlices), 1.3),
  'berries-nuts': svgArt(sized(470, 200, berriesAndNuts), 1.3),
  'necklace': svgArt(sized(600, 260, necklace), 1.5),
  // Deguntiņš
  'scent-wheel': svgArt(sized(460, 700, scentWheel), 1.2),
  // Plaukstiņa
  'touch-panel': svgArt(sized(480, 470, touchPanel), 1.3),
  'trail-patches': svgArt(sized(1060, 130, trailPatches), 1.2),
};

const cache = new Map<string, Promise<Art>>();

/** All art keys that exist (used by tests to keep compositions and the library in sync). */
export const ART_KEYS: readonly string[] = Object.keys(MAKERS);

/**
 * Loads (and caches) an art asset. A `ready` image registered in content/assets.ts under the same key
 * replaces the drawn version, so final illustrations drop in without code changes.
 */
export function loadArt(key: string): Promise<Art> {
  let promise = cache.get(key);
  if (!promise) {
    const entry = getAsset(key);
    if (entry && entry.status === 'ready') promise = loadPhoto(entry.url);
    else {
      const make = MAKERS[key];
      promise = make ? make() : Promise.reject(new Error(`Unknown art key: ${key}`));
    }
    cache.set(key, promise);
  }
  return promise;
}

/** Warms the cache in the background so scenes start instantly. */
export async function preloadArt(keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    try {
      await loadArt(key);
    } catch (error) {
      console.warn(`[art] could not prepare "${key}"`, error);
    }
    // yield between assets so the first frames stay smooth
    await new Promise((r) => setTimeout(r, 0));
  }
}
