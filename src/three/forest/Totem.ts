import {
  AdditiveBlending,
  Box3,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import type { Interactable } from './interaction';
import type { Guardian, Sense } from '../../content/guardians';
import { mulberry32 } from '../util';
import { buildMascot3D } from './mascots3d';
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

/** Parts of a mascot model that move, found by the node names the model's author gave them. */
interface Rig {
  mouth: Object3D | null;
  mouthOpen: Object3D | null;
  smile: Object3D | null;
  eyes: Object3D[];
  arms: Object3D[];
  head: Object3D | null;
  caps: Object3D[];
  body: Object3D | null;
  feet: Object3D[];
  base: Map<Object3D, { y: number; sx: number; sy: number; rz: number }>;
}

/**
 * The guardian in the clearing. When `models/mascots/<id>.glb` exists it is the real mascot, scaled to a
 * child's height, and it is alive: it blinks, sways, moves its mouth while its voice plays, waves and hops
 * when you point at it and press. Otherwise (until its model arrives) a carved wooden post with the sense
 * emblem stands there and glows while the guardian speaks.
 */
export class Totem {
  readonly group = new Group();
  /** Pointing at the guardian and pressing makes it say hello. */
  readonly item: Interactable;
  private readonly post = new Group();
  private readonly halo: Sprite;
  private model: Group | null = null;
  private rig: Rig | null = null;
  private level = 0;
  private speakUntil = -1;
  private reactAt = -10;
  private reactNext = false;
  /** Called when the guardian is poked: the scene plays its greeting. */
  onPoke: (() => void) | null = null;

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
    // A few moss patches at the foot ground the post in the clearing
    const rnd = mulberry32(guardian.name.length * 13);
    const moss = new MeshStandardMaterial({ color: '#4f7a31', roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      this.post.add(mesh(new CylinderGeometry(0.05 + rnd() * 0.05, 0.07, 0.03, 7), moss, Math.sin(a) * 0.18, 0.015, Math.cos(a) * 0.18, false));
    }
    this.group.add(this.post, contactShadow(shadowTexture(), 0.9, 0.9, 0.55));
    this.halo = glowSprite(glow, guardian.themeColor, 0.9, 0);
    this.halo.position.set(0, HEIGHT * 0.72, 0.22);
    this.group.add(this.halo);

    // An invisible body to point at: it exists from the start, so the pointer system always finds it.
    const hit = new Mesh(new CylinderGeometry(0.4, 0.4, 1.4, 10), new MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.7;
    this.group.add(hit);
    this.item = {
      id: 'guardian',
      object: this.group,
      kind: 'press',
      label: `Say hello to ${guardian.name}`,
      accent: guardian.themeColor,
      onPress: () => this.poke(),
    };
    this.tryLoadModel();
  }

  private poke(): void {
    this.reactNext = true;
    this.onPoke?.();
  }

  private tryLoadModel(): void {
    const model = buildMascot3D(this.guardian.id);
    if (!model) return; // no illustration modelled yet: the carved post stays
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    // Scale to a child's height; the cap and the held object are part of the model
    const k = 1.4 / Math.max(0.001, size.y);
    model.scale.setScalar(k);
    box.setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    const holder = new Group();
    holder.add(model);
    this.model = holder;
    this.rig = this.findRig(model);
    this.group.add(holder);
    this.post.visible = false;
    this.halo.position.set(0, 0.85, 0.35);
  }

  private findRig(root: Object3D): Rig {
    const rig: Rig = { mouth: null, mouthOpen: null, smile: null, eyes: [], arms: [], head: null, caps: [], body: null, feet: [], base: new Map() };
    root.traverse((o) => {
      const n = o.name.toLowerCase();
      if (n === 'mouthopen') rig.mouthOpen = o;
      else if (n === 'smile') rig.smile = o;
      else if (n === 'mouth') rig.mouth = o;
      else if (n.startsWith('eye')) rig.eyes.push(o);
      else if (n.startsWith('arm')) rig.arms.push(o);
      else if (n === 'head') rig.head = o;
      else if (n.startsWith('cap')) rig.caps.push(o);
      else if (n === 'body') rig.body = o;
      else if (n.startsWith('foot')) rig.feet.push(o);
      else return;
      rig.base.set(o, { y: o.position.y, sx: o.scale.x, sy: o.scale.y, rz: o.rotation.z });
    });
    return rig;
  }

  /** The guardian's voice starts now and lasts about `seconds` (the mouth moves for that long). */
  speak(time: number, seconds: number): void {
    this.speakUntil = time + seconds;
  }

  /** Resets the pose for a fresh scene. */
  reset(): void {
    this.speakUntil = -1;
    this.reactAt = -10;
    this.reactNext = false;
  }

  update(time: number, motion: number): void {
    if (this.reactNext) {
      this.reactNext = false;
      this.reactAt = time;
    }
    const talking = time < this.speakUntil;
    const react = time - this.reactAt;
    const goal = talking ? 1 : 0;
    this.level += (goal - this.level) * 0.12;
    (this.halo.material as SpriteMaterial).opacity = 0.1 * (1 + Math.sin(time * 1.6) * 0.25 * motion) + this.level * 0.55;
    this.halo.material.blending = AdditiveBlending;
    const bob = Math.sin(time * 1.3) * 0.006 * motion;
    // A hop when poked: up and back down over 0.55 s
    const hop = react >= 0 && react < 0.55 ? Math.sin((react / 0.55) * Math.PI) * 0.16 * motion : 0;
    this.post.position.y = bob + hop * 0.5;
    this.post.rotation.z = talking && !this.model ? Math.sin(time * 9) * 0.015 * motion : 0;
    if (this.model) this.model.position.y = bob + hop;

    const rig = this.rig;
    if (!rig) return;
    const at = (o: Object3D) => rig.base.get(o)!;
    // Mouth: a smile at rest; while the voice plays it opens and closes in time with the syllables
    if (rig.mouthOpen && rig.smile) {
      const open = talking && motion ? 0.15 + Math.abs(Math.sin(time * 13 + Math.sin(time * 4.3))) * 0.85 : 0.001;
      rig.mouthOpen.scale.y = Math.max(0.001, open);
      rig.smile.visible = open < 0.18;
      rig.mouthOpen.visible = open >= 0.18;
    }
    // Blink: eyes squeeze shut for a moment every few seconds
    const phase = (time * 0.27 + this.guardian.name.length * 0.3) % 1;
    const blink = motion && phase > 0.965 ? 0.12 : 1;
    for (const e of rig.eyes) e.scale.y = at(e).sy * blink;
    // Arms sway; the right one waves after a poke
    rig.arms.forEach((arm, i) => {
      const b = at(arm);
      const sway = Math.sin(time * 1.5 + i * 2) * 0.05 * motion;
      const wave = react >= 0 && react < 1.4 && i === 1 ? Math.sin(react * 14) * 0.35 + 0.9 : 0;
      arm.rotation.z = b.rz + sway + (i === 1 ? wave : 0) * motion;
    });
    // Head and cap nod along with the voice
    const nod = talking && motion ? Math.sin(time * 9) * 0.035 : Math.sin(time * 0.9) * 0.008 * motion;
    for (const o of [rig.head, ...rig.caps]) if (o) o.position.y = at(o).y + nod;
    if (rig.body) rig.body.scale.y = at(rig.body).sy * (1 + (hop > 0.01 ? 0.02 : Math.sin(time * 1.3) * 0.006 * motion));
    // Feet stay planted while the body hops
    for (const f of rig.feet) f.position.y = at(f).y;
  }
}
