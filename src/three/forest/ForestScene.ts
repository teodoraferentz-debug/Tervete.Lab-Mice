import { AdditiveBlending, BufferAttribute, BufferGeometry, Group, Points, PointsMaterial, Vector3} from 'three';
import type { Guardian } from '../../content/guardians';
import { activeCaption } from '../../experience/timeline';
import { MushroomPatch } from './mushrooms';
import { mulberry32 } from '../util';
import type { PointerFrame } from './interaction';
import { HoverLabel, TABLE } from './propKit';
import { AustinaProps } from './props/austina';
import { DeguntinsProps } from './props/deguntins';
import { OdzinaProps } from './props/odzina';
import { PlaukstinaProps } from './props/plaukstina';
import { SkatsProps } from './props/skats';
import { Totem } from './Totem';
import type { Cues, PropSet, SceneCtx } from './types';

const MOTES = 46;

/** Builds the props of one guardian. */
function propsFor(guardian: Guardian, ctx: SceneCtx): PropSet {
  switch (guardian.id) {
    case 'austina':
      return new AustinaProps(ctx);
    case 'odzina':
      return new OdzinaProps(ctx);
    case 'deguntins':
      return new DeguntinsProps(ctx);
    case 'plaukstina':
      return new PlaukstinaProps(ctx);
    default:
      return new SkatsProps(ctx);
  }
}

/** Things a prop set may float a caption for (the magnifier's reading, for instance). */
interface Callout {
  callout?: () => { text: string; at: Vector3 } | null;
}

/**
 * One guardian's stage: real 3D props on a workshop table in the forest clearing, the guardian's carved
 * totem, drifting pollen, and the pointer interactions registered with the shared InteractionManager.
 * The story still follows the SceneClock (cues); this only adds what can be touched.
 *
 * Coordinates: metres, the player's feet at the origin facing -Z, the table 1.15 m ahead.
 */
export class ForestScene {
  readonly group = new Group();
  readonly props: PropSet;
  private readonly totem: Totem;
  private readonly patch: MushroomPatch;
  private lastBeat = -1;
  private readonly label = new HoverLabel();
  private readonly motes: Points;
  private readonly moteSeed = new Float32Array(MOTES * 4);
  private active = false;
  private wall = 0;

  constructor(
    readonly guardian: Guardian,
    private readonly ctx: SceneCtx,
  ) {
    this.props = propsFor(guardian, ctx);
    this.group.add(this.props.group);

    // Mushrooms to pick in the forest floor, and the basket to collect them in
    this.patch = new MushroomPatch(ctx, TABLE.top, (p) => Math.abs(p.x - TABLE.x) < TABLE.width / 2 && Math.abs(p.z - TABLE.z) < TABLE.depth / 2 && p.y > 0.5);
    this.group.add(this.patch.group);

    this.totem = new Totem(guardian, ctx.glow);
    this.totem.onPoke = () => {
      // pointing at the guardian: it says hello (its voice, its mouth)
      const dur = ctx.speak(guardian.id, 'Hello hello! Nice to see you!');
      this.totem.speak(this.wall, dur);
      ctx.sound('hop');
    };
    this.totem.group.position.set(1.45, 0, -1.75);
    this.totem.group.rotation.y = -0.5;
    this.group.add(this.totem.group);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(MOTES * 3), 3));
    const rnd = mulberry32(guardian.name.length * 101);
    for (let i = 0; i < MOTES; i++) {
      this.moteSeed[i * 4] = (rnd() - 0.5) * 4.2;
      this.moteSeed[i * 4 + 1] = rnd();
      this.moteSeed[i * 4 + 2] = -0.4 - rnd() * 3.2;
      this.moteSeed[i * 4 + 3] = rnd() * 6.28;
    }
    this.motes = new Points(
      geo,
      new PointsMaterial({ size: 0.035, map: ctx.glow, color: '#ffe2a4', transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }),
    );
    this.motes.frustumCulled = false;
    this.group.add(this.motes, this.label.sprite);
    this.group.visible = false;
  }

  /** Called when the scene starts: back to the start state and hand the items to the pointer system. */
  start(): void {
    this.active = true;
    this.props.reset();
    this.patch.reset(this.ctx.interaction);
    this.totem.reset();
    this.lastBeat = -1;
    this.refreshItems();
    this.label.hide();
  }

  /** Everything pointable in this scene: its props, the guardian, the mushrooms and the clearing's plants. */
  refreshItems(): void {
    if (!this.active) return;
    this.ctx.interaction.setItems([...this.props.items, this.totem.item, ...this.patch.items, ...this.ctx.envItems()]);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.ctx.interaction.setItems([]);
    this.label.hide();
  }

  update(t: number, cues: Cues, time: number, motion: number, frames: readonly PointerFrame[]): void {
    this.wall = time;
    const found = activeCaption(this.guardian.pitchBeats, t);
    const caption = found?.beat;
    // A new line of text starts: its speaker's placeholder voice plays (and the mascot's mouth moves)
    if (found && found.index !== this.lastBeat) {
      this.lastBeat = found.index;
      if (caption!.speaker === 'mascot') this.totem.speak(time, this.ctx.speak(this.guardian.id, caption!.text));
      else this.ctx.speak('narrator', caption!.text);
    } else if (!found) this.lastBeat = -1;
    // The guardian is "speaking" while its own line is the active caption
    this.totem.update(time, motion);
    this.props.update(t, cues, time, motion);

    const pos = this.motes.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < MOTES; i++) {
      const s = this.moteSeed;
      const rise = motion ? (time * 0.03 + s[i * 4 + 1]!) % 1 : s[i * 4 + 1]!;
      pos.setXYZ(i, s[i * 4]! + Math.sin(time * 0.5 + s[i * 4 + 3]!) * 0.12 * motion, 0.25 + rise * 2.3, s[i * 4 + 2]! + Math.cos(time * 0.4 + s[i * 4 + 3]!) * 0.1 * motion);
    }
    pos.needsUpdate = true;

    // Caption near what is pointed at (or the magnifier's reading)
    const call = (this.props as PropSet & Callout).callout?.() ?? null;
    if (call) {
      this.label.show(call.text, '#f0a43a', call.at);
      this.label.sprite.scale.set(0.62, 0.136, 1);
      return;
    }
    const hover = this.ctx.interaction.hoverInfo(frames);
    if (hover?.item.label) {
      // Far away (a screen camera) the caption grows so it stays readable; up close in a headset it stays small
      const d = frames.find((f) => f.point === hover.point)?.distance ?? 1.5;
      const k = Math.min(2.6, Math.max(1, d / 1.5));
      this.label.sprite.scale.set(0.3 * k, 0.0656 * k, 1);
      this.label.show(hover.item.label, hover.item.accent ?? '#ffd27a', this.group.worldToLocal(hover.point.clone()).add(new Vector3(0, 0.13, 0)));
    } else this.label.hide();
  }

  dispose(): void {
    this.stop();
    this.props.dispose();
    this.label.dispose();
    this.group.removeFromParent();
  }
}
