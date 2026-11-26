import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import type { Guardian } from '../content/guardians';
import { Kit, disposeTree } from './kit';
import { buildLandmark } from './landmarks';
import { MAP_D, MAP_W } from './textures';
import { clamp01, easeInOut, lerp, mulberry32 } from './util';

const DORMANT_RING = new Color('#9aa59b');
const EMITTERS = 22;

/**
 * One zone on the diorama: a landmark that is dormant (grey, unlit) until the guardian
 * has been visited, and a light beacon that switches on. The attraction scenes themselves are
 * cinematic story scenes (see three/story), not 3D sets.
 */
export class ZoneRig {
  readonly group = new Group();
  readonly worldPosition: Vector3;
  private readonly theme: Color;
  private readonly kit = new Kit(true);
  private readonly clearing: Mesh;
  private readonly beam: Mesh;
  private readonly ring: Mesh;
  private readonly pulseRing: Mesh;
  private readonly halo: Sprite;
  private readonly emitter: Points;
  private readonly emitterSeed: Float32Array;

  /** 0 = dormant, 1 = awake. Eased toward `target` every frame. */
  lit = 0;
  private target = 0;
  private pulseAge = -1;
  private emitting = true;

  constructor(
    readonly guardian: Guardian,
    glow: Texture,
    beamTex: Texture,
  ) {
    const { u, v } = guardian.zone.mapPosition;
    this.worldPosition = new Vector3((u - 0.5) * MAP_W, 0, (v - 0.5) * MAP_D);
    this.group.position.copy(this.worldPosition);
    this.theme = new Color(guardian.themeColor);

    // Clearing + landmark (tinted materials)
    this.clearing = this.kit.cyl(this.group, 0.62, 0.66, 0.02, '#a9c56a', 0, 0, 0, 24);
    this.clearing.castShadow = false;
    this.group.add(buildLandmark(guardian.assetKeys.landmark, this.kit));

    // Beacon
    this.beam = new Mesh(
      new CylinderGeometry(0.09, 0.2, 2.1, 20, 1, true),
      new MeshBasicMaterial({ map: beamTex, color: this.theme, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.beam.position.y = 1.05;
    this.group.add(this.beam);

    this.ring = new Mesh(new RingGeometry(0.58, 0.68, 40), new MeshBasicMaterial({ color: DORMANT_RING, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.035;
    this.group.add(this.ring);

    this.pulseRing = new Mesh(new RingGeometry(0.9, 1, 48), new MeshBasicMaterial({ color: this.theme, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.pulseRing.position.y = 0.05;
    this.group.add(this.pulseRing);

    this.halo = new Sprite(new SpriteMaterial({ map: glow, color: this.theme, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    this.halo.position.y = 0.35;
    this.halo.scale.setScalar(1.8);
    this.group.add(this.halo);

    // Rising motes while awake
    const rnd = mulberry32(guardian.id.length * 97 + guardian.name.charCodeAt(0));
    this.emitterSeed = new Float32Array(EMITTERS * 3);
    for (let i = 0; i < EMITTERS; i++) {
      this.emitterSeed[i * 3] = rnd() * Math.PI * 2;
      this.emitterSeed[i * 3 + 1] = 0.15 + rnd() * 0.45;
      this.emitterSeed[i * 3 + 2] = rnd();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(EMITTERS * 3), 3));
    this.emitter = new Points(
      geo,
      new PointsMaterial({ size: 0.07, map: glow, color: this.theme, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
    );
    this.emitter.frustumCulled = false;
    this.group.add(this.emitter);

    this.applyLit();
  }

  setLit(on: boolean, instant = false): void {
    this.target = on ? 1 : 0;
    if (instant) {
      this.lit = this.target;
      this.applyLit();
    }
  }

  /** The "zone lights up" moment shown when returning to the map. */
  triggerActivation(): void {
    this.pulseAge = 0;
  }

  /** Sits the zone on the terrain; on the real map the painted clearing is not needed. */
  setGround(y: number, realMap: boolean): void {
    this.worldPosition.y = y;
    this.group.position.y = y;
    this.clearing.visible = !realMap;
  }

  setEmitters(on: boolean): void {
    this.emitting = on;
  }

  /** Marker anchor in world space. */
  markerPosition(out: Vector3): Vector3 {
    return out.copy(this.worldPosition).setY(this.worldPosition.y + 1.15);
  }

  update(dt: number, time: number, motion: number): void {
    if (Math.abs(this.lit - this.target) > 0.001) {
      this.lit += (this.target - this.lit) * (1 - Math.exp(-dt * (motion ? 2.4 : 40)));
      this.applyLit();
    }

    // Activation pulse: expanding ring + flash
    let flash = 0;
    if (this.pulseAge >= 0) {
      this.pulseAge += dt;
      const p = clamp01(this.pulseAge / 1.8);
      const pr = this.pulseRing.material as MeshBasicMaterial;
      this.pulseRing.scale.setScalar(motion ? lerp(0.4, 2.6, easeInOut(p)) : 1.4);
      pr.opacity = (1 - p) * 0.9;
      flash = (1 - p) * 0.9;
      if (p >= 1) {
        this.pulseAge = -1;
        pr.opacity = 0;
      }
    }

    const breathe = 0.85 + 0.15 * Math.sin(time * 1.8 + this.guardian.name.length) * motion;
    (this.beam.material as MeshBasicMaterial).opacity = this.lit * 0.5 * breathe + flash * 0.4;
    (this.halo.material as SpriteMaterial).opacity = this.lit * 0.55 * breathe + flash * 0.4;
    this.halo.scale.setScalar(1.6 + flash * 0.8);
    const rm = this.ring.material as MeshBasicMaterial;
    rm.color.copy(DORMANT_RING).lerp(this.theme, this.lit);
    rm.opacity = 0.28 + this.lit * 0.45 + (1 - this.lit) * 0.1 * Math.sin(time * 2.2) * motion;

    // Motes
    const show = this.lit > 0.05 && this.emitting;
    this.emitter.visible = show;
    if (show) {
      (this.emitter.material as PointsMaterial).opacity = this.lit * 0.9;
      const pos = this.emitter.geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < EMITTERS; i++) {
        const ang = this.emitterSeed[i * 3]! + time * 0.3 * motion;
        const rad = this.emitterSeed[i * 3 + 1]!;
        const ph = motion ? (time * 0.18 + this.emitterSeed[i * 3 + 2]!) % 1 : this.emitterSeed[i * 3 + 2]!;
        pos.setXYZ(i, Math.cos(ang) * rad, 0.1 + ph * 1.5, Math.sin(ang) * rad);
      }
      pos.needsUpdate = true;
    }
  }

  dispose(): void {
    disposeTree(this.group);
  }

  private applyLit(): void {
    for (const tint of this.kit.tints) {
      tint.mat.color.copy(tint.grey).lerp(tint.base, this.lit);
      tint.mat.emissive.copy(tint.base);
      tint.mat.emissiveIntensity = 0.16 * this.lit;
    }
  }
}
