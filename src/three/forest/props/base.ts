import { Group, Quaternion, Vector3, type Object3D } from 'three';
import type { CueKind } from '../../../content/guardians';
import { easeOutBack } from '../../util';
import type { Interactable } from '../interaction';
import { TABLE } from '../propKit';
import type { Gateway } from './dressing';
import type { Cues, PropSet, SceneCtx } from '../types';

interface Appear {
  obj: Object3D;
  after: CueKind;
  delay: number;
  baseScale: number;
  progress: number;
}

/**
 * Shared plumbing for a guardian's props: things pop in on a cue, items only become pointable once they
 * are there, and a replay starts from the identical state.
 */
export abstract class BaseProps implements PropSet {
  readonly group = new Group();
  readonly items: Interactable[] = [];
  private readonly appears: Appear[] = [];
  private readonly shown = new Set<Object3D>();

  constructor(protected readonly ctx: SceneCtx) {}

  /** The object is hidden (scale 0) until `after` + `delay` seconds into the scene, then pops in. */
  protected appear(obj: Object3D, delay: number, after: CueKind = 'activity'): void {
    const baseScale = obj.scale.x;
    obj.scale.setScalar(0.0001);
    obj.visible = false;
    this.appears.push({ obj, after, delay, baseScale, progress: 0 });
  }

  /** The scene's gateway (posts, sign, lanterns) and what can be poked on it. */
  protected addGateway(g: Gateway): void {
    this.group.add(g.group);
    for (const item of g.items) this.items.push(item);
  }

  protected isShown(obj: Object3D): boolean {
    return this.shown.has(obj);
  }

  protected add<T extends Interactable>(item: T, root = this.group): T {
    if (!item.enabled) item.enabled = () => this.shown.has(item.object) || !this.appears.some((a) => a.obj === item.object);
    if (!item.object.parent) root.add(item.object);
    this.items.push(item);
    return item;
  }

  update(t: number, cues: Cues, time: number, motion: number): void {
    for (const a of this.appears) {
      const at = (cues[a.after] ?? Infinity) + a.delay;
      const k = motion ? Math.min(1, Math.max(0, (t - at) / 0.55)) : t >= at ? 1 : 0;
      if (k === a.progress) continue;
      a.progress = k;
      const s = k <= 0 ? 0.0001 : Math.max(0.0001, (motion ? easeOutBack(k) : 1) * a.baseScale);
      a.obj.scale.setScalar(s);
      a.obj.visible = k > 0;
      if (k >= 1) this.shown.add(a.obj);
      else if (k <= 0) this.shown.delete(a.obj);
    }
    this.tick(t, cues, time, motion);
  }

  protected abstract tick(t: number, cues: Cues, time: number, motion: number): void;

  reset(): void {
    for (const a of this.appears) {
      a.progress = 0;
      a.obj.scale.setScalar(0.0001);
      a.obj.visible = false;
    }
    this.shown.clear();
    for (const item of this.items) {
      this.ctx.interaction.resetItem(item);
      item.hint = false;
    }
    this.onReset();
  }

  protected abstract onReset(): void;

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as import('three').Mesh;
      m.geometry?.dispose?.();
    });
  }
}

/**
 * If a world position is over the tabletop, the scene-space spot where something dropped there should rest
 * (null when it was let go elsewhere, in which case it returns to where it came from).
 */
export function tableSpot(parent: Object3D, world: Vector3, restHeight: number): Vector3 | null {
  const local = parent.worldToLocal(world.clone());
  const hx = TABLE.width / 2 - 0.08;
  const hz = TABLE.depth / 2 - 0.08;
  if (Math.abs(local.x - TABLE.x) > hx || Math.abs(local.z - TABLE.z) > hz) return null;
  if (local.y < TABLE.top - 0.05 || local.y > TABLE.top + 0.8) return null;
  return new Vector3(local.x, TABLE.top + restHeight, local.z);
}

export const flatQuat = (yaw = 0): Quaternion => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
