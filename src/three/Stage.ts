import {
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Camera,
} from 'three';
import type { ArRenderHost } from '../ar/ArAdapter';
import type { Guardian, GuardianId } from '../content/guardians';
import type { SceneClock } from '../experience/SceneClock';
import { fitView, type ViewGoal } from './cameraRig';
import { initialQuality, QualityGovernor, stepDown, TIERS, type QualityName } from './quality';
import { MAP_W } from './textures';
import type { ScreenPoint, StageApi } from './StageApi';
import { World } from './World';

export type { ScreenPoint };

export interface StageOptions {
  reducedMotion: boolean;
  /** A zone has just been lit (map shown after a completed scene). */
  onActivate?: (id: GuardianId) => void;
  /** The memorable visual moment of a scene started. */
  onMoment?: (id: GuardianId | 'finale') => void;
  onQualityChange?: (name: QualityName) => void;
}

type FrameListener = () => void;

/**
 * Owns the renderer, camera, render loop and the World. React never touches Three.js
 * objects directly; scenes talk to the stage through showMap / playAttraction / playFinale.
 *
 * When an AR backend takes over (useHost), the same World is parented to the tracked
 * anchor and the AR renderer/camera are used; the camera rig stands down.
 */
export class Stage implements StageApi {
  readonly world: World;
  /** False when WebGL is unavailable: captions and scene timing still run. */
  readonly webgl: boolean;

  private readonly container: HTMLElement;
  private readonly internalScene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.05, 120);
  private renderer: WebGLRenderer | null = null;
  private host: ArRenderHost | null = null;
  private readonly governor = new QualityGovernor();
  private quality: QualityName = initialQuality();
  private reducedMotion: boolean;
  private resizeObserver: ResizeObserver | null = null;
  private raf = 0;
  private running = false;
  private last = 0;
  private time = 0;
  private clock: SceneClock | null = null;
  private readonly listeners = new Set<FrameListener>();
  private view: (() => ViewGoal) | null = null;
  private readonly pos = new Vector3(0, 8, 8);
  private readonly look = new Vector3();
  private goal: ViewGoal | null = null;
  private snapNext = true;
  private mapShown = false;
  private disposed = false;

  constructor(
    container: HTMLElement,
    private readonly opts: StageOptions,
  ) {
    this.container = container;
    this.reducedMotion = opts.reducedMotion;
    this.world = new World();
    this.internalScene.add(this.world.root);
    this.world.onMoment = (id) => opts.onMoment?.(id);

    try {
      const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.type = PCFSoftShadowMap;
      renderer.domElement.className = 'stage-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      container.appendChild(renderer.domElement);
      this.renderer = renderer;
    } catch (error) {
      console.warn('[stage] WebGL is not available:', error);
    }
    this.webgl = this.renderer !== null;

    this.applyQuality(this.quality);
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
    this.start();
  }

  // ── scene API ─────────────────────────────────────────────────────────────

  showMap(visited: readonly GuardianId[], justActivated: GuardianId | null): void {
    this.clock = null;
    this.world.showMap(visited, justActivated, !this.mapShown);
    this.mapShown = true;
    if (justActivated) this.opts.onActivate?.(justActivated);
    this.setView(() => this.mapView());
  }

  playAttraction(guardian: Guardian, clock: SceneClock): void {
    this.clock = clock;
    this.world.playAttraction(guardian, clock);
    this.setView(() => {
      // Look slightly inward from the zone's outer side, so the forest (not the table edge) is the backdrop.
      const yaw = Math.max(-0.35, Math.min(0.35, (this.world.zones.get(guardian.id)?.worldPosition.x ?? 0) * 0.1));
      return fitView(this.camera, this.world.zoneBox(guardian.id), yaw, 0.5, 0.9, 0.74);
    });
  }

  playFinale(clock: SceneClock): void {
    this.clock = clock;
    this.world.playFinale(clock);
    this.setView(() => fitView(this.camera, this.world.finaleBox(), 0, 0.36, 0.92, 0.8));
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.snapNext = true;
  }

  // ── AR host ───────────────────────────────────────────────────────────────

  /** Hand rendering to an AR backend (MindAR) or take it back with null. */
  useHost(host: ArRenderHost | null): void {
    if (this.disposed) return;
    this.stopLoop();
    if (this.host) this.host.renderer.setAnimationLoop(null);
    this.host = host;

    const root = this.world.root;
    if (host) {
      this.internalScene.remove(root);
      host.anchor.add(root);
      // Anchor space: 1 unit = map width, +Z out of the paper. The diorama is Y-up on the XZ plane.
      root.rotation.x = Math.PI / 2;
      root.scale.setScalar(1 / MAP_W);
      this.world.setExternal(true);
      if (this.renderer) this.renderer.domElement.style.display = 'none';
      host.renderer.shadowMap.enabled = false;
    } else {
      root.parent?.remove(root);
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(1);
      this.internalScene.add(root);
      this.world.setExternal(false);
      if (this.renderer) this.renderer.domElement.style.display = '';
      this.snapNext = true;
    }
    this.start();
  }

  // ── projection (for the HTML zone markers) ────────────────────────────────

  private readonly tmp = new Vector3();

  project(id: GuardianId, out: ScreenPoint): ScreenPoint {
    const zone = this.world.zones.get(id);
    const camera: Camera = this.host?.camera ?? this.camera;
    if (!zone) {
      out.visible = false;
      return out;
    }
    zone.markerPosition(this.tmp);
    this.world.root.localToWorld(this.tmp);
    this.tmp.project(camera);
    const rect = this.container.getBoundingClientRect();
    out.x = (this.tmp.x * 0.5 + 0.5) * rect.width;
    out.y = (-this.tmp.y * 0.5 + 0.5) * rect.height;
    out.visible = this.tmp.z > -1 && this.tmp.z < 1 && this.isShown(zone.group);
    return out;
  }

  private isShown(obj: { visible: boolean; parent: unknown }): boolean {
    let o: { visible: boolean; parent: unknown } | null = obj;
    while (o) {
      if (!o.visible) return false;
      o = (o.parent as { visible: boolean; parent: unknown } | null) ?? null;
    }
    return true;
  }

  onFrame(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get currentQuality(): QualityName {
    return this.quality;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.host?.renderer.setAnimationLoop(null);
    this.world.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.listeners.clear();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private get motion(): number {
    return this.reducedMotion ? 0 : 1;
  }

  private mapView(): ViewGoal {
    const portrait = this.camera.aspect < 0.85;
    // On a tall phone screen the long side of the landscape map runs top to bottom.
    return fitView(this.camera, this.world.mapBox(), portrait ? Math.PI / 2 : 0, portrait ? 0.95 : 0.9, 0.93, 0.82);
  }

  private setView(make: () => ViewGoal): void {
    this.view = make;
    this.goal = make();
    if (this.snapNext || this.reducedMotion) {
      this.pos.copy(this.goal.position);
      this.look.copy(this.goal.target);
      this.snapNext = false;
    }
  }

  private applyQuality(name: QualityName): void {
    this.quality = name;
    const tier = TIERS[name];
    this.world.setQuality(tier);
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxDpr));
      this.renderer.shadowMap.enabled = tier.shadows;
    }
    this.opts.onQualityChange?.(name);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.85 ? 46 : 38;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(w, h, false);
    if (this.renderer) {
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
    }
    if (this.view && !this.host) {
      this.goal = this.view();
      if (this.reducedMotion) {
        this.pos.copy(this.goal.position);
        this.look.copy(this.goal.target);
      }
    }
  }

  private start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.last = performance.now();
    if (this.host) {
      this.host.renderer.setAnimationLoop(this.tick);
    } else {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.tick(now);
    this.raf = requestAnimationFrame(this.loop);
  };

  private tick = (now: number): void => {
    const elapsed = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    // Animation steps are clamped for smoothness; the scene clock follows real time (up to 0.5 s per
    // frame) so a slow device does not stretch a 30 s scene, and a hidden tab does not skip it.
    const dt = Math.min(0.1, elapsed);
    this.time += dt;

    this.clock?.tick(Math.min(0.5, elapsed));
    this.world.update(dt, this.time, this.motion);

    if (!this.host && this.goal) {
      const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 2.6);
      this.pos.lerp(this.goal.position, k);
      this.look.lerp(this.goal.target, k);
      this.camera.position.copy(this.pos);
      if (!this.reducedMotion && this.world.mode === 'map') {
        // Barely-there idle drift so the map feels alive
        this.camera.position.x += Math.sin(this.time * 0.25) * 0.12;
        this.camera.position.y += Math.sin(this.time * 0.19) * 0.05;
      }
      this.camera.lookAt(this.look);
    }

    const renderer = this.host?.renderer ?? this.renderer;
    const scene = this.host?.scene ?? this.internalScene;
    const camera = this.host?.camera ?? this.camera;
    renderer?.render(scene, camera);

    if (!this.host && this.governor.record(dt) && this.quality !== 'low') {
      this.applyQuality(stepDown(this.quality));
      this.governor.reset();
    }
    this.listeners.forEach((l) => l());
  };
}
