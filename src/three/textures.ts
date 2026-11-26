import { CanvasTexture, ClampToEdgeWrapping, LinearFilter, SRGBColorSpace } from 'three';
import { BRAND } from '../content/brand';
import { GUARDIANS } from '../content/guardians';
import { mulberry32 } from './util';

export const MAP_W = 8;
export const MAP_D = MAP_W / Math.SQRT2; // A3 landscape (420 × 297 mm)

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  return [c, ctx];
}

function finish(c: HTMLCanvasElement, srgb = true): CanvasTexture {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** Soft round glow: used for particles and halos. */
export function glowTexture(): CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c);
}

/** Vertical fade (bright bottom → transparent top), for light shafts and beacons. */
export function beamTexture(): CanvasTexture {
  const [c, ctx] = canvas(16, 128);
  const g = ctx.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 128);
  return finish(c);
}

/**
 * Placeholder illustrated map, drawn procedurally so no copyrighted art ships with the prototype.
 * Zone clearings are placed from the guardian data, so moving a zone in guardians.ts moves it here.
 * Replaced by the real illustration when `map-illustration` is marked ready in content/assets.ts.
 */
export function placeholderMapTexture(width = 1536): CanvasTexture {
  const height = Math.round(width / Math.SQRT2);
  const [c, ctx] = canvas(width, height);
  const rnd = mulberry32(7);
  const W = width;
  const H = height;
  const P = (u: number, v: number): [number, number] => [u * W, v * H];

  // Parchment rim
  ctx.fillStyle = BRAND.colors.cream;
  ctx.fillRect(0, 0, W, H);

  // Forest floor
  const inset = W * 0.022;
  const floor = ctx.createRadialGradient(W * 0.5, H * 0.45, W * 0.05, W * 0.5, H * 0.5, W * 0.62);
  floor.addColorStop(0, '#5b8a47');
  floor.addColorStop(1, '#2f5a38');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, W * 0.012);
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Meadow patches and tonal variation
  for (let i = 0; i < 70; i++) {
    const [x, y] = P(rnd(), rnd());
    ctx.fillStyle = `rgba(${150 + rnd() * 40},${190 + rnd() * 30},${90 + rnd() * 30},${0.06 + rnd() * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, y, W * (0.03 + rnd() * 0.07), H * (0.025 + rnd() * 0.06), rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // River (bottom band)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const river = () => {
    ctx.beginPath();
    ctx.moveTo(...P(-0.02, 0.9));
    ctx.bezierCurveTo(...P(0.22, 0.99), ...P(0.4, 0.84), ...P(0.62, 0.93));
    ctx.bezierCurveTo(...P(0.8, 1.0), ...P(0.92, 0.9), ...P(1.02, 0.95));
  };
  ctx.strokeStyle = '#2f6f78';
  ctx.lineWidth = W * 0.05;
  river();
  ctx.stroke();
  ctx.strokeStyle = '#6fb6c0';
  ctx.lineWidth = W * 0.036;
  river();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = W * 0.006;
  river();
  ctx.stroke();

  // Trail loop through the five zones (in map order around the clearing)
  const byId = Object.fromEntries(GUARDIANS.map((g) => [g.id, g.zone.mapPosition]));
  const loop = ['skats', 'austina', 'odzina', 'plaukstina', 'deguntins', 'skats']
    .map((id) => byId[id])
    .filter((p): p is { u: number; v: number } => Boolean(p));
  // Control points are computed once so both passes (edge + surface) draw the same curve.
  const segments = loop.slice(1).map((p, i) => {
    const prev = loop[i]!;
    const [px, py] = P(prev.u, prev.v);
    const [x, y] = P(p.u, p.v);
    return {
      cx: (px + x) / 2 + (rnd() - 0.5) * W * 0.05,
      cy: (py + y) / 2 + (rnd() - 0.5) * H * 0.07,
      x,
      y,
    };
  });
  const trail = () => {
    ctx.beginPath();
    ctx.moveTo(...P(loop[0]!.u, loop[0]!.v));
    segments.forEach((s) => ctx.quadraticCurveTo(s.cx, s.cy, s.x, s.y));
  };
  ctx.strokeStyle = '#6d5230';
  ctx.lineWidth = W * 0.015;
  trail();
  ctx.stroke();
  ctx.strokeStyle = '#ecd9a8';
  ctx.lineWidth = W * 0.01;
  trail();
  ctx.stroke();

  // Clearings: one per zone, plus the centre where the Tree of Five Senses grows
  const clearing = (u: number, v: number, r: number, color: string) => {
    const [x, y] = P(u, v);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  GUARDIANS.forEach((g) => clearing(g.zone.mapPosition.u, g.zone.mapPosition.v, W * 0.085, 'rgba(190,210,120,0.75)'));
  clearing(0.5, 0.5, W * 0.1, 'rgba(240,210,120,0.55)');

  // Little pine glyphs for texture
  for (let i = 0; i < 260; i++) {
    const [x, y] = P(rnd(), rnd());
    const s = W * (0.006 + rnd() * 0.006);
    ctx.fillStyle = `rgba(20,60,40,${0.25 + rnd() * 0.25})`;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.lineTo(x + s, y + s * 0.8);
    ctx.lineTo(x - s, y + s * 0.8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Cartouche
  ctx.fillStyle = BRAND.colors.greenDark;
  ctx.font = `600 ${Math.round(W * 0.021)}px Georgia, "Times New Roman", serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText('TĒRVETE · PLACEHOLDER MAP', W * 0.045, H - inset * 0.55);

  return finish(c);
}
