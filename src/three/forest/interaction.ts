import {
  Color,
  Quaternion,
  Raycaster,
  Vector3,
  type Intersection,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';

/**
 * Pointing at things and picking them up. One system for every pointer: a headset controller's ray, the
 * mouse on a desktop, or a finger on a phone. Each frame the owner hands it the rays; it works out what is
 * hovered, who holds what, and moves held objects. What an interaction *means* (a leaf pressed into dough,
 * a bar struck on the xylophone) stays with the scene that registered the item.
 */

export interface PointerSource {
  id: number;
  /** World space. */
  origin: Vector3;
  /** World space, unit length. */
  direction: Vector3;
  /** The trigger / button / finger is down. */
  down: boolean;
}

export type InteractKind = 'press' | 'grab' | 'drag';

export interface Interactable {
  id: string;
  object: Object3D;
  kind: InteractKind;
  /** Short hover caption ("Magnifier"). */
  label?: string;
  /** Glow colour when hovered or held. */
  accent?: string;
  /** Only interactable when this returns true (default: always). */
  enabled?: () => boolean;
  /** press: the ray's hit when the trigger went down. */
  onPress?: (hit: Intersection, sourceId: number) => void;
  /** grab: picked up. */
  onGrab?: () => void;
  /** grab: let go at this world position. Return true when the scene took the object (snapped, consumed). */
  onRelease?: (world: Vector3) => boolean;
  /** drag: the ray while the trigger is held (also called once at the start). */
  onDrag?: (ray: Raycaster['ray'], phase: 'start' | 'move' | 'end') => void;
  /** While held: called every frame with the world position. */
  onHeld?: (world: Vector3) => void;
  /** A soft pulse to say "try me" (the scene turns it on once the props have appeared). */
  hint?: boolean;
  /** Filled in by the manager for grab items: where it goes back to. */
  home?: { position: Vector3; quaternion: Quaternion };
}

export interface PointerFrame {
  id: number;
  /** Distance to what the ray hits, or null. */
  distance: number | null;
  point: Vector3 | null;
  hovered: Interactable | null;
  holding: Interactable | null;
}

export type InteractionEvent = { kind: 'hover' | 'grab' | 'drop' | 'press'; item: Interactable };

interface Glow {
  mat: Material & { emissive: Color; emissiveIntensity: number };
  base: Color;
  baseIntensity: number;
}

interface Tracked {
  item: Interactable;
  meshes: Mesh[];
  glows: Glow[];
  level: number;
  applied: number;
}

interface SourceState {
  down: boolean;
  hovered: Tracked | null;
  held: Tracked | null;
  dist: number;
  offset: Vector3;
  dragging: Tracked | null;
}

interface Glide {
  object: Object3D;
  position: Vector3;
  quaternion: Quaternion;
  done?: () => void;
}

const GRAB_MIN = 0.28;
const GRAB_MAX = 3;
const tmpV = new Vector3();
const tmpV2 = new Vector3();
const tmpQ = new Quaternion();

function chainVisible(o: Object3D | null): boolean {
  for (let n: Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

export class InteractionManager {
  private tracked: Tracked[] = [];
  private byMesh = new Map<Object3D, Tracked>();
  private readonly sources = new Map<number, SourceState>();
  private readonly glides: Glide[] = [];
  private readonly raycaster = new Raycaster();
  private time = 0;

  onHaptic: ((sourceId: number, strength: number, ms: number) => void) | null = null;
  onEvent: ((e: InteractionEvent) => void) | null = null;

  /** Replaces what can be pointed at (a scene registers its items when it starts). */
  setItems(items: readonly Interactable[]): void {
    this.releaseAll();
    this.restoreGlow();
    this.byMesh.clear();
    this.tracked = items.map((item) => {
      const meshes: Mesh[] = [];
      const glows: Glow[] = [];
      item.object.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        meshes.push(mesh);
        const mat = mesh.material;
        if (Array.isArray(mat)) return;
        const m = mat as Material & { emissive?: Color; emissiveIntensity?: number };
        if (m.emissive && !glows.some((g) => g.mat === m)) {
          glows.push({ mat: m as Glow['mat'], base: m.emissive.clone(), baseIntensity: m.emissiveIntensity ?? 1 });
        }
      });
      if (item.kind === 'grab' && !item.home) {
        item.home = { position: item.object.position.clone(), quaternion: item.object.quaternion.clone() };
      }
      const t: Tracked = { item, meshes, glows, level: 0, applied: 0 };
      meshes.forEach((m) => this.byMesh.set(m, t));
      return t;
    });
  }

  /** Moves an object smoothly to a pose (in its parent's space); used for snaps and returns. */
  glide(object: Object3D, position: Vector3, quaternion: Quaternion = object.quaternion, done?: () => void): void {
    const existing = this.glides.findIndex((g) => g.object === object);
    if (existing >= 0) this.glides.splice(existing, 1);
    this.glides.push({ object, position: position.clone(), quaternion: quaternion.clone(), done });
  }

  /** Puts a grab item back where it started, immediately. */
  resetItem(item: Interactable): void {
    if (item.home) {
      item.object.position.copy(item.home.position);
      item.object.quaternion.copy(item.home.quaternion);
    }
    const g = this.glides.findIndex((x) => x.object === item.object);
    if (g >= 0) this.glides.splice(g, 1);
  }

  releaseAll(): void {
    for (const s of this.sources.values()) {
      s.held = null;
      s.hovered = null;
      if (s.dragging) s.dragging.item.onDrag?.(this.raycaster.ray, 'end');
      s.dragging = null;
    }
    this.glides.length = 0;
  }

  private restoreGlow(): void {
    for (const t of this.tracked) this.applyGlow(t, 0);
  }

  private applyGlow(t: Tracked, level: number): void {
    t.applied = level;
    const color = tmpColor.set(t.item.accent ?? '#ffd27a');
    for (const g of t.glows) {
      g.mat.emissive.copy(g.base).lerp(color, level);
      g.mat.emissiveIntensity = g.baseIntensity + level * 0.7;
    }
  }

  /** The label to show now (the first pointer that hovers something with a caption). */
  hoverInfo(frames: readonly PointerFrame[]): { item: Interactable; point: Vector3 } | null {
    for (const f of frames) {
      const item = f.holding ?? f.hovered;
      if (item?.label && f.point) return { item, point: f.point };
    }
    return null;
  }

  /**
   * Call once per frame. `limits` (optional, per source id) is the distance of something in front of the
   * scene, such as a menu panel: the scene's items behind it are not hovered.
   */
  update(dt: number, sources: readonly PointerSource[], limits?: ReadonlyMap<number, number>): PointerFrame[] {
    this.time += dt;
    const frames: PointerFrame[] = [];
    const meshes: Mesh[] = [];
    for (const t of this.tracked) {
      if (t.item.enabled && !t.item.enabled()) continue;
      for (const m of t.meshes) if (chainVisible(m)) meshes.push(m);
    }
    // Targets are aimed at before the renderer has updated their matrices this frame.
    for (const t of this.tracked) t.item.object.updateWorldMatrix(true, true);

    const hoveredNow = new Set<Tracked>();
    for (const src of sources) {
      let st = this.sources.get(src.id);
      if (!st) {
        st = { down: false, hovered: null, held: null, dist: 1, offset: new Vector3(), dragging: null };
        this.sources.set(src.id, st);
      }
      this.raycaster.set(src.origin, src.direction);
      this.raycaster.ray.direction.normalize();
      const frame: PointerFrame = { id: src.id, distance: null, point: null, hovered: null, holding: st.held?.item ?? null };

      if (st.held) {
        // Carrying: the object follows the ray at the distance it was picked up.
        const t = st.held;
        const o = t.item.object;
        const target = tmpV.copy(src.origin).addScaledVector(this.raycaster.ray.direction, st.dist).add(st.offset);
        if (o.parent) {
          o.parent.updateWorldMatrix(true, false);
          const k = 1 - Math.exp(-dt * 20);
          o.getWorldPosition(tmpV2);
          tmpV2.lerp(target, k);
          t.item.onHeld?.(tmpV2);
          o.parent.worldToLocal(tmpV2);
          o.position.copy(tmpV2);
          if (o.position.y < 0.03) o.position.y = 0.03; // never through the floor
        }
        frame.point = target.clone();
        frame.distance = src.origin.distanceTo(target);
        hoveredNow.add(t);
        if (!src.down) {
          this.drop(src.id, st, t);
          frame.holding = null;
        }
      } else if (st.dragging) {
        const t = st.dragging;
        if (src.down) t.item.onDrag?.(this.raycaster.ray, 'move');
        else {
          t.item.onDrag?.(this.raycaster.ray, 'end');
          st.dragging = null;
        }
        frame.hovered = t.item;
        hoveredNow.add(t);
        const hit = this.raycaster.intersectObjects(t.meshes, false)[0];
        if (hit) {
          frame.point = hit.point.clone();
          frame.distance = hit.distance;
        }
      } else {
        const hits = this.raycaster.intersectObjects(meshes, false);
        const limit = limits?.get(src.id) ?? Infinity;
        const hit = hits.find((h) => h.distance < limit);
        const t = hit ? this.byMesh.get(hit.object) ?? null : null;
        if (hit && t) {
          frame.distance = hit.distance;
          frame.point = hit.point.clone();
          frame.hovered = t.item;
          hoveredNow.add(t);
          if (st.hovered !== t) {
            this.onEvent?.({ kind: 'hover', item: t.item });
            this.onHaptic?.(src.id, 0.12, 14);
          }
          st.hovered = t;
          if (src.down && !st.down) this.begin(src, st, t, hit);
        } else {
          st.hovered = null;
          if (hit === undefined && hits[0]) {
            // Something else is hit first (scenery): the ray stops there.
            frame.distance = hits[0].distance;
          }
        }
        const nowHeld = (st as SourceState).held;
        if (nowHeld) frame.holding = nowHeld.item;
      }
      st.down = src.down;
      frames.push(frame);
    }

    // Glow: hovered or held items light up; items with a hint pulse softly.
    for (const t of this.tracked) {
      const wanted = hoveredNow.has(t) ? 1 : t.item.hint ? 0.18 + 0.16 * Math.sin(this.time * 3) : 0;
      t.level += (wanted - t.level) * (1 - Math.exp(-dt * 12));
      if (Math.abs(t.level - t.applied) > 0.01) this.applyGlow(t, Math.max(0, t.level));
    }

    this.stepGlides(dt);
    return frames;
  }

  private begin(src: PointerSource, st: SourceState, t: Tracked, hit: Intersection): void {
    const item = t.item;
    if (item.kind === 'press') {
      this.onEvent?.({ kind: 'press', item });
      this.onHaptic?.(src.id, 0.35, 28);
      item.onPress?.(hit, src.id);
    } else if (item.kind === 'grab') {
      st.held = t;
      st.dist = Math.min(GRAB_MAX, Math.max(GRAB_MIN, hit.distance));
      item.object.getWorldPosition(tmpV);
      st.offset.copy(tmpV).sub(hit.point);
      const g = this.glides.findIndex((x) => x.object === item.object);
      if (g >= 0) this.glides.splice(g, 1);
      this.onEvent?.({ kind: 'grab', item });
      this.onHaptic?.(src.id, 0.45, 35);
      item.onGrab?.();
    } else {
      st.dragging = t;
      this.onEvent?.({ kind: 'press', item });
      item.onDrag?.(this.raycaster.ray, 'start');
    }
  }

  private drop(id: number, st: SourceState, t: Tracked): void {
    const item = t.item;
    st.held = null;
    item.object.getWorldPosition(tmpV);
    const taken = item.onRelease?.(tmpV.clone()) ?? false;
    this.onEvent?.({ kind: 'drop', item });
    this.onHaptic?.(id, 0.2, 20);
    if (!taken && item.home) this.glide(item.object, item.home.position, item.home.quaternion);
  }

  private stepGlides(dt: number): void {
    const k = 1 - Math.exp(-dt * 11);
    for (let i = this.glides.length - 1; i >= 0; i--) {
      const g = this.glides[i]!;
      g.object.position.lerp(g.position, k);
      g.object.quaternion.slerp(tmpQ.copy(g.quaternion), k);
      if (g.object.position.distanceToSquared(g.position) < 1e-6 && g.object.quaternion.angleTo(g.quaternion) < 0.01) {
        g.object.position.copy(g.position);
        g.object.quaternion.copy(g.quaternion);
        this.glides.splice(i, 1);
        g.done?.();
      }
    }
  }

  dispose(): void {
    this.restoreGlow();
    this.tracked = [];
    this.byMesh.clear();
    this.sources.clear();
    this.glides.length = 0;
  }
}

const tmpColor = new Color();
