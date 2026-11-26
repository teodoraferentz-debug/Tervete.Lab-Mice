import { CanvasTexture, Shape, ShapeGeometry, SRGBColorSpace, type BufferGeometry, type Texture } from 'three';
import { mulberry32 } from '../util';

/**
 * Small procedural textures and shapes for the props that have no scanned model: leaves, salted dough,
 * dried orange, painted signs, the scent wheel and the five textures of the touch panel. They are drawn
 * once on a canvas (seeded, so identical on every run) and are cheap for a phone-class GPU.
 */

export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ── leaves ────────────────────────────────────────────────────────────────────

export type LeafKind = 'oak' | 'birch' | 'maple' | 'aspen';

/** Outline of a leaf, 0.1 m long, stem at the origin pointing +Y. */
export function leafShape(kind: LeafKind, length = 0.1): Shape {
  const L = length;
  const s = new Shape();
  switch (kind) {
    case 'oak': {
      const W = L * 0.34;
      s.moveTo(0, 0);
      s.bezierCurveTo(W * 0.5, L * 0.05, W, L * 0.14, W * 0.7, L * 0.24);
      s.bezierCurveTo(W * 1.35, L * 0.3, W * 1.1, L * 0.46, W * 0.7, L * 0.5);
      s.bezierCurveTo(W * 1.2, L * 0.58, W * 0.9, L * 0.78, W * 0.4, L * 0.8);
      s.bezierCurveTo(W * 0.3, L * 0.92, W * 0.1, L * 0.98, 0, L);
      s.bezierCurveTo(-W * 0.1, L * 0.98, -W * 0.3, L * 0.92, -W * 0.4, L * 0.8);
      s.bezierCurveTo(-W * 0.9, L * 0.78, -W * 1.2, L * 0.58, -W * 0.7, L * 0.5);
      s.bezierCurveTo(-W * 1.1, L * 0.46, -W * 1.35, L * 0.3, -W * 0.7, L * 0.24);
      s.bezierCurveTo(-W, L * 0.14, -W * 0.5, L * 0.05, 0, 0);
      break;
    }
    case 'maple': {
      const W = L * 0.5;
      s.moveTo(0, 0);
      s.lineTo(W * 0.18, L * 0.18);
      s.lineTo(W * 0.72, L * 0.12);
      s.lineTo(W * 0.52, L * 0.38);
      s.lineTo(W, L * 0.5);
      s.lineTo(W * 0.5, L * 0.58);
      s.lineTo(W * 0.5, L * 0.82);
      s.lineTo(W * 0.2, L * 0.72);
      s.lineTo(0, L);
      s.lineTo(-W * 0.2, L * 0.72);
      s.lineTo(-W * 0.5, L * 0.82);
      s.lineTo(-W * 0.5, L * 0.58);
      s.lineTo(-W, L * 0.5);
      s.lineTo(-W * 0.52, L * 0.38);
      s.lineTo(-W * 0.72, L * 0.12);
      s.lineTo(-W * 0.18, L * 0.18);
      s.lineTo(0, 0);
      break;
    }
    case 'aspen': {
      const W = L * 0.5;
      s.moveTo(0, 0);
      s.bezierCurveTo(W * 0.9, L * 0.08, W * 1.1, L * 0.5, W * 0.35, L * 0.85);
      s.lineTo(0, L);
      s.lineTo(-W * 0.35, L * 0.85);
      s.bezierCurveTo(-W * 1.1, L * 0.5, -W * 0.9, L * 0.08, 0, 0);
      break;
    }
    default: {
      const W = L * 0.36;
      s.moveTo(0, 0);
      s.bezierCurveTo(W * 1.2, L * 0.12, W * 1.2, L * 0.62, 0, L);
      s.bezierCurveTo(-W * 1.2, L * 0.62, -W * 1.2, L * 0.12, 0, 0);
    }
  }
  return s;
}

/** A flat leaf lying in the XZ plane (stem toward +Z), UVs spanning the whole shape for the vein texture. */
export function leafGeometry(kind: LeafKind, length = 0.1): BufferGeometry {
  const geo = new ShapeGeometry(leafShape(kind, length), 10);
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, (x - b.min.x) / (b.max.x - b.min.x), (y - b.min.y) / (b.max.y - b.min.y));
    // A little curl so the leaf is not a flat card: edges lift, the tip droops.
    pos.setZ(i, Math.abs(x) * 0.28 * (length * 3) * (1 - y / length) + (y / length) * (y / length) * -0.012);
  }
  geo.rotateX(-Math.PI / 2); // lie flat: shape +Y → world -Z (stem to +Z), curl → +Y
  geo.computeVertexNormals();
  return geo;
}

/** Veins and colour for a leaf (maps onto leafGeometry's bounding-box UVs). */
export function leafTexture(base: string, tip: string, vein: string): CanvasTexture {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, base);
    g.addColorStop(1, tip);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = vein;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.lineTo(w / 2, h * 0.04);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    for (let i = 1; i < 9; i++) {
      const y = h - (i / 9.5) * h;
      const len = w * 0.42 * (1 - Math.abs(i - 4) / 9);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w / 2, y + 6);
        ctx.quadraticCurveTo(w / 2 + dir * len * 0.5, y - 10, w / 2 + dir * len, y - 34);
        ctx.stroke();
      }
    }
  });
}

/** Draws a leaf outline with its veins onto a 2D context (used for the print left in salted dough). */
export function drawLeafImprint(ctx: CanvasRenderingContext2D, kind: LeafKind, cx: number, cy: number, size: number, rotation: number, color: string): void {
  const shape = leafShape(kind, 1);
  const pts = shape.getPoints(24);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(size, -size);
  ctx.translate(0, -0.5);
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 0.96);
  for (let i = 1; i < 7; i++) {
    const y = i * 0.13;
    const len = 0.2 * (1 - Math.abs(i - 3) / 7);
    ctx.moveTo(0, y);
    ctx.lineTo(len, y + 0.13);
    ctx.moveTo(0, y);
    ctx.lineTo(-len, y + 0.13);
  }
  ctx.stroke();
  ctx.restore();
}

// ── food and craft ────────────────────────────────────────────────────────────

/** Salted dough: warm cream with fine speckles of salt and flour. */
export function doughTexture(): CanvasTexture {
  const rnd = mulberry32(5);
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e9d9b6';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,248,.45)' : 'rgba(150,115,70,.16)';
      const r = 0.6 + rnd() * 1.6;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A dried orange slice seen from above: translucent segments around a pale core. */
export function orangeTexture(): CanvasTexture {
  return canvasTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    const rind = ctx.createRadialGradient(c, c, c * 0.78, c, c, c);
    rind.addColorStop(0, '#f0a43a');
    rind.addColorStop(1, '#c4561a');
    ctx.fillStyle = rind;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7c46a';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.84, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2 + 0.05;
      const a1 = ((i + 1) / 10) * Math.PI * 2 - 0.05;
      const g = ctx.createRadialGradient(c, c, 8, c, c, c * 0.8);
      g.addColorStop(0, '#fbd58a');
      g.addColorStop(1, '#ee9a2a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c * 0.8, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fbe7b6';
    ctx.beginPath();
    ctx.arc(c, c, 11, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── signs ─────────────────────────────────────────────────────────────────────

/** A painted wooden trail sign: planks, a carved-in title and a smaller line under it. */
export function signTexture(title: string, sub: string | null, accent: string, w = 1024, h = 320): CanvasTexture {
  const rnd = mulberry32(title.length * 31 + 7);
  return canvasTexture(w, h, (ctx) => {
    const wood = ctx.createLinearGradient(0, 0, 0, h);
    wood.addColorStop(0, '#7a4f2f');
    wood.addColorStop(1, '#5d3a22');
    ctx.fillStyle = wood;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '40,22,10' : '160,110,70'},${0.08 + rnd() * 0.14})`;
      ctx.lineWidth = 1 + rnd() * 2;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 14, w * 0.7, y + (rnd() - 0.5) * 14, w, y + (rnd() - 0.5) * 10);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(30,16,8,.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 7;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fit = (text: string, size: number, weight: string): void => {
      let px = size;
      ctx.font = `${weight} ${px}px "Cormorant Garamond", Georgia, serif`;
      while (ctx.measureText(text).width > w - 120 && px > 20) {
        px -= 4;
        ctx.font = `${weight} ${px}px "Cormorant Garamond", Georgia, serif`;
      }
    };
    fit(title, 112, '700');
    const ty = sub ? h * 0.4 : h * 0.5;
    ctx.fillStyle = 'rgba(25,12,5,.7)';
    ctx.fillText(title, w / 2 + 3, ty + 4);
    ctx.fillStyle = '#f6e7c3';
    ctx.fillText(title, w / 2, ty);
    if (sub) {
      fit(sub, 54, '600');
      ctx.fillStyle = accent;
      ctx.fillText(sub, w / 2, h * 0.74);
    }
  });
}

// ── scent wheel ───────────────────────────────────────────────────────────────

export interface WheelSector {
  label: string;
  color: string;
}

/** The scent wheel face: five painted sectors, each with the name of a family of natural smells. */
export function wheelTexture(sectors: readonly WheelSector[]): CanvasTexture {
  return canvasTexture(512, 512, (ctx, w) => {
    const c = w / 2;
    const n = sectors.length;
    sectors.forEach((s, i) => {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c - 14, a0, a1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,18,8,.65)';
      ctx.lineWidth = 6;
      ctx.stroke();
      const mid = (a0 + a1) / 2;
      ctx.save();
      ctx.translate(c + Math.cos(mid) * c * 0.6, c + Math.sin(mid) * c * 0.6);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = 'rgba(25,14,6,.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 40px "Cormorant Garamond", Georgia, serif';
      ctx.fillText(s.label, 0, 0);
      ctx.restore();
    });
    ctx.strokeStyle = '#5d3a22';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(c, c, c - 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#3d2615';
    ctx.beginPath();
    ctx.arc(c, c, 26, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── touch panel swatches ─────────────────────────────────────────────────────

export type Swatch = 'bark' | 'cones' | 'moss' | 'sand' | 'wood';

/** The five natural materials of the sensory trail, drawn as seamless swatches for the touch panel. */
export function swatchTexture(kind: Swatch): CanvasTexture {
  const rnd = mulberry32(kind.length * 977 + kind.charCodeAt(0));
  return canvasTexture(256, 256, (ctx, w, h) => {
    switch (kind) {
      case 'bark':
        ctx.fillStyle = '#5b4030';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 70; i++) {
          ctx.strokeStyle = `rgba(${rnd() > 0.45 ? '28,18,12' : '130,98,70'},${0.25 + rnd() * 0.4})`;
          ctx.lineWidth = 2 + rnd() * 6;
          const x = rnd() * w;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + (rnd() - 0.5) * 40, h * 0.3, x + (rnd() - 0.5) * 40, h * 0.7, x + (rnd() - 0.5) * 20, h);
          ctx.stroke();
        }
        break;
      case 'cones':
        ctx.fillStyle = '#6a4a2c';
        ctx.fillRect(0, 0, w, h);
        for (let y = -10; y < h + 20; y += 26) {
          for (let x = -10; x < w + 20; x += 34) {
            const ox = ((y / 26) % 2) * 17;
            ctx.fillStyle = rnd() > 0.5 ? '#8a6238' : '#7a5530';
            ctx.beginPath();
            ctx.ellipse(x + ox, y, 17, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(30,18,8,.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        break;
      case 'moss':
        ctx.fillStyle = '#4c7a2e';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2400; i++) {
          ctx.fillStyle = `hsla(${88 + rnd() * 30},${45 + rnd() * 25}%,${22 + rnd() * 24}%,.7)`;
          ctx.beginPath();
          ctx.arc(rnd() * w, rnd() * h, 1.5 + rnd() * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'sand':
        ctx.fillStyle = '#d8c08e';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 3500; i++) {
          ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,240,205,.7)' : 'rgba(150,120,80,.5)';
          ctx.fillRect(rnd() * w, rnd() * h, 1.6, 1.6);
        }
        break;
      default:
        ctx.fillStyle = '#c99a62';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) {
          ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '110,70,36' : '230,190,140'},${0.2 + rnd() * 0.3})`;
          ctx.lineWidth = 1 + rnd() * 3;
          const y = rnd() * h;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(w * 0.3, y + 12, w * 0.7, y - 12, w, y + (rnd() - 0.5) * 18);
          ctx.stroke();
        }
    }
  });
}

/** A glowing hand-print for the touch panel's reward. */
export function handprintTexture(color: string): Texture {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.62, w * 0.17, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    const fingers: Array<[number, number, number, number]> = [
      [-0.2, 0.34, 0.045, 0.14],
      [-0.09, 0.26, 0.045, 0.17],
      [0.03, 0.24, 0.045, 0.18],
      [0.14, 0.29, 0.045, 0.16],
      [0.27, 0.5, 0.05, 0.11],
    ];
    for (const [dx, dy, rx, ry] of fingers) {
      ctx.beginPath();
      ctx.ellipse(w / 2 + dx * w, dy * h + ry * h * 0.5, rx * w, ry * h, dx > 0.2 ? 0.7 : dx * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
