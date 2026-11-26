import {
  AdditiveBlending,
  Box3,
  BufferAttribute,
  BoxGeometry,
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
import { cueTimes } from '../experience/timeline';
import { PITCH } from '../content/pitchScript';
import { disposeTree } from './kit';
import type { QualityTier } from './quality';
import { SensesTree } from './SensesTree';
import { loadTerrain, Terrain } from './terrain';
import { beamTexture, glowTexture, MAP_D, MAP_W, placeholderMapTexture } from './textures';
import { mulberry32 } from './util';
import { coreCenter, tablePoint, VR_MAP_SCALE } from '../vr/layout';
import { ForestEnvironment } from './forest/ForestEnvironment';
import { ForestScene } from './forest/ForestScene';
import { InteractionManager, type PointerFrame } from './forest/interaction';
import type { SceneCtx, SoundKind } from './forest/types';
import { ZoneRig } from './ZoneRig';

const MAX_TREES = 260;
const MAX_AMBIENT = 170;
/** Open ground west of the Pasaku mežs, between the five zones, on the interim map. */
const FINALE_UV = { u: 0.4, v: 0.43 };
const SURFACE_SEGMENTS = { x: 192, y: 138 };
const FRAME_TOP = -0.13;
/** In AR the scene is a miniature standing on the map: this much of life size. */
const AR_SCENE_SCALE = 0.34;

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
  /** The map table (relief, forest, zones, finale tree). Hidden while a story scene fills the screen. */
  readonly diorama = new Group();
  /** The forest clearing and the guardian's stage: real 3D, placed per mode (see placeForest). */
  readonly forestRoot = new Group();
  readonly forest = new ForestEnvironment();
  /** Pointing and grabbing for whatever scene is playing. */
  readonly interaction = new InteractionManager();
  private readonly scenes = new Map<GuardianId, ForestScene>();
  private activeScene: ForestScene | null = null;
  private readonly sceneCtx: SceneCtx;
  private readonly mapLights = new Group();
  private forestShown = false;
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
  private readonly surface: Mesh;
  private terrain: Terrain | null = null;
  private tier: QualityTier | null = null;
  private clearBox: Box3 | null = null;
  /** Where the Tree of Five Senses grows (a free spot on the map). */
  private readonly finaleCenter = new Vector3((FINALE_UV.u - 0.5) * MAP_W, 0, (FINALE_UV.v - 0.5) * MAP_D);

  mode: WorldMode = 'map';
  private playing: { guardian: Guardian | null; data: Playing } | null = null;
  private shadowsWanted = false;
  private external = false;
  private vr = false;
  /** Where the headset's player stands and which way they face when the session starts. */
  private readonly vrOrigin = new Vector3();
  private vrYaw = 0;
  private vrFloorY = 0;
  /** How many trees were actually placed (placement can reject candidates). */
  private treeCap = MAX_TREES;

  /** Called once when a guardian's memorable moment starts. */
  onMoment: ((id: GuardianId | 'finale') => void) | null = null;
  /** A character starts a line; the app plays its placeholder voice and says how long it lasts. */
  onSpeak: ((voice: string, text: string) => number) | null = null;
  /** Sounds the interactive scenes ask for (the app plays them). */
  onSound: ((kind: SoundKind, index?: number) => void) | null = null;
  /** The clearing was shown or hidden (the stage sets fog and background to match). */
  onForest: ((shown: boolean) => void) | null = null;

  constructor() {
    const glow = glowTexture();
    const beam = beamTexture();
    this.textures.push(glow, beam);

    // Light: low golden sun through the pines + soft sky fill
    this.mapLights.add(new HemisphereLight('#fff0c8', '#1f3a2c', 1.25));
    this.root.add(this.mapLights);
    this.sun = new DirectionalLight('#ffd68a', 2.3);
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

    // Wooden frame: a slab under the map and a rim that closes the gap to the relief's edge
    const wood = new MeshStandardMaterial({ color: '#6e4528', roughness: 0.85 });
    this.frame = new Mesh(new RoundedBoxGeometry(MAP_W + 0.5, 0.5, MAP_D + 0.5, 4, 0.12), wood);
    this.frame.position.y = FRAME_TOP - 0.25;
    this.frame.receiveShadow = true;
    this.diorama.add(this.frame);
    const rimH = 0.17;
    const rimY = FRAME_TOP + rimH / 2;
    const rims: Array<[number, number, number, number, number]> = [
      [0.25, MAP_D + 0.5, -(MAP_W / 2 + 0.125), 0, 0],
      [0.25, MAP_D + 0.5, MAP_W / 2 + 0.125, 0, 0],
      [MAP_W, 0.25, 0, -(MAP_D / 2 + 0.125), 0],
      [MAP_W, 0.25, 0, MAP_D / 2 + 0.125, 0],
    ];
    rims.forEach(([w, d, x, z]) => {
      const rim = new Mesh(new BoxGeometry(w, rimH, d), wood);
      rim.position.set(x, rimY, z);
      rim.castShadow = true;
      rim.receiveShadow = true;
      this.frame.add(rim);
      rim.position.y -= this.frame.position.y;
    });

    // Map surface: with the real map it is textured with the illustration and raised into relief
    const realMap = isReady('map-illustration');
    const mapTex = realMap ? null : placeholderMapTexture();
    if (mapTex) this.textures.push(mapTex);
    this.mapMaterial = new MeshStandardMaterial({ map: mapTex, color: realMap ? '#5b7a47' : '#ffffff', roughness: 1, metalness: 0 });
    this.surface = new Mesh(new PlaneGeometry(MAP_W, MAP_D, SURFACE_SEGMENTS.x, SURFACE_SEGMENTS.y), this.mapMaterial);
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.receiveShadow = true;
    this.surface.castShadow = true;
    this.diorama.add(this.surface);
    void this.loadMapAssets();

    this.shadowBlob = new Mesh(
      new CircleGeometry(1, 40),
      new MeshBasicMaterial({ map: glow, color: '#000000', transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.shadowBlob.rotation.x = -Math.PI / 2;
    this.shadowBlob.position.y = -0.72;
    this.shadowBlob.scale.set(MAP_W * 0.85, MAP_D * 0.95, 1);
    this.diorama.add(this.shadowBlob);

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
    this.diorama.add(this.foliage, this.trunks);

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
      this.diorama.add(shaft);
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
    this.diorama.add(this.ambient);

    // Zones + finale tree
    GUARDIANS.forEach((g) => {
      const rig = new ZoneRig(g, glow, beam);
      this.zones.set(g.id, rig);
      this.diorama.add(rig.group);
    });
    this.tree = new SensesTree(this.zones, glow);
    this.tree.layout(this.finaleCenter);
    this.diorama.add(this.tree.group);
    this.root.add(this.diorama);
    this.sceneCtx = {
      glow,
      beam,
      interaction: this.interaction,
      sound: (kind, index) => this.onSound?.(kind, index),
      speak: (voice, text) => this.onSpeak?.(voice, text) ?? 0,
      envItems: () => this.forest.items,
    };
    this.forest.sound = (kind, index) => this.onSound?.(kind, index);
    this.forest.onItems = () => this.activeScene?.refreshItems();
    // Hovering makes a tiny tick, so pointing at things is audible too (headset: no cursor to see)
    this.interaction.onEvent = (e) => {
      if (e.kind === 'hover') this.onSound?.('hover');
    };
    this.forestRoot.add(this.forest.group);
    this.forestRoot.visible = false;
    this.root.add(this.forestRoot);
  }

  /** Loads the clearing's sky and models; resolves to the sky (for the image-based lighting) or null. */
  loadForest(): ReturnType<ForestEnvironment['load']> {
    return this.forest.load();
  }

  /** AR places the diorama on the printed map: no table frame or floor shadow there. */
  setExternal(external: boolean): void {
    this.external = external;
    this.frame.visible = !external;
    this.shadowBlob.visible = !external;
    this.sun.castShadow = !external && this.shadowsWanted;
  }

  /** In a headset the map is a tabletop miniature and scenes are a theatre in front of the player. */
  setVr(on: boolean): void {
    this.vr = on;
    this.shadowBlob.visible = !on && !this.external;
    this.sun.castShadow = !on && !this.external && this.shadowsWanted;
    this.applyVrPlacement();
    this.syncForest();
  }

  /**
   * Runtimes disagree on where the "local" origin is (at the head, or on the floor), so VR content is
   * anchored to the head's actual position and heading, read on the first frame of the session.
   */
  setVrAnchor(origin: Vector3, yaw: number, floorY: number): void {
    this.vrOrigin.copy(origin);
    this.vrYaw = yaw;
    this.vrFloorY = floorY;
    this.applyVrPlacement();
  }

  /** Centre of the five zones on the map (also used by the headset UI to place labels). */
  core(): Vector3 {
    return coreCenter([...this.zones.values()].map((z) => z.worldPosition));
  }

  private vrPoint(local: Vector3): Vector3 {
    return local.clone().applyAxisAngle(new Vector3(0, 1, 0), this.vrYaw).add(this.vrOrigin);
  }

  private applyVrPlacement(): void {
    this.placeForest();
    if (!this.vr) {
      this.diorama.scale.setScalar(1);
      this.diorama.position.set(0, 0, 0);
      this.diorama.rotation.set(0, 0, 0);
      return;
    }
    // Centre the table on the park core: the diorama's own origin is shifted so the zones sit in front of the player.
    const origin = tablePoint(new Vector3(0, 0, 0), this.core());
    this.diorama.scale.setScalar(VR_MAP_SCALE);
    this.diorama.position.copy(this.vrPoint(origin));
    this.diorama.rotation.set(0, this.vrYaw, 0);
  }

  /**
   * Where the clearing and the scene stand: at the origin for the screen (the camera looks along -Z), on the
   * floor where the player stands in a headset, and as a miniature above the printed map in AR.
   */
  private placeForest(zone?: Vector3): void {
    const r = this.forestRoot;
    if (this.vr) {
      r.position.set(this.vrOrigin.x, this.vrFloorY, this.vrOrigin.z);
      r.rotation.set(0, this.vrYaw, 0);
      r.scale.setScalar(1);
    } else if (this.external) {
      r.position.copy(zone ?? r.position);
      r.rotation.set(0, 0, 0);
      r.scale.setScalar(AR_SCENE_SCALE);
    } else {
      r.position.set(0, 0, 0);
      r.rotation.set(0, 0, 0);
      r.scale.setScalar(1);
    }
  }

  setQuality(tier: QualityTier): void {
    this.tier = tier;
    const trees = Math.min(tier.trees, this.treeCap);
    this.foliage.count = trees;
    this.trunks.count = trees;
    this.ambient.geometry.setDrawRange(0, tier.particles);
    this.shadowsWanted = tier.shadows;
    this.sun.castShadow = !this.external && !this.vr && tier.shadows;
    this.zones.forEach((z) => z.setEmitters(tier.zoneEmitters));
    this.forest.setQuality(tier);
  }

  get shadowsEnabled(): boolean {
    return this.sun.castShadow;
  }

  // ── scene modes ────────────────────────────────────────────────────────────

  /** Shrinks the trees inside `box` (x/z only) so the scene is not hidden behind them. null = bring all back. */
  private clearTreesIn(box: Box3 | null): void {
    this.clearBox = box;
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
    this.leaveScene();
    this.zones.forEach((z, id) => z.setLit(visited.includes(id), instant));
    if (justActivated) this.zones.get(justActivated)?.triggerActivation();
  }

  /**
   * An attraction is a real 3D scene (a clearing, a table, props you can point at and pick up). Magic Mode:
   * it fills the screen and the map table is hidden. Headset: it surrounds the player at life size. AR: a
   * miniature stands on the printed map with the map still visible around it.
   */
  playAttraction(guardian: Guardian, clock: SceneClock): void {
    this.mode = 'attraction';
    this.tree.setVisible(false);
    this.playing = { guardian, data: { clock, cues: cueTimes(guardian.pitchBeats), beats: guardian.pitchBeats } };
    this.leaveScene();
    const scene = this.sceneFor(guardian);
    this.activeScene = scene;
    scene.group.visible = true;
    scene.start();
    if (this.external) {
      const zone = this.zones.get(guardian.id);
      this.diorama.visible = true;
      this.placeForest((zone?.worldPosition ?? new Vector3()).clone());
    } else {
      this.diorama.visible = false;
      this.placeForest();
    }
    this.syncForest();
    this.lastT = -1;
  }

  playFinale(clock: SceneClock): void {
    this.mode = 'finale';
    this.clearTreesIn(this.finaleBox().expandByScalar(0.3));
    this.leaveScene();
    this.tree.setVisible(true);
    this.playing = { guardian: null, data: { clock, cues: cueTimes(PITCH.finale.beats), beats: PITCH.finale.beats } };
    this.zones.forEach((z) => z.setLit(true));
    this.lastT = -1;
  }

  // ── camera boxes (world space, before any AR transform) ───────────────────

  mapBox(): Box3 {
    // The five zones sit close together on the real map, so the Magic Mode view frames that core
    // (with a margin) instead of the whole poster. In AR the real camera sees the whole sheet anyway.
    const box = new Box3();
    this.zones.forEach((z) => box.expandByPoint(z.worldPosition));
    box.expandByVector(new Vector3(1.5, 0, 1.15));
    box.min.set(Math.max(box.min.x, -MAP_W / 2), -0.2, Math.max(box.min.z, -MAP_D / 2));
    box.max.set(Math.min(box.max.x, MAP_W / 2), 1.1, Math.min(box.max.z, MAP_D / 2));
    return box;
  }

  zoneBox(id: GuardianId): Box3 {
    const p = this.zones.get(id)?.worldPosition ?? new Vector3();
    return new Box3(new Vector3(p.x - 0.8, p.y, p.z - 0.45), new Vector3(p.x + 1.0, p.y + 1.4, p.z + 0.85));
  }

  finaleBox(): Box3 {
    const c = this.finaleCenter;
    return new Box3(new Vector3(c.x - 1.85, c.y, c.z - 0.9), new Vector3(c.x + 1.85, c.y + 2.9, c.z + 1.7));
  }

  // ── per frame ──────────────────────────────────────────────────────────────

  private lastT = -1;

  update(dt: number, time: number, motion: number, frames: readonly PointerFrame[] = []): void {
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
    if (this.forestShown || this.mode === 'attraction') this.forest.update(dt, time, motion);

    const playing = this.playing;
    if (!playing) return;
    const { clock, cues } = playing.data;
    const t = clock.time;

    // Memorable moment: tell the app once (for the chime)
    const momentAt = cues.moment;
    if (momentAt !== undefined && this.lastT < momentAt && t >= momentAt) {
      this.onMoment?.(playing.guardian?.id ?? 'finale');
    }
    this.lastT = t;

    if (this.mode === 'attraction' && this.activeScene) {
      this.activeScene.update(t, cues, time, motion, frames);
    } else if (this.mode === 'finale') {
      this.tree.update(t, cues, time, motion);
    }
  }

  private sceneFor(guardian: Guardian): ForestScene {
    let scene = this.scenes.get(guardian.id);
    if (!scene) {
      scene = new ForestScene(guardian, this.sceneCtx);
      this.forestRoot.add(scene.group);
      this.scenes.set(guardian.id, scene);
    }
    return scene;
  }

  private leaveScene(): void {
    if (this.activeScene) {
      this.activeScene.stop();
      this.activeScene.group.visible = false;
    }
    this.activeScene = null;
    this.diorama.visible = true;
    this.syncForest();
  }

  /** Shows the clearing when it is the setting (screen scene, or anywhere in a headset); lights follow the map. */
  private syncForest(): void {
    const scene = this.mode === 'attraction';
    const shown = this.vr || (scene && !this.external);
    this.forest.setDressing(shown);
    this.forestRoot.visible = shown || (scene && this.external);
    this.mapLights.visible = this.diorama.visible;
    if (shown !== this.forestShown) {
      this.forestShown = shown;
      this.onForest?.(shown);
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
    this.scenes.forEach((sc) => sc.dispose());
    this.forest.dispose();
    this.interaction.dispose();
    disposeTree(this.root);
    this.textures.forEach((t) => t.dispose());
    this.zones.forEach((z) => z.dispose());
    this.tree.dispose();
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** Loads the real map and its relief (when registered as ready) and builds the 3D terrain from them. */
  private async loadMapAssets(): Promise<void> {
    const mapEntry = getAsset('map-illustration');
    if (!mapEntry || !isReady('map-illustration')) return;
    try {
      const reliefEntry = getAsset('map-relief');
      const [tex, terrain] = await Promise.all([
        new TextureLoader().loadAsync(mapEntry.url),
        reliefEntry && isReady('map-relief') ? loadTerrain(reliefEntry.url) : Promise.resolve(null),
      ]);
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = 8;
      this.textures.push(tex);
      this.mapMaterial.map = tex;
      this.mapMaterial.color.set('#d6d6d6'); // the poster is light: tone it down under the golden sun
      this.mapMaterial.needsUpdate = true;
      if (terrain) this.applyTerrain(terrain);
    } catch (error) {
      console.warn('[assets] Could not load the map; keeping the placeholder.', error);
    }
  }

  /** Raises the surface into relief and seats zones, the finale tree and the forest on it. */
  private applyTerrain(terrain: Terrain): void {
    this.terrain = terrain;
    const geo = this.surface.geometry;
    const pos = geo.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      // The plane lies in XY and is rotated flat: its Y is the world's -Z, its Z the world's height.
      pos.setZ(i, terrain.heightAt(pos.getX(i), -pos.getY(i)));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();

    this.zones.forEach((z) => z.setGround(terrain.heightAt(z.worldPosition.x, z.worldPosition.z), true));
    this.finaleCenter.y = terrain.heightAt(this.finaleCenter.x, this.finaleCenter.z);
    this.tree.layout(this.finaleCenter);
    this.scatterForest();
  }

  /**
   * Plants the forest. With the real terrain, trees grow only in the outer forest (never on roads, the
   * park itself, banners or legends) so the map stays readable; otherwise a placeholder layout is used.
   */
  private scatterForest(): void {
    const rnd = mulberry32(31337);
    const terrain = this.terrain;
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

    this.treeP.length = 0;
    this.treeQ.length = 0;
    this.treeS.length = 0;
    this.treeNow.fill(1);
    this.treeGoal.fill(1);
    this.treesMoving.clear();

    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    const col = new Color();
    const greens = ['#2c5a35', '#34663a', '#3b7340', '#4a7729', '#2f6246'].map((c) => new Color(c));
    let placed = 0;
    let guard = 0;
    while (placed < MAX_TREES && guard++ < 12000) {
      const x = (rnd() - 0.5) * (MAP_W - 0.5);
      const z = (rnd() - 0.5) * (MAP_D - 0.5);
      let scale = 0.42 + rnd() * 0.3;
      if (terrain) {
        if (terrain.treeAt(x, z) < 0.6) continue;
        scale = 0.26 + rnd() * 0.2;
      } else {
        if (z > MAP_D * 0.34) continue; // river
        if (distToTrail(x, z) < 0.32) continue;
      }
      if (Math.hypot(x - this.finaleCenter.x, z - this.finaleCenter.z) < (terrain ? 2.2 : 1.15)) continue;
      if (zonePts.some((zp) => Math.hypot(x - zp.x, z - zp.z) < 0.95)) continue;
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      s.set(scale, scale * (0.9 + rnd() * 0.5), scale);
      p.set(x, terrain ? terrain.heightAt(x, z) : 0, z);
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
    const visible = Math.min(this.tier?.trees ?? MAX_TREES, placed);
    this.foliage.count = visible;
    this.trunks.count = visible;
    this.foliage.instanceMatrix.needsUpdate = true;
    this.trunks.instanceMatrix.needsUpdate = true;
    if (this.foliage.instanceColor) this.foliage.instanceColor.needsUpdate = true;
    // Keep the forest parted around the scene that is currently playing.
    if (this.clearBox) this.clearTreesIn(this.clearBox);
  }
}
