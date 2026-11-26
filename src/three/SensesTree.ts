import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
  type Texture,
} from 'three';
import { BRAND } from '../content/brand';
import { GUARDIANS, type CueKind } from '../content/guardians';
import { disposeTree, Kit } from './kit';
import { buildMascot, type MascotRig } from './Mascot';
import { clamp01, easeInOut, easeOutBack, easeOutCubic, lerp, mulberry32, since } from './util';
import { ZoneRig } from './ZoneRig';

const DORMANT = new Color('#4d6a48');
const SPARKS = 90;

/**
 * Finale: the Tree of Five Senses grows in the clearing at the centre of the map,
 * light from the five zones flows into its canopy, and the five guardians gather round it.
 */
export class SensesTree {
  readonly group = new Group();
  private readonly trunk: Group;
  private readonly clusters: Array<{ mesh: Mesh; mat: MeshStandardMaterial; halo: Sprite; theme: Color; base: Vector3 }> = [];
  private readonly trails: Array<{ geo: TubeGeometry; mesh: Mesh; count: number }> = [];
  private readonly mascots: Array<{ rig: MascotRig; ring: Mesh }> = [];
  private readonly branches: Mesh[] = [];
  private readonly crown: Mesh;
  private readonly sparks: Points;
  private readonly sparkSeed: Float32Array;

  constructor(zones: ReadonlyMap<string, ZoneRig>, glow: Texture) {
    const kit = new Kit(false);
    this.group.visible = false;

    // Trunk + roots
    this.trunk = new Group();
    this.group.add(this.trunk);
    kit.mesh(this.trunk, new ConeGeometry(0.17, 1.6, 8), '#7a4a2a', 0, 0.8, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const root = kit.cone(this.trunk, 0.07, 0.4, '#6a3f22', Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, 5);
      root.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      root.position.y = 0.06;
    }
    kit.sphere(this.group, 0.5, BRAND.colors.moss, 0, 0.02, 0, 8).scale.set(1.5, 0.22, 1.3);

    // Five canopy clusters, one per sense, spread in an arc so all five colours face the audience
    const branchTop = new Vector3(0, 1.3, 0);
    const up = new Vector3(0, 1, 0);
    GUARDIANS.forEach((g, i) => {
      const x = lerp(-1.0, 1.0, i / 4);
      const base = new Vector3(x, 1.8 + (1 - Math.abs(x)) * 0.35, ((i % 2) - 0.5) * 0.12);
      const mat = new MeshStandardMaterial({ color: DORMANT, roughness: 0.8, flatShading: true, emissive: new Color(g.themeColor), emissiveIntensity: 0 });
      const mesh = new Mesh(new IcosahedronGeometry(0.42, 1), mat);
      mesh.position.copy(base);
      mesh.castShadow = true;
      this.group.add(mesh);
      const halo = new Sprite(new SpriteMaterial({ map: glow, color: g.themeColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      halo.position.copy(base);
      halo.scale.setScalar(1.5);
      this.group.add(halo);
      this.clusters.push({ mesh, mat, halo, theme: new Color(g.themeColor), base });

      // Branch from the trunk top to the cluster
      const dir = base.clone().sub(branchTop);
      const branch = new Mesh(new CylinderGeometry(0.035, 0.07, dir.length(), 5), new MeshStandardMaterial({ color: '#6a3f22', roughness: 1, flatShading: true }));
      branch.position.copy(branchTop).addScaledVector(dir, 0.5);
      branch.quaternion.setFromUnitVectors(up, dir.clone().normalize());
      this.group.add(branch);
      this.branches.push(branch);
    });
    const crown = (this.crown = new Mesh(new IcosahedronGeometry(0.3, 1), new MeshStandardMaterial({ color: BRAND.colors.leaf, roughness: 0.8, flatShading: true })));
    crown.position.set(0, 2.5, 0);
    this.group.add(crown);

    // Light trails from each zone beacon into its cluster
    GUARDIANS.forEach((g, i) => {
      const zone = zones.get(g.id);
      if (!zone) return;
      const from = zone.worldPosition.clone().setY(0.9);
      const to = this.clusters[i]!.base.clone();
      const mid = from.clone().lerp(to, 0.5).setY(2.6);
      const geo = new TubeGeometry(new QuadraticBezierCurve3(from, mid, to), 48, 0.018, 5);
      const mesh = new Mesh(geo, new MeshStandardMaterial({ color: g.themeColor, emissive: g.themeColor, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }));
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.trails.push({ geo, mesh, count: geo.index?.count ?? 0 });
    });

    // The five guardians gather in front of the tree
    GUARDIANS.forEach((g, i) => {
      const rig = buildMascot(g, 0.82);
      const x = lerp(-1.3, 1.3, i / 4);
      rig.group.position.set(x, 0, 0.95 + Math.abs(x) * 0.14);
      rig.group.rotation.y = -x * 0.22;
      this.group.add(rig.group);
      const ring = new Mesh(
        new RingGeometry(0.2, 0.3, 28),
        new MeshBasicMaterial({ color: g.themeColor, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(rig.group.position.x, 0.04, rig.group.position.z);
      this.group.add(ring);
      this.mascots.push({ rig, ring });
    });

    // Rising sparks in the five colours
    this.sparkSeed = new Float32Array(SPARKS * 3);
    const rnd = mulberry32(2026);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const col = new BufferAttribute(new Float32Array(SPARKS * 3), 3);
    geo.setAttribute('color', col);
    for (let i = 0; i < SPARKS; i++) {
      this.sparkSeed[i * 3] = rnd() * Math.PI * 2;
      this.sparkSeed[i * 3 + 1] = 0.2 + rnd() * 0.7;
      this.sparkSeed[i * 3 + 2] = rnd();
      const c = new Color(GUARDIANS[i % 5]!.themeColor);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    this.sparks = new Points(geo, new PointsMaterial({ size: 0.09, map: glow, vertexColors: true, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  update(t: number, cues: Partial<Record<CueKind, number>>, time: number, motion: number): void {
    const grow = since(t, cues.enter);
    const gather = since(t, cues.activity);
    const bloom = since(t, cues.moment);

    // Trunk grows from a seed; without motion it is simply there
    const g = grow < 0 ? 0 : motion ? easeOutCubic(grow / 4.5) : 1;
    this.trunk.scale.set(Math.max(0.0001, g), Math.max(0.0001, g), Math.max(0.0001, g));
    this.branches.forEach((b, i) => b.scale.setScalar(Math.max(0.0001, grow < 0 ? 0 : motion ? easeOutCubic((grow - 2.4 - i * 0.12) / 1.2) : 1)));
    this.crown.scale.setScalar(Math.max(0.0001, grow < 0 ? 0 : motion ? easeOutBack((grow - 4) / 1.2) : 1));
    this.clusters.forEach((c, i) => {
      const appear = grow < 0 ? 0 : motion ? easeOutBack((grow - 3 - i * 0.15) / 1.4) : g;
      const lightUp = bloom < 0 ? 0 : easeInOut((bloom - i * 0.55) / 1.6);
      c.mesh.scale.setScalar(Math.max(0.0001, appear));
      c.mesh.position.y = c.base.y + (motion ? Math.sin(time * 1.3 + i) * 0.015 : 0);
      c.mat.color.copy(DORMANT).lerp(c.theme, lightUp * 0.85);
      c.mat.emissiveIntensity = lightUp * 0.55;
      (c.halo.material as SpriteMaterial).opacity = lightUp * (0.55 + (motion ? Math.sin(time * 2 + i) * 0.1 : 0));
      c.halo.position.y = c.mesh.position.y;
    });

    this.trails.forEach((tr, i) => {
      const p = gather < 0 ? 0 : motion ? clamp01((gather - i * 0.35) / 2.2) : 1;
      tr.geo.setDrawRange(0, Math.floor(tr.count * easeInOut(p)));
      tr.mesh.visible = p > 0;
      const fade = bloom < 0 ? 1 : 1 - clamp01(bloom / 5) * 0.55;
      (tr.mesh.material as MeshStandardMaterial).opacity = 0.9 * fade;
    });

    this.mascots.forEach((m, i) => {
      const appear = gather < 0 ? -1 : gather - i * 0.3;
      m.rig.update(time, appear, gather >= 0 && gather < 9 && bloom < 0, motion);
      (m.ring.material as MeshBasicMaterial).opacity = appear < 0 ? 0 : Math.min(1, appear) * 0.55;
    });

    // Sparks
    const pos = this.sparks.geometry.getAttribute('position') as BufferAttribute;
    const show = bloom >= 0;
    this.sparks.visible = show;
    if (show) {
      (this.sparks.material as PointsMaterial).opacity = Math.min(1, bloom / 1.5) * 0.9;
      for (let i = 0; i < SPARKS; i++) {
        const ang = this.sparkSeed[i * 3]! + (motion ? time * 0.25 : 0);
        const rad = this.sparkSeed[i * 3 + 1]!;
        const ph = motion ? (time * 0.14 + this.sparkSeed[i * 3 + 2]!) % 1 : this.sparkSeed[i * 3 + 2]!;
        pos.setXYZ(i, Math.cos(ang) * rad, 1.4 + ph * 1.5, Math.sin(ang) * rad * 0.8);
      }
      pos.needsUpdate = true;
    }
  }

  dispose(): void {
    disposeTree(this.group);
  }
}
