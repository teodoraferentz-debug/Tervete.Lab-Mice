import {
  AdditiveBlending,
  Box3,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import type { Guardian, Sense } from '../../content/guardians';
import { mulberry32 } from '../util';
import { loadModel } from './loaders';
import { canvasTexture, signTexture } from './procedural';
import { contactShadow, glowSprite, mesh, planks, shadowTexture } from './propKit';

const HEIGHT = 1.25;

/** The sense emblem painted on the totem's roundel. */
function emblem(sense: Sense, color: string): Texture {
  return canvasTexture(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#3a2416';
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, c - 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#f6e7c3';
    ctx.fillStyle = '#f6e7c3';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    switch (sense) {
      case 'sight': {
        ctx.beginPath();
        ctx.moveTo(110, c);
        ctx.quadraticCurveTo(c, 150, 402, c);
        ctx.quadraticCurveTo(c, 362, 110, c);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c, c, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1b1008';
        ctx.beginPath();
        ctx.arc(c, c, 26, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'hearing': {
        ctx.beginPath();
        ctx.arc(c, c - 12, 100, Math.PI * 0.95, Math.PI * 2.1);
        ctx.bezierCurveTo(c + 108, c + 50, c + 40, c + 70, c + 30, c + 130);
        ctx.bezierCurveTo(c + 20, c + 185, c - 70, c + 175, c - 62, c + 110);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c + 6, c - 16, 46, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
        break;
      }
      case 'taste': {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(c, c, 118, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3a2416';
        ctx.lineWidth = 10;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(c, c);
          ctx.lineTo(c + Math.cos(a) * 118, c + Math.sin(a) * 118);
          ctx.stroke();
        }
        break;
      }
      case 'smell': {
        ctx.beginPath();
        for (let t = 0; t < 4.2 * Math.PI; t += 0.08) {
          const r = 12 + t * 15;
          const x = c + Math.cos(t) * r;
          const y = c + Math.sin(t) * r;
          if (t === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      }
      default: {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(c, c + 58, 84, 94, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const [dx, dy, a] of [
          [-92, -46, -0.35],
          [-44, -92, -0.12],
          [8, -104, 0],
          [60, -88, 0.14],
          [104, -10, 0.9],
        ] as const) {
          ctx.save();
          ctx.translate(c + dx, c + dy);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.ellipse(0, 0, 22, 56, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  });
}

/**
 * The guardian's stand-in in the clearing: a carved wooden post with a painted sense emblem and its name
 * (provisional: the real mascots arrive as GLB models). When `models/mascots/<id>.glb` exists it replaces
 * the post, scaled to a child's height, so dropping the file in is all it takes.
 */
export class Totem {
  readonly group = new Group();
  private readonly post = new Group();
  private readonly halo: Sprite;
  private model: Object3D | null = null;
  private level = 0;

  constructor(
    private readonly guardian: Guardian,
    glow: Texture,
  ) {
    const wood = planks('#c9ab88', 0.5, 2.2);
    // Trunk: a sawn log, thicker at the base, with a rounded cap
    this.post.add(mesh(new CylinderGeometry(0.15, 0.2, HEIGHT, 14, 1), wood, 0, HEIGHT / 2, 0));
    this.post.add(mesh(new CylinderGeometry(0.0, 0.15, 0.12, 14), wood, 0, HEIGHT + 0.06, 0));
    // Roundel with the emblem, facing the player
    const roundel = new Mesh(
      new PlaneGeometry(0.4, 0.4),
      new MeshStandardMaterial({ map: emblem(guardian.sense, guardian.themeColor), roughness: 0.8, transparent: true, side: DoubleSide }),
    );
    roundel.position.set(0, HEIGHT * 0.72, 0.178);
    roundel.castShadow = true;
    this.post.add(roundel);
    // Name plaque
    const plaque = new Mesh(
      new PlaneGeometry(0.34, 0.1),
      new MeshStandardMaterial({ map: signTexture(guardian.name.toUpperCase(), guardian.senseLabel, guardian.themeColor, 768, 224), roughness: 0.85 }),
    );
    plaque.position.set(0, HEIGHT * 0.36, 0.205);
    this.post.add(plaque);
    // A few moss patches and a root ring at the foot ground the post in the clearing
    const rnd = mulberry32(guardian.name.length * 13);
    const moss = new MeshStandardMaterial({ color: '#4f7a31', roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      const m = mesh(new CylinderGeometry(0.05 + rnd() * 0.05, 0.07, 0.03, 7), moss, Math.sin(a) * 0.18, 0.015, Math.cos(a) * 0.18, false);
      this.post.add(m);
    }
    this.group.add(this.post, contactShadow(shadowTexture(), 0.9, 0.9, 0.55));
    this.halo = glowSprite(glow, guardian.themeColor, 0.9, 0);
    this.halo.position.set(0, HEIGHT * 0.72, 0.22);
    this.group.add(this.halo);
    void this.tryLoadModel();
  }

  private async tryLoadModel(): Promise<void> {
    const source = await loadModel(`mascots/${this.guardian.id}`);
    if (!source) return;
    const model = source.clone(true);
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    const k = 1.15 / Math.max(0.001, size.y);
    model.scale.setScalar(k);
    box.setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const holder = new Group();
    holder.add(model);
    this.model = holder;
    this.group.add(holder);
    this.post.visible = false;
    this.halo.position.set(0, 0.8, 0.3);
  }

  /** Breathes gently; glows while the guardian speaks. */
  update(time: number, motion: number, speaking: boolean): void {
    const goal = speaking ? 1 : 0;
    this.level += (goal - this.level) * 0.12;
    (this.halo.material as SpriteMaterial).opacity = 0.12 * (1 + Math.sin(time * 1.6) * 0.25 * motion) + this.level * 0.7;
    this.halo.material.blending = AdditiveBlending;
    const bob = Math.sin(time * 1.3) * 0.006 * motion;
    this.post.position.y = bob;
    if (this.model) this.model.position.y = bob;
  }
}
