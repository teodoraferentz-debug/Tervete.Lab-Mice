import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Raycaster,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  type Camera,
  type Intersection,
  type WebGLRenderer,
} from 'three';
import { GUARDIANS, type Guardian, type GuardianId, type PitchBeat } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import type { SceneClock } from '../experience/SceneClock';
import { allVisited } from '../experience/sceneState';
import { activeCaption, activePrompt } from '../experience/timeline';
import { mapLine } from '../scenes/mapLine';
import type { World } from '../three/World';
import { CanvasPanel, FONTS, wrapLines, type PanelButton } from './CanvasPanel';
import { tablePoint, VR_MAP_POSITION } from './layout';
import type { VrActions } from './types';

export interface Playback {
  guardian: Guardian | null;
  clock: SceneClock;
  beats: readonly PitchBeat[];
}

export interface VrRigDeps {
  renderer: WebGLRenderer;
  scene: Object3D;
  world: World;
  actions: VrActions;
  playback: () => Playback | null;
  /** Ends the immersive session. */
  exit: () => void;
}

interface Hover {
  panel: CanvasPanel | null;
  buttonId: string | null;
  zone: GuardianId | null;
  distance: number;
  point: Vector3;
}

type Layout = 'map' | 'story';

/** Zone label size in metres. */
const LABEL_W = 0.34;
const LABEL_H = 0.1;
const GOLD = '#e2aa18';
const CREAM = '#f9f2de';
const DARK = 'rgba(0,26,17,.9)';

/**
 * Everything the wearer sees and touches that is not the scene itself, all drawn in 3D because the page's
 * HTML does not exist inside a headset: captions, the presenter prompt, zone labels you point at, a
 * floating menu, and the controller rays. Controls (Quest Touch):
 *   trigger  select what the ray points at
 *   A / B    next / previous scene        X  menu        Y  sound
 */
export class VrRig {
  readonly group = new Group();
  /** Controllers live in the headset's own coordinates, so they must not move with the anchored content. */
  readonly inputGroup = new Group();
  private readonly raycaster = new Raycaster();
  private readonly caption = new CanvasPanel(1.5, 0.32, 1200, 256);
  private readonly prompt = new CanvasPanel(1.5, 0.2, 1200, 160);
  private readonly title = new CanvasPanel(0.9, 0.12, 900, 120);
  private readonly note = new CanvasPanel(1.3, 0.1, 1300, 100);
  private readonly awaken = new CanvasPanel(1.0, 0.18, 800, 144);
  private readonly menu = new CanvasPanel(0.56, 0.8, 560, 800);
  private readonly pedestal = new Group();
  private readonly zoneProxies: Array<{ id: GuardianId; hit: Mesh; label: Sprite; texture: CanvasTexture; key: string }> = [];
  private readonly controllers: Array<{ ray: Group; line: Line; dot: Mesh; hover: Hover | null }> = [];
  private readonly padState = new Map<string, boolean>();
  private layout: Layout | null = null;
  private menuOpen = false;
  private confirmRestartUntil = 0;
  private now = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor(private readonly deps: VrRigDeps) {
    const { renderer, world } = deps;

    // A dark floor and a plain pedestal under the map: grounding only (no characters, no props).
    const floor = new Mesh(new CircleGeometry(3.2, 48), new MeshBasicMaterial({ color: '#0a2a1c' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    this.group.add(floor);
    const wood = new MeshStandardMaterial({ color: '#5e3b22', roughness: 0.9 });
    const column = new Mesh(new CylinderGeometry(0.34, 0.5, 0.62, 20), wood);
    column.position.set(VR_MAP_POSITION.x, VR_MAP_POSITION.y - 0.41, VR_MAP_POSITION.z);
    const base = new Mesh(new CylinderGeometry(0.85, 0.95, 0.06, 28), wood);
    base.position.set(VR_MAP_POSITION.x, -1.47, VR_MAP_POSITION.z);
    this.pedestal.add(column, base);
    this.group.add(this.pedestal);

    for (const p of [this.caption, this.prompt, this.title, this.note, this.awaken, this.menu]) this.group.add(p.mesh);
    this.menu.mesh.visible = false;

    // Zone targets on the map: an invisible sphere to point at and a label above it.
    const core = world.core();
    let n = 0;
    for (const g of GUARDIANS) {
      const zone = world.zones.get(g.id);
      if (!zone) continue;
      const base3 = tablePoint(zone.worldPosition, core);
      const hit = new Mesh(new SphereGeometry(0.1, 12, 8), new MeshBasicMaterial({ visible: false }));
      hit.position.copy(base3).add(new Vector3(0, 0.12, 0));
      hit.userData.zone = g.id;
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 150;
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      const label = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
      label.renderOrder = 1001;
      // Labels sit at alternating heights so neighbouring zones do not hide each other.
      label.position.copy(base3).add(new Vector3(0, 0.3 + (n++ % 2) * 0.11, 0));
      label.scale.set(LABEL_W, LABEL_H, 1);
      this.group.add(hit, label);
      this.zoneProxies.push({ id: g.id, hit, label, texture, key: '' });
    }

    // Controllers: a ray and a dot where it lands. `select` (trigger) activates what is pointed at.
    for (let i = 0; i < 2; i++) {
      const ray = renderer.xr.getController(i);
      const line = new Line(
        new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)),
        new LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85 }),
      );
      line.scale.z = 2.5;
      const dot = new Mesh(new SphereGeometry(0.012, 8, 6), new MeshBasicMaterial({ color: '#fff2c4' }));
      dot.visible = false;
      ray.add(line);
      this.inputGroup.add(ray, dot);
      const onSelect = () => this.activate(i);
      ray.addEventListener('selectstart', onSelect);
      this.cleanups.push(() => ray.removeEventListener('selectstart', onSelect));
      this.controllers.push({ ray, line, dot, hover: null });
    }
  }

  // ── per frame ──────────────────────────────────────────────────────────────

  /** Moves everything to where the player stands, turned to face the way they face. */
  setAnchor(origin: Vector3, yaw: number): void {
    this.group.position.copy(origin);
    this.group.rotation.set(0, yaw, 0);
    this.group.updateMatrixWorld(true);
  }

  update(_dt: number, time: number): void {
    this.now = time;
    const { actions, world, playback } = this.deps;
    const state = actions.getState();
    const pb = playback();
    const inScene = world.mode === 'attraction' && pb?.guardian != null;
    const inFinale = world.mode === 'finale';
    const onMap = state.scene === 'map' && !inScene && !inFinale;
    this.applyLayout(onMap || inFinale ? 'map' : 'story');
    this.pedestal.visible = world.diorama.visible;

    // Captions, prompt, title, safety note
    const t = pb?.clock.time ?? 0;
    let captionSpeaker = 'Tērvete';
    let captionText = '';
    let promptText = '';
    let titleText: string;
    let accent = GOLD;
    let noteText = '';
    if (inScene && pb?.guardian) {
      const g = pb.guardian;
      accent = g.themeColor;
      const cap = activeCaption(pb.beats, t)?.beat;
      if (cap) {
        captionText = cap.text;
        captionSpeaker = cap.speaker === 'mascot' ? g.name : 'In the park';
      }
      promptText = activePrompt(pb.beats, t)?.text ?? '';
      titleText = `${g.name} · ${g.senseLabel} · ${g.zone.name}`;
      const activityAt = g.pitchBeats.find((b) => b.cue === 'activity')?.at;
      if (g.safetyNote && activityAt !== undefined && t >= activityAt) noteText = g.safetyNote;
    } else if (inFinale && pb) {
      const cap = activeCaption(pb.beats, t)?.beat;
      if (cap) {
        captionText = cap.text;
        captionSpeaker = cap.speaker === 'mascot' ? 'The guardians' : 'Tērvete';
      }
      promptText = activePrompt(pb.beats, t)?.text ?? '';
      titleText = PITCH.finale.title;
    } else {
      captionText = mapLine(state);
      titleText = PITCH.map.progress(state.visited.length, GUARDIANS.length);
    }
    this.drawCaption(captionSpeaker, captionText, accent);
    this.drawPrompt(promptText, accent);
    this.drawTitle(titleText, accent);
    this.drawNote(noteText);
    this.drawAwaken(onMap && allVisited(state));
    this.drawMenu(state.muted);
    this.updateZoneLabels(onMap, state.visited);

    this.pointAndPoll(onMap);
  }

  dispose(): void {
    this.cleanups.forEach((c) => c());
    this.group.parent?.remove(this.group);
    this.inputGroup.parent?.remove(this.inputGroup);
    for (const root of [this.group, this.inputGroup]) root.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material as { map?: { dispose(): void }; dispose(): void } | undefined;
      mat?.map?.dispose();
      mat?.dispose();
    });
  }

  // ── layout ─────────────────────────────────────────────────────────────────

  private applyLayout(mode: Layout): void {
    if (mode === this.layout) return;
    this.layout = mode;
    if (mode === 'map') {
      this.caption.mesh.position.set(0, 0.34, -1.6);
      this.prompt.mesh.position.set(0, 0.6, -1.6);
      this.title.mesh.position.set(-0.6, 0.82, -1.6);
      this.note.mesh.position.set(0, 0.16, -1.6);
      this.awaken.mesh.position.set(0, 0.04, -1.2);
    } else {
      // Below and above the stage (a 2.4 × 1.35 m window about 1.65 m away), so the picture stays clear.
      this.caption.mesh.position.set(0, -0.82, -1.3);
      this.prompt.mesh.position.set(0, 0.86, -1.3);
      this.title.mesh.position.set(-0.8, 0.74, -1.3);
      this.note.mesh.position.set(0, -1.05, -1.3);
      this.awaken.mesh.position.set(0, 0, -1.3);
    }
    for (const p of [this.caption, this.prompt, this.title, this.note, this.awaken]) p.mesh.rotation.set(mode === 'map' ? -0.22 : 0, 0, 0);
  }

  // ── drawing ────────────────────────────────────────────────────────────────

  private drawCaption(speaker: string, text: string, accent: string): void {
    this.caption.mesh.visible = text.length > 0;
    this.caption.redraw(`${speaker}|${text}|${accent}`, (ctx, p) => {
      p.card(DARK, accent);
      ctx.textAlign = 'center';
      ctx.fillStyle = accent;
      ctx.font = `600 30px ${FONTS.sans}`;
      ctx.fillText(speaker.toUpperCase(), p.pxW / 2, 54);
      ctx.fillStyle = CREAM;
      ctx.font = `500 46px ${FONTS.sans}`;
      const lines = wrapLines(ctx, text, p.pxW - 120);
      const lh = 56;
      const top = 150 - ((lines.length - 1) * lh) / 2;
      lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, p.pxW / 2, top + i * lh));
    });
  }

  private drawPrompt(text: string, accent: string): void {
    this.prompt.mesh.visible = text.length > 0;
    this.prompt.redraw(`${text}|${accent}`, (ctx, p) => {
      p.roundRect(4, 4, p.pxW - 8, p.pxH - 8, 30);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.fillStyle = '#1b1300';
      ctx.textAlign = 'left';
      ctx.font = `700 28px ${FONTS.sans}`;
      ctx.fillText('PRESENTER', 44, 50);
      ctx.font = `700 44px ${FONTS.sans}`;
      const lines = wrapLines(ctx, text, p.pxW - 88);
      lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 44, 102 + i * 48));
    });
  }

  private drawTitle(text: string, accent: string): void {
    this.title.redraw(`${text}|${accent}`, (ctx, p) => {
      p.roundRect(4, 4, p.pxW - 8, p.pxH - 8, 56);
      ctx.fillStyle = 'rgba(0,26,17,.88)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = accent;
      ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 42px ${FONTS.serif}`;
      ctx.fillText(text, p.pxW / 2, p.pxH / 2 + 2, p.pxW - 60);
      ctx.textBaseline = 'alphabetic';
    });
  }

  private drawNote(text: string): void {
    this.note.mesh.visible = text.length > 0;
    this.note.redraw(text, (ctx, p) => {
      p.roundRect(4, 4, p.pxW - 8, p.pxH - 8, 44);
      ctx.fillStyle = DARK;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#f08a24';
      ctx.stroke();
      ctx.fillStyle = CREAM;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `500 36px ${FONTS.sans}`;
      ctx.fillText(text, p.pxW / 2, p.pxH / 2 + 2, p.pxW - 70);
      ctx.textBaseline = 'alphabetic';
    });
  }

  private drawAwaken(show: boolean): void {
    this.awaken.mesh.visible = show;
    this.awaken.hover = this.hoverButton(this.awaken);
    this.awaken.redraw(`awaken|${this.awaken.hover}`, (_ctx, p) => {
      p.addButton({ id: 'awaken', label: PITCH.map.awakenTree, x: 6, y: 6, w: p.pxW - 12, h: p.pxH - 12, primary: true });
    });
  }

  private drawMenu(muted: boolean): void {
    this.menu.mesh.visible = this.menuOpen;
    if (!this.menuOpen) return;
    const confirming = this.now < this.confirmRestartUntil;
    this.menu.hover = this.hoverButton(this.menu);
    this.menu.redraw(`${muted}|${confirming}|${this.menu.hover}`, (ctx, p) => {
      p.card('rgba(0,26,17,.94)', GOLD);
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'center';
      ctx.font = `700 32px ${FONTS.sans}`;
      ctx.fillText('PRESENTER', p.pxW / 2, 66);
      const rows: PanelButton[] = [
        { id: 'next', label: 'Next →', primary: true },
        { id: 'prev', label: '← Previous' },
        { id: 'map', label: 'Map' },
        { id: 'mute', label: muted ? 'Sound off' : 'Sound on' },
        { id: 'restart', label: confirming ? 'Press again to restart' : 'Restart' },
        { id: 'exit', label: 'Exit VR' },
      ].map((b, i) => ({ ...b, x: 40, y: 100 + i * 110, w: p.pxW - 80, h: 88 }));
      rows.forEach((b) => p.addButton(b));
      ctx.fillStyle = 'rgba(249,242,222,.7)';
      ctx.font = `400 24px ${FONTS.sans}`;
      ctx.fillText('A next · B back · X menu · Y sound', p.pxW / 2, p.pxH - 28);
    });
  }

  private updateZoneLabels(visible: boolean, visited: readonly GuardianId[]): void {
    for (const z of this.zoneProxies) {
      z.label.visible = visible;
      z.hit.visible = visible;
      if (!visible) continue;
      const g = GUARDIANS.find((x) => x.id === z.id)!;
      const awake = visited.includes(z.id);
      const hovered = this.controllers.some((c) => c.hover?.zone === z.id);
      const key = `${awake}|${hovered}`;
      if (key !== z.key) {
        z.key = key;
        const canvas = z.texture.image as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 512, 150);
        const r = 40;
        ctx.beginPath();
        ctx.moveTo(r, 6);
        ctx.arcTo(506, 6, 506, 144, r);
        ctx.arcTo(506, 144, 6, 144, r);
        ctx.arcTo(6, 144, 6, 6, r);
        ctx.arcTo(6, 6, 506, 6, r);
        ctx.closePath();
        ctx.fillStyle = hovered ? 'rgba(20,60,42,.97)' : 'rgba(0,26,17,.9)';
        ctx.fill();
        ctx.lineWidth = hovered ? 9 : 5;
        ctx.strokeStyle = awake || hovered ? g.themeColor : '#9aa59b';
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = CREAM;
        ctx.font = `700 52px ${FONTS.serif}`;
        ctx.fillText(g.name, 256, 66, 440);
        ctx.fillStyle = awake ? g.themeColor : 'rgba(249,242,222,.75)';
        ctx.font = `500 31px ${FONTS.sans}`;
        ctx.fillText(awake ? `✓ ${g.zone.name}` : g.zone.name, 256, 112, 450);
        z.texture.needsUpdate = true;
      }
      const k = hovered ? 1.14 : 1;
      z.label.scale.set(LABEL_W * k, LABEL_H * k, 1);
    }
  }

  // ── pointing and input ─────────────────────────────────────────────────────

  private hoverButton(panel: CanvasPanel): string | null {
    for (const c of this.controllers) if (c.hover?.panel === panel && c.hover.buttonId) return c.hover.buttonId;
    return null;
  }

  private targets(onMap: boolean): Object3D[] {
    const list: Object3D[] = [];
    for (const p of [this.awaken, this.menu]) if (p.mesh.visible) list.push(p.mesh);
    if (onMap) for (const z of this.zoneProxies) list.push(z.hit);
    return list;
  }

  private pointAndPoll(onMap: boolean): void {
    // Targets are aimed at before the renderer has updated them this frame, so bring their matrices current.
    this.group.updateMatrixWorld(true);
    const targets = this.targets(onMap);
    const origin = new Vector3();
    const dir = new Vector3();
    const quat = new Quaternion();
    for (const c of this.controllers) {
      c.ray.updateMatrixWorld(true);
      origin.setFromMatrixPosition(c.ray.matrixWorld);
      c.ray.getWorldQuaternion(quat);
      dir.set(0, 0, -1).applyQuaternion(quat);
      this.raycaster.set(origin, dir);
      const hits = this.raycaster.intersectObjects(targets, false).filter((h) => h.object.visible || h.object.userData.zone);
      const hit: Intersection | undefined = hits[0];
      if (!hit) {
        c.hover = null;
        c.line.scale.z = 2.5;
        c.dot.visible = false;
        continue;
      }
      const panel = (hit.object.userData.panel as CanvasPanel | undefined) ?? null;
      const buttonId = panel && hit.uv ? (panel.buttonAt(hit.uv)?.id ?? null) : null;
      c.hover = { panel, buttonId, zone: (hit.object.userData.zone as GuardianId | undefined) ?? null, distance: hit.distance, point: hit.point };
      c.line.scale.z = hit.distance;
      c.dot.position.copy(hit.point);
      c.dot.visible = true;
    }

    // Quest Touch buttons (xr-standard mapping): 4 = A / X, 5 = B / Y.
    const session = this.deps.renderer.xr.getSession();
    session?.inputSources.forEach((src) => {
      const pad = src.gamepad;
      if (!pad) return;
      const edge = (index: number, fire: () => void) => {
        const key = `${src.handedness}${index}`;
        const down = !!pad.buttons[index]?.pressed;
        if (down && !this.padState.get(key)) fire();
        this.padState.set(key, down);
      };
      if (src.handedness === 'right') {
        edge(4, () => this.deps.actions.next());
        edge(5, () => this.deps.actions.prev());
      } else if (src.handedness === 'left') {
        edge(4, () => this.toggleMenu());
        edge(5, () => this.deps.actions.toggleMute());
      }
    });
  }

  /** Called when the trigger is pulled on controller `i`. */
  private activate(i: number): void {
    const hover = this.controllers[i]?.hover;
    if (!hover) return;
    if (hover.zone) {
      this.deps.actions.selectZone(hover.zone);
      return;
    }
    if (hover.buttonId) this.press(hover.buttonId);
  }

  press(id: string): void {
    const { actions } = this.deps;
    switch (id) {
      case 'next':
        actions.next();
        break;
      case 'prev':
        actions.prev();
        break;
      case 'map':
        actions.goTo('map');
        break;
      case 'mute':
        actions.toggleMute();
        break;
      case 'awaken':
        actions.goTo('finale');
        break;
      case 'restart':
        if (this.now < this.confirmRestartUntil) {
          this.confirmRestartUntil = 0;
          actions.restart();
        } else this.confirmRestartUntil = this.now + 3.5;
        this.menu.invalidate();
        break;
      case 'exit':
        this.deps.exit();
        break;
    }
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (!this.menuOpen) return;
    // Open it in front of the player, a little to the left, turned toward them.
    const cam: Camera = this.deps.renderer.xr.getCamera();
    const head = cam.getWorldPosition(new Vector3());
    const forward = new Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new Quaternion()));
    forward.y = 0;
    forward.normalize();
    const left = new Vector3().crossVectors(new Vector3(0, 1, 0), forward).normalize();
    const world = head.clone().addScaledVector(forward, 0.8).addScaledVector(left, 0.3).setY(head.y - 0.05);
    this.menu.mesh.position.copy(this.group.worldToLocal(world.clone()));
    this.group.updateMatrixWorld(true);
    this.menu.mesh.lookAt(head.x, world.y, head.z);
    this.menu.invalidate();
  }
}

