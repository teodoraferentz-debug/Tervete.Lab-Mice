import {
  BackSide,
  Box3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Texture,
  Vector3,
  type Scene,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { QualityTier } from '../quality';
import { mulberry32 } from '../util';
import { cloneModel, loadMap, loadModel, loadSky } from './loaders';

/** The mist at the horizon, matched to the skybox so the ground melts into the photographed forest. */
export const MIST = '#8f958f';
const GROUND_RADIUS = 46;
const TRUNKS = 46;

interface Scatter {
  model: string;
  count: number;
  rMin: number;
  rMax: number;
  /** Final size in metres (height for plants, largest side for rocks), picked per instance from this range. */
  size: [number, number];
  /** Only in this arc in front of the player, around the stage (radians either side of straight ahead). */
  ahead?: number;
}

const SCATTER: Scatter[] = [
  { model: 'pine_sapling_small', count: 9, rMin: 3.4, rMax: 8, size: [2.2, 3.6], ahead: 1.25 },
  { model: 'fir_sapling', count: 7, rMin: 3.8, rMax: 9, size: [2, 3.2], ahead: 1.4 },
  { model: 'fern_02', count: 11, rMin: 2.6, rMax: 6, size: [0.55, 0.9] },
  { model: 'rock_moss_set_01', count: 5, rMin: 3, rMax: 7, size: [0.35, 0.85] },
  { model: 'tree_stump_01', count: 3, rMin: 2.8, rMax: 5.2, size: [0.45, 0.6] },
];

/**
 * The Baltic pine clearing every scene stands in: a photographed misty-pine sky dome, a PBR forest floor,
 * pine trunks rising into the mist, and a ring of real (decimated) saplings, ferns, mossy rocks and stumps.
 * Everything is placed from a seed so the clearing is identical on every run. Origin = where the player
 * stands, on the floor, facing -Z.
 */
export class ForestEnvironment {
  readonly group = new Group();
  private readonly sky: Mesh;
  private readonly ground: Mesh;
  private readonly lights = new Group();
  private readonly sun = new DirectionalLight('#ffe2b0', 2.1);
  private readonly hemi = new HemisphereLight('#dfe8e6', '#4c5a3a', 1.1);
  private readonly trunks: InstancedMesh;
  private readonly crowns: InstancedMesh;
  private readonly scatter = new Group();
  private skyTexture: Texture | null = null;
  private populated = false;
  private disposed = false;
  private scatterMeshes: Array<{ group: Object3D; rank: number }> = [];

  constructor(private readonly seed = 2024) {
    this.sky = new Mesh(
      new SphereGeometry(60, 40, 20),
      new MeshBasicMaterial({ side: BackSide, fog: false, depthWrite: false, color: '#9aa39b' }),
    );
    this.sky.position.y = 1.6;
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    const ground = new MeshStandardMaterial({
      map: loadMap('ground-diff', { srgb: true, repeatX: 22 }),
      normalMap: loadMap('ground-nor', { repeatX: 22 }),
      roughnessMap: loadMap('ground-rough', { repeatX: 22 }),
      roughness: 1,
      color: '#9db286',
      envMapIntensity: 0.35,
    });
    this.ground = new Mesh(new CircleGeometry(GROUND_RADIUS, 56), ground);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // Pine trunks: one instanced mesh for the bark and one for the crowns, fogged into the mist.
    const bark = new MeshLambertMaterial({ map: loadMap('bark-diff', { srgb: true, repeatX: 2, repeatY: 9 }), color: '#b9a898' });
    const trunk = new CylinderGeometry(0.17, 0.27, 1, 8, 1, true).translate(0, 0.5, 0);
    this.trunks = new InstancedMesh(trunk, bark, TRUNKS);
    const crownGeo = mergeGeometries([
      new ConeGeometry(2.2, 3.6, 8).translate(0, 0, 0),
      new ConeGeometry(1.7, 3.2, 8).translate(0, 2.3, 0),
      new ConeGeometry(1.1, 2.6, 8).translate(0, 4.3, 0),
    ]);
    this.crowns = new InstancedMesh(crownGeo, new MeshLambertMaterial({ color: '#2a4a38' }), TRUNKS);
    this.layoutTrunks();
    this.group.add(this.trunks, this.crowns);

    this.sun.position.set(-4, 9, 5);
    this.sun.target.position.set(0, 0, -1.2);
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.left = -2.2;
    this.sun.shadow.camera.right = 2.2;
    this.sun.shadow.camera.top = 2.2;
    this.sun.shadow.camera.bottom = -2.2;
    this.sun.shadow.camera.near = 4;
    this.sun.shadow.camera.far = 20;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.015;
    this.lights.add(this.hemi, this.sun, this.sun.target);
    this.group.add(this.lights, this.scatter);
  }

  /** Fog and the skybox are scene-wide, so the Stage asks the environment to apply them. */
  applyTo(scene: Scene): void {
    scene.fog = new FogExp2(MIST, 0.034);
    scene.background = new Color(MIST);
  }

  /** Loads the sky and the scatter models in the background; the clearing is usable (with fog) meanwhile. */
  async load(): Promise<Texture | null> {
    if (this.populated) return this.skyTexture;
    this.populated = true;
    const [sky] = await Promise.all([loadSky().catch(() => null), this.populate()]);
    if (this.disposed) return null;
    if (sky) {
      this.skyTexture = sky;
      const mat = this.sky.material as MeshBasicMaterial;
      mat.map = sky;
      mat.color.set('#ffffff');
      mat.needsUpdate = true;
    }
    return sky;
  }

  setQuality(tier: QualityTier): void {
    // Fewer saplings and ferns on a Quest-class GPU; the trunks are cheap (one draw call).
    const keep = tier.name === 'high' ? 1 : tier.name === 'medium' ? 0.75 : 0.5;
    for (const { group, rank } of this.scatterMeshes) group.visible = rank <= keep;
    this.sun.castShadow = tier.shadows;
  }

  /** The sky, floor and trees show or hide; the lights stay (AR still lights the miniature). */
  setDressing(on: boolean): void {
    for (const o of [this.sky, this.ground, this.trunks, this.crowns, this.scatter]) o.visible = on;
  }

  setShadows(on: boolean): void {
    this.sun.castShadow = on;
  }

  dispose(): void {
    this.disposed = true;
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry && !m.userData.shared) m.geometry.dispose();
    });
  }

  // ── building ──────────────────────────────────────────────────────────────

  private layoutTrunks(): void {
    const rnd = mulberry32(this.seed);
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const up = new Vector3(0, 1, 0);
    const crownTint = [new Color('#27463a'), new Color('#2b4f3b'), new Color('#31553f')];
    for (let i = 0; i < TRUNKS; i++) {
      const angle = (i / TRUNKS) * Math.PI * 2 + (rnd() - 0.5) * 0.18;
      const r = 8 + rnd() * 12;
      const h = 9 + rnd() * 6;
      const w = 0.55 + rnd() * 0.45;
      p.set(Math.sin(angle) * r, 0, -Math.cos(angle) * r);
      q.setFromAxisAngle(up, rnd() * 6.28);
      s.set(w, h, w);
      m.compose(p, q, s);
      this.trunks.setMatrixAt(i, m);
      p.y = h * 0.7;
      s.set(w * 1.1, 0.9 + rnd() * 0.35, w * 1.1);
      m.compose(p, q, s);
      this.crowns.setMatrixAt(i, m);
      this.crowns.setColorAt(i, crownTint[i % 3]!);
    }
    this.trunks.instanceMatrix.needsUpdate = true;
    this.crowns.instanceMatrix.needsUpdate = true;
    if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true;
  }

  private async populate(): Promise<void> {
    const rnd = mulberry32(this.seed + 1);
    const up = new Vector3(0, 1, 0);
    for (const spec of SCATTER) {
      const source = await loadModel(spec.model);
      if (!source || this.disposed) continue;
      // Variants (a/b/c) live as separate top-level children: each placed instance picks one.
      const split = source.children.length > 1 && (spec.model.includes('sapling') || spec.model.includes('rock'));
      const variants = split ? source.children : [source];
      for (let i = 0; i < spec.count; i++) {
        const angle = spec.ahead !== undefined ? (rnd() * 2 - 1) * spec.ahead : rnd() * Math.PI * 2;
        const r = spec.rMin + rnd() * (spec.rMax - spec.rMin);
        const x = Math.sin(angle) * r;
        const z = -Math.cos(angle) * r;
        // Keep the table, its props and the player's own spot free.
        if (Math.hypot(x, z + 1.15) < 1.7 || Math.hypot(x, z) < 1.1) continue;
        const pick = variants[Math.floor(rnd() * variants.length)]!;
        const inst = cloneModel(pick);
        // Child variants keep their position inside the source file: recentre them on the ground.
        inst.position.set(0, 0, 0);
        const holder = new Group();
        holder.add(inst);
        holder.updateMatrixWorld(true);
        // Source files use whatever units their author liked: size every instance in metres.
        const dims = new Box3().setFromObject(inst).getSize(new Vector3());
        const natural = spec.model.includes('rock') ? Math.max(dims.x, dims.y, dims.z) : dims.y;
        const size = spec.size[0] + rnd() * (spec.size[1] - spec.size[0]);
        holder.scale.setScalar(size / Math.max(0.0001, natural));
        holder.position.set(x, 0, z);
        holder.quaternion.setFromAxisAngle(up, rnd() * Math.PI * 2);
        holder.traverse((o) => {
          const mesh = o as Mesh;
          if (mesh.isMesh) mesh.userData.shared = true;
        });
        this.scatter.add(holder);
        this.scatterMeshes.push({ group: holder, rank: (i + 1) / spec.count });
      }
    }
  }
}
