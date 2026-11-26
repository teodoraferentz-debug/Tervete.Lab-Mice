import {
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
} from 'three';
import type { ArRenderHost } from '../ar/ArAdapter';
import type { Guardian, GuardianId } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import type { SceneClock } from '../experience/SceneClock';
import { fitView, type ViewGoal } from './cameraRig';
import { initialQuality, QualityGovernor, stepDown, TIERS, type QualityName } from './quality';
import { TABLE } from './forest/propKit';
import type { PointerFrame, PointerSource } from './forest/interaction';
import type { SoundKind } from './forest/types';
import { MAP_W } from './textures';
import type { ScreenPoint, StageApi } from './StageApi';
import { VR_FOVEATION, VR_RESOLUTION_SCALE } from '../vr/layout';
import type { VrActions } from '../vr/types';
import { VrRig, type Playback } from '../vr/VrRig';
import { World } from './World';

export type { ScreenPoint };

/** Vertical field of view of the screen camera for a scene (the clearing is framed for it). */
const SCENE_FOV = 50;

export interface StageOptions {
  reducedMotion: boolean;
  /** A zone has just been lit (map shown after a completed scene). */
  onActivate?: (id: GuardianId) => void;
  /** The memorable visual moment of a scene started. */
  onMoment?: (id: GuardianId | 'finale') => void;
  onQualityChange?: (name: QualityName) => void;
  /** The headset session ended (headset off, system menu, or the in-VR Exit button). */
  onVrEnd?: () => void;
  /** An interaction made a sound (a bar struck, a leaf picked up). The app plays it. */
  onSound?: (kind: SoundKind, index?: number) => void;
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
  private vr: VrRig | null = null;
  private xrSession: XRSession | null = null;
  private qualityBeforeVr: QualityName = 'medium';
  private vrAnchored = false;
  private vrFrames = 0;
  /** True when the headset's reference space has its origin on the floor (local-floor). */
  private vrFloor = false;
  private readonly mouse = { ndc: new Vector2(), down: false, present: false };
  private readonly caster = new Raycaster();
  /** What is playing now (a story scene or the finale), for the headset's captions. */
  private playback: Playback | null = null;

  constructor(
    container: HTMLElement,
    private readonly opts: StageOptions,
  ) {
    this.container = container;
    this.reducedMotion = opts.reducedMotion;
    this.world = new World();
    this.internalScene.add(this.world.root);
    this.world.onMoment = (id) => opts.onMoment?.(id);
    this.world.onSound = (kind, index) => opts.onSound?.(kind, index);
    this.world.onForest = (shown) => this.onForest(shown);
    this.world.interaction.onHaptic = (id, strength, ms) => this.vr?.haptic(id, strength, ms);

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
    if (this.renderer) {
      this.listenToMouse(this.renderer.domElement);
      void this.world.loadForest().then((sky) => {
        // Image-based lighting from the same photographed forest the sky shows.
        if (!sky || !this.renderer || this.disposed) return;
        const pmrem = new PMREMGenerator(this.renderer);
        this.internalScene.environment = pmrem.fromEquirectangular(sky).texture;
        this.internalScene.environmentIntensity = 0.75;
        pmrem.dispose();
      });
    }

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
    this.playback = null;
    // Coming back from a story scene is a cut, not a swoop through the (previously hidden) map.
    if (this.world.mode === 'attraction') this.snapNext = true;
    this.world.showMap(visited, justActivated, !this.mapShown);
    this.mapShown = true;
    this.applyFov();
    if (justActivated) this.opts.onActivate?.(justActivated);
    this.setView(() => this.mapView());
  }

  playAttraction(guardian: Guardian, clock: SceneClock): void {
    this.clock = clock;
    this.playback = { guardian, clock, beats: guardian.pitchBeats };
    this.world.playAttraction(guardian, clock);
    // The scene has its own camera (tick()): a slow, gentle drift over the table.
    this.snapNext = true;
    this.applyFov();
  }

  playFinale(clock: SceneClock): void {
    this.clock = clock;
    this.playback = { guardian: null, clock, beats: PITCH.finale.beats };
    this.world.playFinale(clock);
    this.applyFov();
    this.setView(() => fitView(this.camera, this.world.finaleBox(), 0, 0.36, 0.92, 0.8));
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.snapNext = true;
  }

  // ── VR (WebXR immersive session) ───────────────────────────────────────────

  /**
   * Starts a headset session. Must be called from a user gesture (the Enter VR button). The map becomes a
   * tabletop miniature, scenes become a theatre in front of the player, and the headset UI (captions,
   * menu, pointing) is drawn in 3D by VrRig. Rejects if the browser or device cannot do it.
   */
  async enterVr(actions: VrActions): Promise<void> {
    const renderer = this.renderer;
    const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
    if (!renderer || !xr || this.vr || this.host || this.disposed) throw new Error('VR is not available');
    const session = await xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'local'] });
    // 'local-floor' puts the origin on the real floor, so the table stands at a real table height.
    const features = (session as XRSession & { enabledFeatures?: string[] }).enabledFeatures;
    this.vrFloor = !!features?.includes('local-floor');
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType(this.vrFloor ? 'local-floor' : 'local');
    renderer.xr.setFramebufferScaleFactor(VR_RESOLUTION_SCALE);
    renderer.xr.setFoveation(VR_FOVEATION);
    await renderer.xr.setSession(session);

    this.stopLoop();
    this.xrSession = session;
    this.vrAnchored = false;
    this.vrFrames = 0;
    this.qualityBeforeVr = this.quality;
    this.applyQuality('low'); // Quest 1 is a 2019 phone-class GPU
    this.world.setVr(true);
    this.vr = new VrRig({
      renderer,
      scene: this.internalScene,
      world: this.world,
      actions,
      playback: () => this.playback,
      exit: () => void session.end(),
    });
    this.internalScene.add(this.vr.group, this.vr.inputGroup);
    session.addEventListener('end', this.onVrEnded);

    this.running = true;
    this.last = performance.now();
    renderer.setAnimationLoop(this.tick);
  }

  /** Places the VR content where the player is standing, facing the way they face. */
  private anchorVr(): void {
    const renderer = this.renderer;
    if (!renderer || !this.vr) return;
    const cam = renderer.xr.getCamera();
    const origin = cam.getWorldPosition(new Vector3());
    const forward = new Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new Quaternion()));
    forward.y = 0;
    const yaw = forward.lengthSq() < 1e-6 ? 0 : Math.atan2(-forward.x, -forward.z);
    // Without a floor reference, assume a standing eye height of 1.6 m (works the same seated: the table is just lower).
    // (A runtime that claims a floor but reports the head near the floor, such as an emulator, gets the same estimate.)
    const floorY = this.vrFloor && origin.y > 0.9 ? 0 : origin.y - 1.6;
    this.world.setVrAnchor(origin, yaw, floorY);
    this.vr.setAnchor(origin, yaw, floorY);
    this.vrAnchored = true;
  }

  exitVr(): void {
    void this.xrSession?.end();
  }

  private onVrEnded = (): void => {
    const renderer = this.renderer;
    this.xrSession?.removeEventListener('end', this.onVrEnded);
    this.xrSession = null;
    if (renderer) {
      renderer.setAnimationLoop(null);
      renderer.xr.enabled = false;
    }
    this.vr?.dispose();
    this.vr = null;
    this.world.setVr(false);
    this.applyQuality(this.qualityBeforeVr);
    this.running = false;
    this.snapNext = true;
    if (!this.disposed) {
      this.start();
      this.resize();
      this.applyFov();
    }
    this.opts.onVrEnd?.();
  };

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
    void this.xrSession?.end();
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
      // (Resizing the canvas is not allowed while a headset is presenting.)
      if (!this.renderer.xr.isPresenting) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.maxDpr));
      this.renderer.shadowMap.enabled = tier.shadows;
    }
    this.opts.onQualityChange?.(name);
  }

  /** Map and finale use a fixed lens; a scene uses a natural 50° lens and backs the camera off to fit narrow screens. */
  private applyFov(): void {
    const aspect = this.camera.aspect;
    this.camera.fov = this.world.mode === 'attraction' ? SCENE_FOV : aspect < 0.85 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  /**
   * The screen camera for a scene: eye height, looking down at the table, a slow drift and a gentle push-in
   * over the scene. On a narrow screen it backs off so the table still fits.
   */
  private sceneCamera(): void {
    const m = this.motion;
    const dur = this.clock?.duration ?? 30;
    const progress = this.clock ? this.clock.time / dur : 0;
    const half = Math.tan((SCENE_FOV * Math.PI) / 360);
    const dist = Math.min(4.6, Math.max(2.7, 2.5 / (half * this.camera.aspect))) * (1 - 0.07 * progress * m);
    this.camera.position.set(0.2 + Math.sin(this.time * 0.15) * 0.1 * m, 1.72 + Math.sin(this.time * 0.11) * 0.03 * m, TABLE.z - 0.15 + dist);
    this.camera.lookAt(0.3, 0.9, TABLE.z - 0.1);
    this.pos.copy(this.camera.position);
  }

  private onForest(shown: boolean): void {
    if (shown) this.world.forest.applyTo(this.internalScene);
    else {
      this.internalScene.fog = null;
      this.internalScene.background = null;
    }
  }

  // ── pointing ──────────────────────────────────────────────────────────────

  private listenToMouse(el: HTMLElement): void {
    const set = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect();
      this.mouse.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.mouse.present = true;
    };
    el.addEventListener('pointermove', set);
    el.addEventListener('pointerdown', (e) => {
      set(e);
      this.mouse.down = true;
      el.setPointerCapture?.(e.pointerId);
    });
    const up = (e: PointerEvent): void => {
      this.mouse.down = false;
      if (e.pointerType !== 'mouse') this.mouse.present = false;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => {
      if (!this.mouse.down) this.mouse.present = false;
    });
  }

  private pointer(dt: number): PointerFrame[] {
    const interaction = this.world.interaction;
    if (this.vr) return this.vr.point(dt, interaction);
    const sources: PointerSource[] = [];
    if (!this.host && this.world.mode === 'attraction' && (this.mouse.present || this.mouse.down)) {
      this.camera.updateMatrixWorld(true);
      this.caster.setFromCamera(this.mouse.ndc, this.camera);
      sources.push({ id: 0, origin: this.caster.ray.origin.clone(), direction: this.caster.ray.direction.clone(), down: this.mouse.down });
    }
    const frames = interaction.update(dt, sources);
    const canvas = this.renderer?.domElement;
    if (canvas) canvas.style.cursor = frames[0]?.holding ? 'grabbing' : frames[0]?.hovered ? 'pointer' : '';
    return frames;
  }

  private resize(): void {
    if (this.vr || this.renderer?.xr.isPresenting) return; // the headset sets the size
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.applyFov();
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

    // The head pose is only valid once a few frames have been rendered, so anchor on the third.
    if (this.vr && !this.vrAnchored && ++this.vrFrames >= 3) this.anchorVr();

    if (this.vr) {
      // The headset owns the camera: never move it (that would make the player sick).
    } else if (!this.host && this.world.mode === 'attraction') {
      this.sceneCamera();
    } else if (!this.host && this.goal) {
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

    // Pointing: the headset's controllers, or the mouse / a finger on the screen
    const frames = this.pointer(dt);
    this.world.update(dt, this.time, this.motion, frames);
    this.vr?.update(dt, this.time);

    const renderer = this.host?.renderer ?? this.renderer;
    const scene = this.host?.scene ?? this.internalScene;
    const camera = this.host?.camera ?? this.camera;
    renderer?.render(scene, camera);

    if (!this.host && !this.vr && this.governor.record(dt) && this.quality !== 'low') {
      this.applyQuality(stepDown(this.quality));
      this.governor.reset();
    }
    this.listeners.forEach((l) => l());
  };
}
