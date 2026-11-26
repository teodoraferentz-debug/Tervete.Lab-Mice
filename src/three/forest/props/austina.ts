import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { easeInOut } from '../../util';
import { canvasTexture, drawLeafImprint } from '../procedural';
import { buildTable, matte, mesh, onTable, planks, shadowTexture } from '../propKit';
import type { Cues, SceneCtx, SoundKind } from '../types';
import { BaseProps } from './base';
import { Gateway } from './dressing';

const TEAL = '#4fa3b5';
const S = 1.35;
const BAR_TINTS = ['#e07a5f', '#f2cc8f', '#e2aa18', '#81b29a', '#4fa3b5', '#6c8ebf', '#a67bc9', '#c9739b'];

type SourceKind = 'bird' | 'leaves' | 'wind';

/** A round badge with the symbol of a sound source (bird, rustling leaves, wind). */
function badge(kind: SourceKind, color: string) {
  return canvasTexture(128, 128, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = 'rgba(0,26,17,.82)';
    ctx.beginPath();
    ctx.arc(c, c, c - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#f6e7c3';
    ctx.fillStyle = '#f6e7c3';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    if (kind === 'bird') {
      ctx.beginPath();
      ctx.ellipse(c - 4, c + 4, 26, 18, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c + 20, c - 10, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c + 29, c - 12);
      ctx.lineTo(c + 42, c - 8);
      ctx.lineTo(c + 29, c - 4);
      ctx.fill();
      ctx.fillStyle = '#f6e7c3';
      ctx.beginPath();
      ctx.moveTo(c - 26, c + 8);
      ctx.lineTo(c - 46, c + 20);
      ctx.lineTo(c - 22, c + 18);
      ctx.fill();
    } else if (kind === 'leaves') {
      drawLeafImprint(ctx, 'birch', c - 12, c + 4, 52, -0.5, '#f6e7c3');
      drawLeafImprint(ctx, 'aspen', c + 16, c + 2, 44, 0.6, color);
    } else {
      for (let i = 0; i < 3; i++) {
        const y = c - 20 + i * 20;
        ctx.beginPath();
        ctx.moveTo(c - 36, y);
        ctx.bezierCurveTo(c - 10, y - 14, c + 10, y + 14, c + 32, y);
        ctx.stroke();
      }
    }
  });
}

interface Ripple {
  mesh: Mesh;
  age: number;
  life: number;
  grow: number;
}

/**
 * Austiņa · Fairy Tale Forest: wooden instruments to play (a xylophone and claves) and the sounds of the
 * forest to find (birds, leaves, wind). The moment layers them into glowing rings above the forest.
 */
export class AustinaProps extends BaseProps {
  private readonly gateway: Gateway;
  private readonly bars: Array<{ mesh: Mesh; base: number; hit: number }> = [];
  private readonly claves: Array<{ mesh: Mesh; base: number }> = [];
  private clavesHit = 0;
  private readonly sources: Array<{ obj: Group; sprite: Sprite; kind: SourceKind; phase: number }> = [];
  private readonly ripples: Ripple[] = [];
  private readonly aura: Mesh[] = [];
  private arpeggio = -1;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.gateway = new Gateway(ctx.glow, 'PASAKU MEŽS', 'Austiņa · Hearing', TEAL);
    this.group.add(this.gateway.group, buildTable(shadowTexture()));

    // ── xylophone ─────────────────────────────────────────────────────────────
    const xylo = new Group();
    xylo.position.copy(onTable(-0.22, 0.02, 0.0));
    xylo.scale.setScalar(S);
    const railMat = planks('#bf9d78', 0.4, 0.3);
    for (const z of [-0.09, 0.09]) xylo.add(mesh(new BoxGeometry(0.66, 0.025, 0.028), railMat, 0, 0.0125, z));
    BAR_TINTS.forEach((tint, i) => {
      const len = 0.34 - i * 0.021;
      const bar = mesh(new RoundedBoxGeometry(0.062, 0.022, len, 2, 0.006), planks(tint, 0.3, 0.8), -0.2625 + i * 0.075, 0.037, 0);
      xylo.add(bar);
      this.bars.push({ mesh: bar, base: 0.037, hit: 0 });
      const id = `bar-${i}`;
      this.add({
        id,
        object: bar,
        kind: 'press',
        label: 'Wooden bar: play me',
        accent: TEAL,
        onPress: () => this.strike(i),
      });
    });
    // two mallets resting beside it
    for (const k of [0, 1]) {
      const mallet = new Group();
      mallet.add(mesh(new CylinderGeometry(0.004, 0.004, 0.2, 8), planks('#e3c9a6', 0.2, 0.5), 0, 0, 0).rotateZ(Math.PI / 2));
      mallet.add(mesh(new SphereGeometry(0.016, 12, 8), matte('#c4452f', 0.7), 0.1, 0, 0));
      mallet.position.set(-0.3 + k * 0.5, 0.03, 0.2);
      mallet.rotation.y = 0.25 - k * 0.5;
      xylo.add(mallet);
    }
    this.group.add(xylo);
    this.appear(xylo, 0.2);

    // ── claves ────────────────────────────────────────────────────────────────
    const claves = new Group();
    claves.position.copy(onTable(0.5, 0.1, 0));
    claves.scale.setScalar(S);
    for (const z of [-0.03, 0.03]) {
      const stick = mesh(new CylinderGeometry(0.014, 0.014, 0.22, 14), planks('#d8b48a', 0.2, 0.6), 0, 0.016, z);
      stick.rotation.z = Math.PI / 2;
      claves.add(stick);
      this.claves.push({ mesh: stick, base: 0.016 });
    }
    claves.rotation.y = 0.4;
    this.group.add(claves);
    this.appear(claves, 0.9);
    this.add({
      id: 'claves',
      object: claves,
      kind: 'press',
      label: 'Claves: tap them',
      accent: TEAL,
      onPress: () => {
        this.clavesHit = 0.0001;
        this.ctx.sound('knock');
        this.ripple(claves.getWorldPosition(new Vector3()), 0.5, TEAL);
      },
    });

    // ── the sounds of the forest, found by pointing ───────────────────────────
    const spots: Array<[SourceKind, Vector3, string, SoundKind, string]> = [
      ['bird', new Vector3(-1.45, 1.75, -2.55), '#f0a43a', 'chirp', 'Birds above'],
      ['leaves', new Vector3(0.1, 2.0, -2.8), '#9bc27a', 'rustle', 'Leaves rustling'],
      ['wind', new Vector3(1.55, 1.55, -2.45), '#9ad7e6', 'whoosh', 'Wind passing through'],
    ];
    spots.forEach(([kind, at, color, sound, label], i) => {
      const g = new Group();
      g.position.copy(at);
      const sprite = new Sprite(new SpriteMaterial({ map: badge(kind, color), transparent: true, depthWrite: false, fog: false }));
      sprite.scale.setScalar(0.34);
      g.add(sprite);
      const hit = new Mesh(new SphereGeometry(0.24, 10, 8), new MeshBasicMaterial({ visible: false }));
      g.add(hit);
      this.group.add(g);
      this.sources.push({ obj: g, sprite, kind, phase: i * 2.1 });
      this.appear(g, 3 + i * 2);
      this.add({
        id: `source-${kind}`,
        object: g,
        kind: 'press',
        label,
        accent: color,
        onPress: () => {
          this.ctx.sound(sound, i);
          this.ripple(at.clone(), 1, color);
        },
      });
    });

    // rings of layered sound (revealed at the moment)
    ['#f0a43a', '#9bc27a', '#9ad7e6'].forEach((c, i) => {
      const ringMesh = new Mesh(new TorusGeometry(0.55 + i * 0.22, 0.012, 8, 56), new MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }));
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.set(0, 1.55 + i * 0.28, -1.15);
      this.aura.push(ringMesh);
      this.group.add(ringMesh);
    });
    // ripple pool
    for (let i = 0; i < 8; i++) {
      const r = new Mesh(new RingGeometry(0.9, 1, 40), new MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }));
      r.visible = false;
      this.ripples.push({ mesh: r, age: 0, life: 0, grow: 0 });
      this.group.add(r);
    }
  }

  private strike(i: number): void {
    const bar = this.bars[i]!;
    bar.hit = 0.0001;
    this.ctx.sound('note', i);
    this.ripple(bar.mesh.getWorldPosition(new Vector3()).add(new Vector3(0, 0.04, 0)), 0.35, BAR_TINTS[i]!);
  }

  /** A ring of light spreading from a point (faces the player). */
  private ripple(at: Vector3, size: number, color: string): void {
    const r = this.ripples.find((x) => x.life === 0) ?? this.ripples[0]!;
    r.mesh.position.copy(this.group.worldToLocal(at.clone()));
    r.mesh.rotation.set(0, 0, 0);
    r.mesh.scale.setScalar(0.05);
    (r.mesh.material as MeshBasicMaterial).color.set(color);
    r.mesh.visible = true;
    r.age = 0;
    r.life = 1.2;
    r.grow = size;
  }

  protected tick(t: number, cues: Cues, time: number, motion: number): void {
    this.gateway.update(time, motion);
    const dt = 1 / 60;
    for (const b of this.bars) {
      if (b.hit > 0) {
        b.hit += dt;
        b.mesh.position.y = b.base - Math.sin(Math.min(1, b.hit / 0.18) * Math.PI) * 0.007;
        if (b.hit > 0.4) {
          b.hit = 0;
          b.mesh.position.y = b.base;
        }
      }
    }
    if (this.clavesHit > 0) {
      this.clavesHit += dt;
      const k = Math.sin(Math.min(1, this.clavesHit / 0.2) * Math.PI);
      this.claves[0]!.mesh.position.z = -0.03 + k * 0.016;
      this.claves[1]!.mesh.position.z = 0.03 - k * 0.016;
      if (this.clavesHit > 0.4) {
        this.clavesHit = 0;
        this.claves[0]!.mesh.position.z = -0.03;
        this.claves[1]!.mesh.position.z = 0.03;
      }
    }
    for (const r of this.ripples) {
      if (r.life === 0) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) {
        r.life = 0;
        r.mesh.visible = false;
        continue;
      }
      r.mesh.scale.setScalar(0.05 + k * r.grow);
      (r.mesh.material as MeshBasicMaterial).opacity = (1 - k) * 0.8;
    }
    // sound-source badges bob gently so they invite a point
    for (const s of this.sources) {
      const k = 1 + Math.sin(time * 2.2 + s.phase) * 0.08 * motion;
      s.sprite.scale.setScalar(0.34 * k);
    }

    // The moment: the three sounds layer into rings above the forest, and a short phrase plays
    const moment = cues.moment ?? Infinity;
    const k = motion ? Math.min(1, Math.max(0, (t - moment) / 1.6)) : t >= moment ? 1 : 0;
    const e = easeInOut(k);
    this.aura.forEach((ringMesh, i) => {
      const pulse = 1 + Math.sin(time * 1.6 - i * 0.9) * 0.06 * motion;
      ringMesh.scale.setScalar((0.6 + e * 0.4) * pulse);
      (ringMesh.material as MeshBasicMaterial).opacity = e * (0.55 + Math.sin(time * 2 - i) * 0.15 * motion);
    });
    if (t >= moment && this.arpeggio < 0) {
      this.arpeggio = 0;
      [0, 2, 4].forEach((n, i) => setTimeout(() => this.ctx.sound('note', n + i), i * 380));
    }
  }

  protected onReset(): void {
    this.arpeggio = -1;
    this.clavesHit = 0;
    for (const b of this.bars) {
      b.hit = 0;
      b.mesh.position.y = b.base;
    }
    for (const r of this.ripples) {
      r.life = 0;
      r.mesh.visible = false;
    }
    this.aura.forEach((a) => ((a.material as MeshBasicMaterial).opacity = 0));
  }
}
