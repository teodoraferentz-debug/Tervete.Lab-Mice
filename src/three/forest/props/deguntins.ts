import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Plane, Points, PointsMaterial, TorusGeometry, Vector3, type Ray } from 'three';
import { mulberry32 } from '../../util';
import { wheelTexture, type WheelSector } from '../procedural';
import { contactShadow, mesh, planks, shadowTexture } from '../propKit';
import type { Cues, SceneCtx } from '../types';
import { BaseProps } from './base';
import { Gateway } from './dressing';

const LAVENDER = '#a67bc9';
const SECTORS: WheelSector[] = [
  { label: 'Plants', color: '#7da545' },
  { label: 'Trees', color: '#3f7a52' },
  { label: 'Wood', color: '#b07a45' },
  { label: 'Leaves', color: '#d6b232' },
  { label: 'Moss', color: '#9bb85a' },
];
const N = SECTORS.length;
const WHEEL_POS = new Vector3(-0.3, 1.18, -1.3);
const RADIUS = 0.47;
const RIBBON_POINTS = 150;
const SECTOR = (Math.PI * 2) / N;

/**
 * Deguntiņš · Green Classroom–Forest Trail Connector: a scent wheel to spin (drag it with the controller or
 * mouse). Where it stops, ribbons of that scent family rise and spiral up through the trees; the story's
 * moment sends all five up together. The wheel only names families of natural smells.
 */
export class DeguntinsProps extends BaseProps {
  private readonly gateway: Gateway;
  private readonly wheel = new Group();
  private readonly ribbons: Points;
  private readonly rib = Array.from({ length: RIBBON_POINTS }, () => ({ age: -1, life: 3, a: 0, r: 0, color: new Color(), speed: 1 }));
  private readonly rnd = mulberry32(31);
  private angle = 0;
  private velocity = 0;
  private dragging = false;
  private lastAim = 0;
  private lastAt = 0;
  private boundary = 0;
  private spinning = false;
  private selected = -1;
  private selectedUntil = 0;
  private nowT = 0;
  private autoEmit = 0;
  private touched = false;
  private readonly plane = new Plane();
  private readonly hitPoint = new Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.gateway = new Gateway(ctx.glow, 'GREEN CLASSROOM', 'Deguntiņš · Smell', LAVENDER);
    this.group.add(this.gateway.group);

    // stand: an A-frame of two posts and a cross-beam with an axle
    const wood = planks('#cdae8a', 0.3, 1.4);
    for (const sx of [-1, 1]) {
      const post = mesh(new BoxGeometry(0.1, 1.5, 0.1), wood, WHEEL_POS.x + sx * 0.3, 0.7, WHEEL_POS.z - 0.12);
      post.rotation.z = -sx * 0.1;
      this.group.add(post);
      this.group.add(mesh(new BoxGeometry(0.1, 0.04, 0.8), wood, WHEEL_POS.x + sx * 0.5, 0.02, WHEEL_POS.z - 0.1));
    }
    this.group.add(mesh(new CylinderGeometry(0.03, 0.03, 0.84, 12), planks('#8a5a30', 0.2, 0.5), WHEEL_POS.x, WHEEL_POS.y, WHEEL_POS.z - 0.1).rotateZ(Math.PI / 2));
    this.group.add(contactShadow(shadowTexture(), 1.5, 1.0, 0.5).translateX(WHEEL_POS.x).translateZ(WHEEL_POS.z - 0.1));

    // the wheel itself
    const face = new Mesh(new CircleGeometry(RADIUS, 48), new MeshStandardMaterial({ map: wheelTexture(SECTORS), roughness: 0.75, emissive: '#000000' }));
    face.receiveShadow = true;
    const rim = mesh(new TorusGeometry(RADIUS, 0.03, 10, 48), planks('#a5754a', 0.6, 0.3));
    const back = mesh(new CylinderGeometry(RADIUS, RADIUS, 0.05, 40).rotateX(Math.PI / 2), planks('#bb9166', 0.5, 0.5), 0, 0, -0.03);
    const hub = mesh(new CylinderGeometry(0.045, 0.045, 0.06, 14).rotateX(Math.PI / 2), planks('#6a4326', 0.2, 0.3), 0, 0, 0.02);
    this.wheel.add(back, face, rim, hub);
    this.wheel.position.copy(WHEEL_POS);
    this.group.add(this.wheel);
    // fixed wooden pointer at the top
    const pointer = mesh(new CylinderGeometry(0, 0.045, 0.1, 3).rotateX(Math.PI), planks('#d9b27a', 0.2, 0.2), WHEEL_POS.x, WHEEL_POS.y + RADIUS + 0.07, WHEEL_POS.z + 0.04);
    this.group.add(pointer);
    this.appear(this.wheel, 0.2);
    this.add({
      id: 'wheel',
      object: this.wheel,
      kind: 'drag',
      label: 'Scent wheel: grab and spin',
      accent: LAVENDER,
      onDrag: (ray, phase) => this.drag(ray, phase),
    });

    // ribbons: one Points object, particles spiral up from the wheel
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(RIBBON_POINTS * 3), 3));
    geo.setAttribute('color', new BufferAttribute(new Float32Array(RIBBON_POINTS * 3), 3));
    this.ribbons = new Points(geo, new PointsMaterial({ size: 0.06, map: ctx.glow, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, fog: false }));
    this.ribbons.frustumCulled = false;
    this.group.add(this.ribbons);
  }

  private aim(ray: Ray): number | null {
    const n = new Vector3(0, 0, 1);
    this.plane.setFromNormalAndCoplanarPoint(n, this.group.localToWorld(WHEEL_POS.clone()));
    const hit = ray.intersectPlane(this.plane, this.hitPoint);
    if (!hit) return null;
    const local = this.group.worldToLocal(hit.clone()).sub(WHEEL_POS);
    return Math.atan2(local.y, local.x);
  }

  private drag(ray: Ray, phase: 'start' | 'move' | 'end'): void {
    const a = this.aim(ray);
    const now = performance.now() / 1000;
    if (phase === 'start') {
      this.dragging = true;
      this.touched = true;
      this.velocity = 0;
      this.spinning = true;
      this.selected = -1;
      if (a !== null) this.lastAim = a;
      this.lastAt = now;
      this.ctx.sound('pick');
      return;
    }
    if (phase === 'end') {
      this.dragging = false;
      return;
    }
    if (a === null) return;
    let d = a - this.lastAim;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const dt = Math.max(0.008, now - this.lastAt);
    this.angle += d;
    this.velocity = this.velocity * 0.6 + (d / dt) * 0.4;
    this.lastAim = a;
    this.lastAt = now;
  }

  /** Sector under the pointer at the top for the wheel's current angle. */
  private topSector(): number {
    return (((Math.round(this.angle / SECTOR - 0.5) % N) + N) % N) | 0;
  }

  private emit(hex: string, count: number): void {
    const c = new Color(hex);
    let made = 0;
    for (const p of this.rib) {
      if (p.age >= 0 || made >= count) continue;
      p.age = 0;
      p.life = 3.4 + this.rnd() * 1.6;
      p.a = this.rnd() * Math.PI * 2;
      p.r = 0.05 + this.rnd() * 0.12;
      p.speed = 0.38 + this.rnd() * 0.3;
      p.color.copy(c);
      made++;
    }
  }

  protected tick(t: number, cues: Cues, time: number, motion: number): void {
    this.gateway.update(time, motion);
    this.nowT = t;
    const dt = 1 / 60;
    const activity = cues.activity ?? Infinity;
    const item = this.items[0]!;
    item.hint = !this.touched && t >= activity + 2.5 && this.isShown(this.wheel);

    // physics: free spin with friction
    const moment = cues.moment ?? Infinity;
    if (!this.dragging) {
      if (t >= moment && t < moment + 6 && !this.touched) this.velocity = Math.max(this.velocity, 0.9);
      this.angle += this.velocity * dt;
      this.velocity *= Math.exp(-dt * 1.5);
      if (this.spinning && Math.abs(this.velocity) < 0.12) {
        this.velocity = 0;
        this.spinning = false;
        // settle onto the middle of the nearest sector
        this.angle = (Math.round(this.angle / SECTOR - 0.5) + 0.5) * SECTOR;
        this.selected = this.topSector();
        this.selectedUntil = t + 3.5;
        this.ctx.sound('chime', this.selected);
        this.emit(SECTORS[this.selected]!.color, 46);
      }
    }
    const b = Math.floor(this.angle / SECTOR);
    if (b !== this.boundary) {
      this.boundary = b;
      if (this.spinning || this.dragging) this.ctx.sound('tick');
    }
    this.wheel.rotation.z = this.angle;

    // the moment: all five scents rise together
    if (t >= moment && t < moment + 7) {
      this.autoEmit += dt * 14;
      while (this.autoEmit >= 1) {
        this.autoEmit -= 1;
        this.emit(SECTORS[Math.floor(this.rnd() * N)]!.color, 1);
      }
    }

    // ribbons
    const pos = this.ribbons.geometry.getAttribute('position') as BufferAttribute;
    const col = this.ribbons.geometry.getAttribute('color') as BufferAttribute;
    this.rib.forEach((p, i) => {
      if (p.age < 0) {
        col.setXYZ(i, 0, 0, 0);
        pos.setXYZ(i, 0, -10, 0);
        return;
      }
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.age = -1;
        return;
      }
      const a = p.a + p.age * 1.6;
      const r = p.r + k * 0.42;
      pos.setXYZ(i, WHEEL_POS.x + Math.cos(a) * r, WHEEL_POS.y + 0.3 + k * p.speed * 5.2 * (1 - k * 0.2), WHEEL_POS.z + 0.1 + Math.sin(a) * r * 0.7);
      const fade = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.95;
      col.setXYZ(i, p.color.r * fade, p.color.g * fade, p.color.b * fade);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  /** What the wheel landed on, named for a moment. */
  callout(): { text: string; at: Vector3 } | null {
    if (this.selected < 0 || this.nowT > this.selectedUntil) return null;
    return { text: `${SECTORS[this.selected]!.label}: slow, careful sniffs`, at: new Vector3(WHEEL_POS.x, WHEEL_POS.y + RADIUS + 0.3, WHEEL_POS.z + 0.1) };
  }

  protected onReset(): void {
    this.angle = 0;
    this.velocity = 0;
    this.dragging = false;
    this.spinning = false;
    this.selected = -1;
    this.touched = false;
    this.autoEmit = 0;
    this.boundary = 0;
    this.wheel.rotation.z = 0;
    for (const p of this.rib) p.age = -1;
  }
}
