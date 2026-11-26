import { CanvasTexture, DoubleSide, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Vector2 } from 'three';

export interface PanelButton {
  id: string;
  label: string;
  /** Pixel rectangle on the panel canvas. */
  x: number;
  y: number;
  w: number;
  h: number;
  primary?: boolean;
  disabled?: boolean;
}

const FONT = '"Franklin Gothic Medium","Segoe UI",system-ui,sans-serif';
const SERIF = 'Georgia,"Times New Roman",serif';

/** Wraps text to a pixel width. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A flat panel in the headset drawn with Canvas 2D: captions, prompts, menus. The page's HTML is not
 * visible inside a headset, so every piece of UI the wearer needs is drawn like this.
 */
export class CanvasPanel {
  readonly mesh: Mesh;
  readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  buttons: PanelButton[] = [];
  hover: string | null = null;
  private key = '';

  constructor(
    readonly widthM: number,
    readonly heightM: number,
    readonly pxW: number,
    readonly pxH: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = pxW;
    this.canvas.height = pxH;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.mesh = new Mesh(
      new PlaneGeometry(widthM, heightM),
      new MeshBasicMaterial({ map: this.texture, transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false }),
    );
    this.mesh.renderOrder = 1000;
    this.mesh.userData.panel = this;
  }

  /** Redraws only when `key` changes, so a still panel costs nothing per frame. */
  redraw(key: string, draw: (ctx: CanvasRenderingContext2D, panel: CanvasPanel) => void): void {
    if (key === this.key) return;
    this.key = key;
    this.ctx.clearRect(0, 0, this.pxW, this.pxH);
    this.buttons = [];
    draw(this.ctx, this);
    this.texture.needsUpdate = true;
  }

  invalidate(): void {
    this.key = '';
  }

  /** The button under a point given as a texture coordinate (u right, v up), if any. */
  buttonAt(uv: Vector2): PanelButton | null {
    const x = uv.x * this.pxW;
    const y = (1 - uv.y) * this.pxH;
    return this.buttons.find((b) => !b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) ?? null;
  }

  // ── drawing helpers ──────────────────────────────────────────────────────

  roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  card(fill: string, border: string): void {
    this.roundRect(4, 4, this.pxW - 8, this.pxH - 8, 36);
    this.ctx.fillStyle = fill;
    this.ctx.fill();
    this.ctx.lineWidth = 5;
    this.ctx.strokeStyle = border;
    this.ctx.stroke();
  }

  addButton(b: PanelButton): void {
    this.buttons.push(b);
    const { ctx } = this;
    const hovered = this.hover === b.id && !b.disabled;
    this.roundRect(b.x, b.y, b.w, b.h, Math.min(28, b.h / 2));
    ctx.fillStyle = b.disabled ? 'rgba(255,255,255,.06)' : b.primary ? (hovered ? '#f6c63c' : '#e2aa18') : hovered ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.12)';
    ctx.fill();
    ctx.lineWidth = hovered ? 5 : 3;
    ctx.strokeStyle = b.primary ? '#8a6410' : 'rgba(255,255,255,.35)';
    ctx.stroke();
    ctx.fillStyle = b.disabled ? 'rgba(255,255,255,.4)' : b.primary ? '#1b1300' : '#f9f2de';
    ctx.font = `600 ${Math.round(b.h * 0.42)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2, b.w - 24);
  }
}

export const FONTS = { sans: FONT, serif: SERIF };
