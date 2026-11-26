import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three';
import { easeInOut } from '../../util';
import { orangeTexture } from '../procedural';
import { buildTable, cord, glowSprite, matte, mesh, onTable, planks, shadowTexture } from '../propKit';
import type { Interactable } from '../interaction';
import type { Cues, SceneCtx } from '../types';
import { BaseProps, tableSpot } from './base';
import { Gateway } from './dressing';

const ORANGE = '#e8743b';
const S = 1.5;
const SLOTS = 7;
/** Half-width and sag of the string between its two pegs (scene metres). */
const SPAN = 0.5;
const SAG = 0.13;

interface Bead {
  item: Interactable;
  obj: Group;
  mat: MeshStandardMaterial[];
  slot: number;
  attached: boolean;
}

/**
 * Odziņa · Gnome Forest: dried orange slices, forest berries and nuts to thread into a necklace. You pick a
 * bead up and let go near the string; at the story's moment the rest thread themselves and the finished
 * necklace rises and glows. (The tasting itself is never shown: only the necklace from the brief.)
 */
export class OdzinaProps extends BaseProps {
  private readonly gateway: Gateway;
  private readonly beads: Bead[] = [];
  private readonly neck = new Group();
  private readonly glows: Sprite[] = [];
  private readonly slotLocal: Vector3[] = [];
  private riseStart: number | null = null;
  private autoNext = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.gateway = new Gateway(ctx.glow, 'RŪĶĪŠU MEŽS', 'Odziņa · Taste', ORANGE);
    this.group.add(this.gateway.group, buildTable(shadowTexture()));

    // pegs and string
    const centre = onTable(0, -0.12, 0);
    this.neck.position.copy(centre);
    const wood = planks('#d4b690', 0.3, 1);
    for (const sx of [-1, 1]) {
      this.neck.add(mesh(new CylinderGeometry(0.014, 0.018, 0.34, 10), wood, sx * (SPAN + 0.03), 0.17, 0));
      this.neck.add(mesh(new SphereGeometry(0.022, 10, 8), wood, sx * (SPAN + 0.03), 0.345, 0));
    }
    const pts: Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      pts.push(this.stringPoint(u));
    }
    this.neck.add(cord(pts, 0.0028, '#cdb88a', 40));
    for (let i = 0; i < SLOTS; i++) this.slotLocal.push(this.stringPoint((i + 1) / (SLOTS + 1)));
    this.group.add(this.neck);
    this.appear(this.neck, 0.2);

    // beads: 3 orange slices, 2 berry clusters, 2 nuts
    const orange = orangeTexture();
    const makers: Array<{ name: string; make: () => { obj: Group; mats: MeshStandardMaterial[] } }> = [];
    for (let i = 0; i < 3; i++) {
      makers.push({
        name: 'Dried orange slice',
        make: () => {
          const g = new Group();
          const m = new MeshStandardMaterial({ map: orange, roughness: 0.7, emissive: '#000000', color: '#ffe2b0' });
          const rim = new MeshStandardMaterial({ color: '#c4561a', roughness: 0.8, emissive: '#000000' });
          const disc = new Mesh(new CylinderGeometry(0.045, 0.045, 0.009, 28), [rim, m, m]);
          disc.castShadow = true;
          disc.position.y = 0.0045;
          g.add(disc);
          return { obj: g, mats: [m, rim] };
        },
      });
    }
    ['#b3263e', '#3b4a8c'].forEach((c) =>
      makers.push({
        name: 'Forest berries',
        make: () => {
          const g = new Group();
          const m = new MeshStandardMaterial({ color: c, roughness: 0.4, emissive: '#000000' });
          for (const [x, z] of [[0, 0], [0.026, 0.01], [0.008, 0.028]] as const) g.add(mesh(new SphereGeometry(0.0155, 12, 10), m, x, 0.0155, z));
          return { obj: g, mats: [m] };
        },
      }),
    );
    for (let i = 0; i < 2; i++) {
      makers.push({
        name: 'Nut',
        make: () => {
          const g = new Group();
          const m = new MeshStandardMaterial({ color: '#9a6a3c', roughness: 0.65, emissive: '#000000' });
          const nut = mesh(new SphereGeometry(0.02, 14, 10), m, 0, 0.02, 0);
          nut.scale.set(1, 1.15, 1);
          g.add(nut);
          g.add(mesh(new SphereGeometry(0.0095, 8, 6), matte('#d9b98a', 0.8), 0, 0.04, 0, false));
          return { obj: g, mats: [m] };
        },
      });
    }
    makers.forEach((mk, i) => {
      const { obj, mats } = mk.make();
      obj.scale.setScalar(S);
      obj.position.copy(onTable(-0.66 + i * 0.22, 0.2 + (i % 2) * 0.04, 0));
      obj.rotation.y = i * 1.1;
      const bead: Bead = { item: null as unknown as Interactable, obj, mat: mats, slot: -1, attached: false };
      bead.item = this.add({
        id: `bead-${i}`,
        object: obj,
        kind: 'grab',
        label: mk.name,
        accent: ORANGE,
        enabled: () => this.isShown(obj) && bead.slot < 0,
        onGrab: () => {
          bead.item.hint = false;
          this.ctx.sound('pick');
        },
        onRelease: (w) => this.dropped(bead, w),
      });
      this.beads.push(bead);
      this.appear(obj, 0.8 + i * 0.22);
    });

    for (let i = 0; i < SLOTS; i++) {
      const s = glowSprite(ctx.glow, '#ffb25a', 0.22, 0);
      s.visible = false;
      this.glows.push(s);
      this.group.add(s);
    }
  }

  private stringPoint(u: number): Vector3 {
    const x = (u * 2 - 1) * SPAN;
    return new Vector3(x, 0.335 - SAG * (1 - (x / SPAN) ** 2), 0);
  }

  private slotPosition(slot: number, lift: number): Vector3 {
    return this.slotLocal[slot]!.clone().add(this.neck.position).add(new Vector3(0, lift, 0));
  }

  private nextFree(): number {
    for (let i = 0; i < SLOTS; i++) if (!this.beads.some((b) => b.slot === i)) return i;
    return -1;
  }

  /** Let go near the string and the bead threads on; elsewhere on the table it simply rests. */
  private dropped(bead: Bead, world: Vector3): boolean {
    const local = this.group.worldToLocal(world.clone());
    let best = -1;
    let bestD = 0.2;
    for (let i = 0; i < SLOTS; i++) {
      if (this.beads.some((b) => b.slot === i)) continue;
      const d = local.distanceTo(this.slotPosition(i, 0));
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      this.thread(bead, best);
      return true;
    }
    const spot = tableSpot(this.group, world, 0);
    if (!spot) return false;
    this.ctx.interaction.glide(bead.obj, spot, bead.obj.quaternion);
    this.ctx.sound('drop');
    return true;
  }

  private thread(bead: Bead, slot: number): void {
    bead.slot = slot;
    this.ctx.sound('tick');
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    this.ctx.interaction.glide(bead.obj, this.slotPosition(slot, 0).sub(new Vector3(0, 0.0, 0)), q, () => {
      bead.attached = true;
    });
  }

  protected tick(t: number, cues: Cues, time: number, motion: number): void {
    this.gateway.update(time, motion);
    const activity = cues.activity ?? Infinity;
    for (const b of this.beads) if (b.slot < 0) b.item.hint = t >= activity + 2.5 && this.isShown(b.obj);

    // The moment: the remaining beads thread themselves, one by one
    const moment = cues.moment ?? Infinity;
    if (t >= moment && this.autoNext >= 0) {
      const due = Math.floor((t - moment) / 0.35) + 1;
      while (this.autoNext < due) {
        const bead = this.beads.find((b) => b.slot < 0);
        const free = this.nextFree();
        if (!bead || free < 0) {
          this.autoNext = -1;
          break;
        }
        this.thread(bead, free);
        this.autoNext++;
      }
    }

    // Complete: the necklace lifts and glows
    const done = this.beads.filter((b) => b.slot >= 0).length >= SLOTS && this.beads.every((b) => b.slot < 0 || b.attached);
    if (done && this.riseStart === null) {
      this.riseStart = t;
      this.ctx.sound('chime', 1);
    }
    const k = this.riseStart === null ? 0 : motion ? Math.min(1, (t - this.riseStart) / 1.8) : 1;
    const e = easeInOut(k);
    const lift = 0.2 * e;
    this.neck.position.y = onTable(0, 0).y + lift;
    for (const b of this.beads) {
      if (b.attached) {
        b.obj.position.copy(this.slotPosition(b.slot, 0));
        b.obj.position.y = this.slotLocal[b.slot]!.y + this.neck.position.y;
      }
      for (const m of b.mat) {
        m.emissive.set('#ff9a3a');
        m.emissiveIntensity = e * (0.5 + Math.sin(time * 2.2 + b.slot) * 0.12 * motion);
      }
    }
    this.glows.forEach((g, i) => {
      g.visible = e > 0.02;
      const p = this.slotLocal[i]!;
      g.position.set(this.neck.position.x + p.x, this.neck.position.y + p.y, this.neck.position.z + p.z + 0.02);
      g.scale.setScalar(0.18 + 0.06 * Math.sin(time * 2.4 + i) * motion);
      (g.material as SpriteMaterial).opacity = e * 0.8;
    });
  }

  protected onReset(): void {
    this.riseStart = null;
    this.autoNext = 0;
    this.neck.position.copy(onTable(0, -0.12, 0));
    for (const b of this.beads) {
      b.slot = -1;
      b.attached = false;
      b.obj.quaternion.identity();
      b.obj.rotation.y = 0;
      for (const m of b.mat) m.emissiveIntensity = 0;
    }
    this.glows.forEach((g) => (g.visible = false));
  }
}
