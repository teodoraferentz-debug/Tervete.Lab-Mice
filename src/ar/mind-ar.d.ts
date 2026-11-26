// Minimal typings for the part of mind-ar's three.js build that we use.
declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  import type { Camera, Group, Scene, WebGLRenderer } from 'three';

  export interface MindArAnchor {
    group: Group;
    onTargetFound: (() => void) | null;
    onTargetLost: (() => void) | null;
  }

  export class MindARThree {
    constructor(options: {
      container: HTMLElement;
      imageTargetSrc: string;
      maxTrack?: number;
      uiLoading?: 'yes' | 'no';
      uiScanning?: 'yes' | 'no';
      uiError?: 'yes' | 'no';
      filterMinCF?: number;
      filterBeta?: number;
      warmupTolerance?: number;
      missTolerance?: number;
    });
    renderer: WebGLRenderer;
    scene: Scene;
    camera: Camera;
    start(): Promise<void>;
    stop(): void;
    addAnchor(targetIndex: number): MindArAnchor;
  }
}
