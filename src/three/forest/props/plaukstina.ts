import { AdditiveBlending, BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { easeInOut } from '../../util';
import { handprintTexture, swatchTexture, type Swatch } from '../procedural';
import type { Interactable } from '../interaction';
import { contactShadow, matte, mesh, planks, shadowTexture } from '../propKit';
import type { Cues, SceneCtx } from '../types';
import { BaseProps } from './base';
import { Gateway } from './dressing';

const WOOD = '#c98f5a';
const PANEL = new Vector3(0, 0, -1.4);
const TILT = -0.13;

interface Hatch {
  kind: Swatch;
  name: string;
  feel: string;
  x: number;
  y: number;
  pivot: Group;
  mat: MeshStandardMaterial;
  open: number;
  goal: number;
  everOpened: boolean;
  item: Interactable;
}

const HATCHES: Array<{ kind: Swatch; name: string; feel: string; x: number; y: number }> = [
  { kind: 'bark', name: 'Bark', feel: 'rough', x: -0.42, y: 1.27 },
  { kind: 'cones', name: 'Cones', feel: 'bumpy', x: 0, y: 1.27 },
  { kind: 'moss', name: 'Moss', feel: 'soft', x: 0.42, y: 1.27 },
  { kind: 'sand', name: 'Sand', feel: 'grainy', x: -0.21, y: 0.87 },
  { kind: 'wood', name: 'Wood', feel: 'smooth', x: 0.21, y: 0.87 },
];

/**
 * Plaukstiņa · Old Pine Park: a touch panel with five hidden objects behind wooden hatches (bark, cones,
 * moss, sand, wood). Open them by pointing; when all five have been felt, a hand-print blooms on the panel
 * and the five textures light up in turn. At the moment the sensory trail appears on the ground below.
 */
export class PlaukstinaProps extends BaseProps {
  private readonly gateway: Gateway;
  private readonly hatches: Hatch[] = [];
  private readonly panel = new Group();
  private readonly print: Sprite;
  private readonly trail: Mesh[] = [];
  private bloom = 0;
  private autoNext = 0;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.gateway = new Gateway(ctx.glow, 'VECO PRIEŽU PARKS', 'Plaukstiņa · Touch', WOOD);
    this.group.add(this.gateway.group);

    // panel: a board on two posts, tilted back a little
    this.panel.position.copy(PANEL);
    this.panel.add(mesh(new RoundedBoxGeometry(1.3, 0.96, 0.07, 3, 0.012), planks('#d2b28c', 0.8, 0.8), 0, 1.07, 0));
    for (const sx of [-1, 1]) this.panel.add(mesh(new BoxGeometry(0.09, 1.2, 0.09), planks('#bf9d78', 0.3, 1.4), sx * 0.58, 0.6, -0.07));
    this.panel.rotation.x = TILT;
    this.group.add(this.panel);
    const shadow = contactShadow(shadowTexture(), 1.8, 0.9, 0.5);
    shadow.position.set(PANEL.x, 0.002, PANEL.z);
    this.group.add(shadow);

    HATCHES.forEach((h, i) => {
      this.panel.add(mesh(new BoxGeometry(0.31, 0.31, 0.03), matte('#1d130c', 1), h.x, h.y, 0.02, false));
      const tex = swatchTexture(h.kind);
      const mat = new MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: h.kind === 'sand' ? 1.2 : 4, roughness: 0.9, emissive: '#000000' });
      const tile = new Mesh(new PlaneGeometry(0.29, 0.29), mat);
      tile.position.set(h.x, h.y, 0.037);
      this.panel.add(tile);
      // hinged flap (hinge on the top edge)
      const pivot = new Group();
      pivot.position.set(h.x, h.y + 0.155, 0.045);
      pivot.add(mesh(new RoundedBoxGeometry(0.3, 0.3, 0.025, 2, 0.006), planks('#e0c19a', 0.3, 0.3), 0, -0.155, 0));
      pivot.add(mesh(new SphereGeometry(0.018, 10, 8), matte('#4a2e1a', 0.7), 0, -0.25, 0.026));
      this.panel.add(pivot);
      const hatch: Hatch = { ...h, pivot, mat, open: 0, goal: 0, everOpened: false, item: null as unknown as Interactable };
      hatch.item = this.add(
        {
          id: `hatch-${i}`,
          object: pivot,
          kind: 'press',
          label: 'Hidden object: touch to open',
          accent: WOOD,
          onPress: () => this.toggle(hatch),
        },
        this.panel,
      );
      this.hatches.push(hatch);
    });
    this.appear(this.panel, 0.2);

    this.print = new Sprite(new SpriteMaterial({ map: handprintTexture('#ffd27a'), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: false }));
    this.print.scale.setScalar(0.1);
    this.print.position.set(PANEL.x, 1.07, PANEL.z + 0.14);
    this.group.add(this.print);

    // sensory trail on the ground in front of the panel (appears at the moment)
    HATCHES.forEach((h, i) => {
      const t = swatchTexture(h.kind);
      const tile = new Mesh(new RoundedBoxGeometry(0.4, 0.04, 0.4, 3, 0.012), new MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 3, roughness: 0.95, emissive: '#000000' }));
      tile.position.set(-0.95 + i * 0.475, 0.02, -0.6 - Math.sin(i * 0.9) * 0.1);
      tile.rotation.y = i * 0.35;
      tile.receiveShadow = true;
      this.trail.push(tile);
      this.group.add(tile);
      this.appear(tile, i * 0.25, 'moment');
    });
  }

  private toggle(h: Hatch): void {
    h.goal = h.goal > 0.5 ? 0 : 1;
    this.ctx.sound(h.goal > 0.5 ? 'knock' : 'tick');
    if (h.goal > 0.5) h.everOpened = true;
  }

  protected tick(t: number, cues: Cues, time: number, motion: number): void {
    this.gateway.update(time, motion);
    const dt = 1 / 60;
    const activity = cues.activity ?? Infinity;
    const moment = cues.moment ?? Infinity;

    // The moment: the hatches that are still shut open one after another
    if (t >= moment && this.autoNext >= 0) {
      const due = Math.floor((t - moment) / 0.45) + 1;
      while (this.autoNext < due) {
        const h = this.hatches.find((x) => !x.everOpened);
        if (!h) {
          this.autoNext = -1;
          break;
        }
        h.goal = 1;
        h.everOpened = true;
        this.ctx.sound('knock');
        this.autoNext++;
      }
    }

    const untouched = !this.hatches.some((x) => x.everOpened);
    let everyOpen = true;
    for (const h of this.hatches) {
      if (!h.everOpened) everyOpen = false;
      h.open += (h.goal - h.open) * (motion ? 1 - Math.exp(-dt * 9) : 1);
      if (Math.abs(h.goal - h.open) < 0.005) h.open = h.goal;
      h.pivot.rotation.x = -h.open * 1.75;
      h.item.label = h.open > 0.5 ? `${h.name} · ${h.feel}` : 'Hidden object: touch to open';
      h.item.hint = untouched && t >= activity + 2.5 && this.isShown(this.panel);
    }

    // All five felt: a glowing hand-print blooms and the textures light up in turn
    if (everyOpen && this.bloom === 0) {
      this.bloom = 0.0001;
      this.ctx.sound('chime', 3);
    }
    if (this.bloom > 0) this.bloom = Math.min(1, this.bloom + dt / 1.4);
    const e = easeInOut(this.bloom);
    this.print.scale.setScalar(0.1 + e * 0.75);
    (this.print.material as SpriteMaterial).opacity = e * (0.55 + Math.sin(time * 2.2) * 0.12 * motion);
    this.hatches.forEach((h, i) => {
      h.mat.emissive.set('#ffb25a');
      h.mat.emissiveIntensity = (this.bloom > 0 ? Math.max(0, Math.sin(time * 2.4 - i * 0.9)) * e : 0) * 0.55;
    });
    this.trail.forEach((tile, i) => {
      const m = tile.material as MeshStandardMaterial;
      m.emissive.set('#ffb25a');
      m.emissiveIntensity = tile.visible ? Math.max(0, Math.sin(time * 2.4 - i * 0.9)) * 0.35 : 0;
    });
  }

  protected onReset(): void {
    this.bloom = 0;
    this.autoNext = 0;
    for (const h of this.hatches) {
      h.open = h.goal = 0;
      h.everOpened = false;
      h.pivot.rotation.x = 0;
      h.mat.emissiveIntensity = 0;
    }
    (this.print.material as SpriteMaterial).opacity = 0;
  }
}
