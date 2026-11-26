import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BRAND } from '../content/brand';
import { getAsset, isReady } from '../content/assets';
import { GUARDIANS, type Guardian, type GuardianId } from '../content/guardians';
import type { SceneClock } from '../experience/SceneClock';
import { activeCaption, cueTimes } from '../experience/timeline';
import { PITCH } from '../content/pitchScript';
import { disposeTree } from './kit';
import type { QualityTier } from './quality';
import { SensesTree } from './SensesTree';
import { beamTexture, glowTexture, MAP_D, MAP_W, placeholderMapTexture } from './textures';
import { mulberry32, since } from './util';
import { ZoneRig } from './ZoneRig';

const MAX_TREES = 260;
const MAX_AMBIENT = 170;

export type WorldMode = 'map' | 'attraction' | 'finale';

interface Playing {
  clock: SceneClock;
  cues: ReturnType<typeof cueTimes>;
  beats: Guardian['pitchBeats'];
}

/**
 * The diorama: map slab, forest, light, ambient motes, five zones and the finale tree.
 * Everything is allocated once; quality tiers only change how much is drawn.
 */
export class World {
  readonly root = new Group();
  readonly zones = new Map<GuardianId, ZoneRig>();
  private readonly tree: SensesTree;
  private readonly textures: Texture[] = [];
  private readonly frame: Mesh;
  private readonly sun: DirectionalLight;
  private readonly foliage: InstancedMesh;
  private readonly trunks: InstancedMesh;
  private readonly shafts: Mesh[] = [];
  private readonly ambient: Points;
  private readonly ambientSeed: Float32Array;
  private readonly mapMaterial: MeshStandardMaterial;
  /** Original tree transforms, so trees can shrink away from the stage set and come back. */
  private readonly treeP: Vector3[] = [];
  private readonly treeQ: Quaternion[] = [];
  private readonly treeS: Vector3[] = [];
  private treeNow = new Float32Array(MAX_TREES).fill(1);
  private treeGoal = new Float32Array(MAX_TREES).fill(1);
  private readonly treesMoving = new Set<number>();
  private readonly treeMatrix = new Matrix4();
  private readonly shadowBlob: Mesh;

  mode: WorldMode = 'map';
  private playing: { guardian: Guardian | null; data: Playing } | null = null;
  private shadowsWanted = false;
  private external = false;
  /** How many trees were actually placed (placement can reject candidates). */
  private treeCap = MAX_TREES;

  /** Called once when a guardian's memorable moment starts. */
  onMoment: ((id: GuardianId | 'finale') => void) | null = null;

  constructor() {
    const glow = glowTexture();
    const beam = beamTexture();
    this.textures.push(glow, beam);

    // Light: low golden sun through the pines + soft sky fill
    this.root.add(new HemisphereLight('#fff0c8', '#1f3a2c', 1.7));
    this.sun = new DirectionalLight('#ffd68a', 2.7);
    this.sun.position.set(-3.5, 7, 4.5);
    this.sun.castShadow = false;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -6;
    this.sun.shadow.camera.right = 6;
    this.sun.shadow.camera.top = 4.5;
    this.sun.shadow.camera.bottom = -4.5;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 20;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.root.add(this.sun, this.sun.target);

    // Frame + map surface
    this.frame = new Mesh(
      new RoundedBoxGeometry(MAP_W + 0.5, 0.5, MAP_D + 0.5, 4, 0.12),
      new MeshStandardMaterial({ color: '#6e4528', roughness: 0.85, flatShading: false }),
    );
    this.frame.position.y = -0.25;
    this.frame.receiveShadow = true;
    this.root.add(this.frame);

    const mapTex = placeholderMapTexture();
    this.textures.push(mapTex);
    this.mapMaterial = new MeshStandardMaterial({ map: mapTex, roughness: 1, metalness: 0 });
    const surface = new Mesh(new PlaneGeometry(MAP_W, MAP_D), this.mapMaterial);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.003;
    surface.receiveShadow = true;
    this.root.add(surface);
    this.loadMapIllustration();

    this.shadowBlob = new Mesh(
      new CircleGeometry(1, 40),
      new MeshBasicMaterial({ map: glow, color: '#000000', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.shadowBlob.rotation.x = -Math.PI / 2;
    this.shadowBlob.position.y = -0.62;
    this.shadowBlob.scale.set(MAP_W * 0.85, MAP_D * 0.95, 1);
    this.root.add(this.shadowBlob);

    // Forest
    const foliageGeo = mergeGeometries([
      new ConeGeometry(0.34, 0.55, 7).translate(0, 0.52, 0),
      new ConeGeometry(0.27, 0.48, 7).translate(0, 0.82, 0),
      new ConeGeometry(0.19, 0.42, 7).translate(0, 1.1, 0),
    ]);
    const trunkGeo = new CylinderGeometry(0.045, 0.07, 0.32, 5).translate(0, 0.16, 0);
    this.foliage = new InstancedMesh(foliageGeo, new MeshStandardMaterial({ roughness: 0.9, flatShading: true }), MAX_TREES);
    this.trunks = new InstancedMesh(trunkGeo, new MeshStandardMaterial({ color: '#5e3b22', roughness: 1, flatShading: true }), MAX_TREES);
    this.foliage.castShadow = true;
    this.trunks.castShadow = true;
    this.scatterForest();
    this.root.add(this.foliage, this.trunks);

    // Light shafts through the canopy
    const shaftTex = beam;
    [
      [-3.0, -1.2, 0.5],
      [-0.8, 0.6, 0.3],
      [1.7, -0.9, 0.55],
      [3.2, 1.1, 0.4],
    ].forEach(([x, z, rotZ], i) => {
      const shaft = new Mesh(
        new PlaneGeometry(0.9, 4.2),
        new MeshBasicMaterial({ map: shaftTex, color: '#ffd68a', transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }),
      );
      shaft.position.set(x!, 2.1, z!);
      shaft.rotation.set(0, 0.6 + i * 0.5, rotZ!);
      this.shafts.push(shaft);
      this.root.add(shaft);
    });

    // Ambient motes (pollen / fireflies)
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(MAX_AMBIENT * 3), 3));
    const col = new BufferAttribute(new Float32Array(MAX_AMBIENT * 3), 3);
    geo.setAttribute('color', col);
    this.ambientSeed = new Float32Array(MAX_AMBIENT * 4);
    const rnd = mulberry32(99);
    const gold = new Color(BRAND.colors.gold);
    const sage = new Color(BRAND.colors.sage);
    for (let i = 0; i < MAX_AMBIENT; i++) {
      this.ambientSeed[i * 4] = (rnd() - 0.5) * MAP_W;
      this.ambientSeed[i * 4 + 1] = rnd();
      this.ambientSeed[i * 4 + 2] = (rnd() - 0.5) * MAP_D;
      this.ambientSeed[i * 4 + 3] = rnd() * Math.PI * 2;
      const c = rnd() > 0.35 ? gold : sage;
      col.setXYZ(i, c.r * 0.8, c.g * 0.8, c.b * 0.8);
    }
    this.ambient = new Points(
      geo,
      new PointsMaterial({ size: 0.07, map: glow, vertexColors: true, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
    );
    this.ambient.frustumCulled = false;
    this.root.add(this.ambient);

    // Zones + finale tree
    GUARDIANS.forEach((g) => {
      const rig = new ZoneRig(g, glow, beam);
      this.zones.set(g.id, rig);
      this.root.add(rig.group);
    });
    this.tree = new SensesTree(this.zones, glow);
    this.root.add(this.tree.group);
  }

  /** AR places the diorama on the printed map: no table frame or floor shadow there. */
  setExternal(external: boolean): void {
    this.external = external;
    this.frame.visible = !external;
    this.shadowBlob.visible = !external;
    this.sun.castShadow = !external && this.shadowsWanted;
  }

  setQuality(tier: QualityTier): void {
    const trees = Math.min(tier.trees, this.treeCap);
    this.foliage.count = trees;
    this.trunks.count = trees;
    this.ambient.geometry.setDrawRange(0, tier.particles);
    this.shadowsWanted = tier.shadows;
    this.sun.castShadow = !this.external && tier.shadows;
    this.zones.forEach((z) => z.setEmitters(tier.zoneEmitters));
  }

  get shadowsEnabled(): boolean {
    return this.sun.castShadow;
  }

  // ── scene modes ────────────────────────────────────────────────────────────

  /** Shrinks the trees inside `box` (x/z only) so the scene is not hidden behind them. null = bring all back. */
  private clearTreesIn(box: Box3 | null): void {
    for (let i = 0; i < this.treeCap; i++) {
      const p = this.treeP[i]!;
      const inside = box !== null && p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;
      const goal = inside ? 0 : 1;
      if (this.treeGoal[i] !== goal) {
        this.treeGoal[i] = goal;
        this.treesMoving.add(i);
      }
    }
  }

  showMap(visited: readonly GuardianId[], justActivated: GuardianId | null, instant: boolean): void {
    this.mode = 'map';
    this.clearTreesIn(null);
    this.playing = null;
    this.tree.setVisible(false);
    this.zones.forEach((z, id) => {
      z.setActive(false);
      z.setLit(visited.includes(id), instant);
    });
    if (justActivated) this.zones.get(justActivated)?.triggerActivation();
  }

  playAttraction(guardian: Guardian, clock: SceneClock): void {
    this.mode = 'attraction';
    this.clearTreesIn(this.zoneBox(guardian.id).expandByScalar(0.35));
    this.tree.setVisible(false);
    this.playing = { guardian, data: { clock, cues: cueTimes(guardian.pitchBeats), beats: guardian.pitchBeats } };
    this.zones.forEach((z, id) => z.setActive(id === guardian.id));
    this.lastT = -1;
  }

  playFinale(clock: SceneClock): void {
    this.mode = 'finale';
    this.clearTreesIn(this.finaleBox().expandByScalar(0.3));
    this.tree.setVisible(true);
    this.playing = { guardian: null, data: { clock, cues: cueTimes(PITCH.finale.beats), beats: PITCH.finale.beats } };
    this.zones.forEach((z) => {
      z.setActive(false);
      z.setLit(true);
    });
    this.lastT = -1;
  }

  // ── camera boxes (world space, before any AR transform) ───────────────────

  mapBox(): Box3 {
    return new Box3(new Vector3(-MAP_W / 2, -0.1, -MAP_D / 2), new Vector3(MAP_W / 2, 1.1, MAP_D / 2));
  }

  zoneBox(id: GuardianId): Box3 {
    const p = this.zones.get(id)?.worldPosition ?? new Vector3();
    return new Box3(new Vector3(p.x - 0.8, 0, p.z - 0.45), new Vector3(p.x + 1.0, 1.4, p.z + 0.85));
  }

  finaleBox(): Box3 {
    return new Box3(new Vector3(-1.85, 0, -0.9), new Vector3(1.85, 2.9, 1.7));
  }

  // ── per frame ──────────────────────────────────────────────────────────────

  private lastT = -1;

  update(dt: number, time: number, motion: number): void {
    // Ambient motes
    const pos = this.ambient.geometry.getAttribute('position') as BufferAttribute;
    const n = (this.ambient.geometry.drawRange.count === Infinity ? MAX_AMBIENT : this.ambient.geometry.drawRange.count) | 0;
    for (let i = 0; i < n; i++) {
      const s = this.ambientSeed;
      const rise = motion ? (time * 0.035 + s[i * 4 + 1]!) % 1 : s[i * 4 + 1]!;
      const sway = motion ? Math.sin(time * 0.6 + s[i * 4 + 3]!) * 0.12 : 0;
      pos.setXYZ(i, s[i * 4]! + sway, 0.12 + rise * 2.1, s[i * 4 + 2]! + Math.cos(time * 0.5 + s[i * 4 + 3]!) * 0.1 * motion);
    }
    pos.needsUpdate = true;

    this.shafts.forEach((s, i) => {
      (s.material as MeshBasicMaterial).opacity = 0.075 + (motion ? Math.sin(time * 0.4 + i * 1.7) * 0.03 : 0);
    });

    this.zones.forEach((z) => z.update(dt, time, motion));
    this.animateTrees(dt, motion);

    const playing = this.playing;
    if (!playing) return;
    const { clock, cues, beats } = playing.data;
    const t = clock.time;

    // Memorable moment: tell the app once (for the chime)
    const momentAt = cues.moment;
    if (momentAt !== undefined && this.lastT < momentAt && t >= momentAt) {
      this.onMoment?.(playing.guardian?.id ?? 'finale');
    }
    this.lastT = t;

    if (this.mode === 'attraction' && playing.guardian) {
      const speaking = activeCaption(beats, t)?.beat.speaker === 'mascot';
      this.zones.get(playing.guardian.id)?.updateActors({
        t,
        enter: since(t, cues.enter),
        activity: since(t, cues.activity),
        moment: since(t, cues.moment),
        speaking,
        motion,
      });
    } else if (this.mode === 'finale') {
      this.tree.update(t, cues, time, motion);
    }
  }

  private animateTrees(dt: number, motion: number): void {
    if (this.treesMoving.size === 0) return;
    const k = motion ? 1 - Math.exp(-dt * 5) : 1;
    const scale = new Vector3();
    for (const i of this.treesMoving) {
      const goal = this.treeGoal[i]!;
      let now = this.treeNow[i]! + (goal - this.treeNow[i]!) * k;
      if (Math.abs(goal - now) < 0.01) {
        now = goal;
        this.treesMoving.delete(i);
      }
      this.treeNow[i] = now;
      scale.copy(this.treeS[i]!).multiplyScalar(Math.max(0.0001, now));
      this.treeMatrix.compose(this.treeP[i]!, this.treeQ[i]!, scale);
      this.foliage.setMatrixAt(i, this.treeMatrix);
      this.trunks.setMatrixAt(i, this.treeMatrix);
    }
    this.foliage.instanceMatrix.needsUpdate = true;
    this.trunks.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    disposeTree(this.root);
    this.textures.forEach((t) => t.dispose());
    this.zones.forEach((z) => z.dispose());
    this.tree.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Swap in the real illustrated map once it is registered as ready. */
  private loadMapIllustration(): void {
    const entry = getAsset('map-illustration');
    if (!entry || !isReady('map-illustration')) return;
    new TextureLoader().load(
      entry.url,
      (tex) => {
        tex.colorSpace = SRGBColorSpace;
        this.textures.push(tex);
        this.mapMaterial.map = tex;
        this.mapMaterial.needsUpdate = true;
      },
      undefined,
      () => console.warn(`[assets] Could not load ${entry.url}; keeping the placeholder map.`),
    );
  }

  private scatterForest(): void {
    const rnd = mulberry32(31337);
    const zonePts = GUARDIANS.map((g) => new Vector3((g.zone.mapPosition.u - 0.5) * MAP_W, 0, (g.zone.mapPosition.v - 0.5) * MAP_D));
    const order = ['skats', 'austina', 'odzina', 'plaukstina', 'deguntins', 'skats'];
    const loop = order.map((id) => zonePts[GUARDIANS.findIndex((g) => g.id === id)]!);

    const distToTrail = (x: number, z: number): number => {
      let best = Infinity;
      for (let i = 0; i < loop.length - 1; i++) {
        const a = loop[i]!;
        const b = loop[i + 1]!;
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
        best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
      }
      return best;
    };

    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    const col = new Color();
    const greens = ['#2c5a35', '#34663a', '#3b7340', '#4a7729', '#2f6246'].map((c) => new Color(c));
    let placed = 0;
    let guard = 0;
    while (placed < MAX_TREES && guard++ < 6000) {
      const x = (rnd() - 0.5) * (MAP_W - 0.6);
      const z = (rnd() - 0.5) * (MAP_D - 0.6);
      if (z > MAP_D * 0.34) continue; // river
      if (Math.hypot(x, z) < 1.15) continue; // clearing for the Tree of Five Senses
      if (zonePts.some((zp) => Math.hypot(x - zp.x, z - zp.z) < 0.95)) continue;
      if (distToTrail(x, z) < 0.32) continue;
      const scale = 0.42 + rnd() * 0.3;
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      s.set(scale, scale * (0.9 + rnd() * 0.5), scale);
      p.set(x, 0, z);
      m.compose(p, q, s);
      this.foliage.setMatrixAt(placed, m);
      this.trunks.setMatrixAt(placed, m);
      this.treeP.push(p.clone());
      this.treeQ.push(q.clone());
      this.treeS.push(s.clone());
      col.copy(greens[(rnd() * greens.length) | 0]!);
      this.foliage.setColorAt(placed, col);
      placed++;
    }
    this.treeCap = placed;
    this.foliage.count = placed;
    this.trunks.count = placed;
    this.foliage.instanceMatrix.needsUpdate = true;
    this.trunks.instanceMatrix.needsUpdate = true;
  }
}

