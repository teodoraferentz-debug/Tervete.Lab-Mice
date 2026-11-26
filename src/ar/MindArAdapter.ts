import { ArAdapterBase, type ArRenderHost } from './ArAdapter';

/** Where the compiled image target (from the printed A3 map) is expected. See docs/technical-notes.md. */
export const DEFAULT_TARGET_SRC = `${import.meta.env.BASE_URL}assets/markers/tervete-map.mind`;

type MindArModule = typeof import('mind-ar/dist/mindar-image-three.prod.js');
type MindArThreeInstance = InstanceType<MindArModule['MindARThree']>;

/**
 * MindAR integration. Isolated on purpose:
 *  - loaded with a dynamic import, so Magic Mode never downloads TensorFlow/MindAR;
 *  - every failure becomes an ArStatus, and the app continues in Magic Mode.
 */
export class MindArAdapter extends ArAdapterBase {
  readonly kind = 'mindar' as const;
  private mindar: MindArThreeInstance | null = null;

  constructor(private readonly targetSrc: string = DEFAULT_TARGET_SRC) {
    super();
  }

  async start(container: HTMLElement): Promise<ArRenderHost | null> {
    this.emit('starting');

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.emit('unsupported');
      return null;
    }

    if (!(await this.markerExists())) {
      console.warn(`[AR] Marker file not found at ${this.targetSrc}. Compile the map image first (docs/technical-notes.md).`);
      this.emit('error');
      return null;
    }

    try {
      const { MindARThree } = await import('mind-ar/dist/mindar-image-three.prod.js');
      const mindar = new MindARThree({
        container,
        imageTargetSrc: this.targetSrc,
        uiLoading: 'no',
        uiScanning: 'no',
        uiError: 'no',
      });
      this.mindar = mindar;
      await mindar.start();

      const anchor = mindar.addAnchor(0);
      anchor.onTargetFound = () => this.emit('tracking');
      anchor.onTargetLost = () => this.emit('lost');
      this.emit('scanning');
      return { renderer: mindar.renderer, scene: mindar.scene, camera: mindar.camera, anchor: anchor.group };
    } catch (error) {
      console.warn('[AR] MindAR failed to start:', error);
      this.mindar = null;
      this.emit(isPermissionError(error) ? 'denied' : 'error');
      return null;
    }
  }

  async stop(): Promise<void> {
    const mindar = this.mindar;
    this.mindar = null;
    if (mindar) {
      try {
        mindar.renderer.setAnimationLoop(null);
        mindar.stop();
      } catch (error) {
        console.warn('[AR] MindAR did not stop cleanly:', error);
      }
    }
    this.emit('idle');
  }

  /** Vite's dev server answers unknown paths with index.html (200), so check the type too. */
  private async markerExists(): Promise<boolean> {
    try {
      const res = await fetch(this.targetSrc, { method: 'GET' });
      if (!res.ok) return false;
      return !(res.headers.get('content-type') ?? '').includes('text/html');
    } catch {
      return false;
    }
  }
}

function isPermissionError(error: unknown): boolean {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError' ||
    /permission|denied|not allowed/i.test(message)
  );
}
