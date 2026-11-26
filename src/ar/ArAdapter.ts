import type { Camera, Group, Scene, WebGLRenderer } from 'three';
import type { ArStatus } from '../experience/sceneTypes';

/**
 * What an AR backend hands the app when it owns the camera + renderer (MindAR does).
 * The diorama is parented to `anchor`, which follows the printed map.
 * Adapters that only simulate tracking return null from `start()` and the app keeps its own renderer.
 */
export interface ArRenderHost {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  /** Origin = centre of the printed map, 1 unit = map width, +Z points out of the paper. */
  anchor: Group;
}

export type ArStatusListener = (status: ArStatus) => void;

/**
 * The only contract the rest of the app knows about AR.
 * Nothing outside src/ar imports MindAR, and Magic Mode never touches this layer.
 */
export interface ArAdapter {
  readonly kind: 'mindar' | 'mock';
  readonly status: ArStatus;
  /**
   * Starts camera + recognition inside `container`. Failures are reported as a status
   * ('denied' | 'unsupported' | 'error'), never thrown, so the app can fall back to Magic Mode.
   */
  start(container: HTMLElement): Promise<ArRenderHost | null>;
  stop(): Promise<void>;
  subscribe(listener: ArStatusListener): () => void;
}

export abstract class ArAdapterBase implements ArAdapter {
  abstract readonly kind: 'mindar' | 'mock';
  abstract start(container: HTMLElement): Promise<ArRenderHost | null>;
  abstract stop(): Promise<void>;

  status: ArStatus = 'idle';
  private readonly listeners = new Set<ArStatusListener>();

  subscribe(listener: ArStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  protected emit(status: ArStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }
}
