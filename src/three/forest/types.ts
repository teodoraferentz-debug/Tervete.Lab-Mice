import type { Group, Texture } from 'three';
import type { CueKind } from '../../content/guardians';
import type { Interactable } from './interaction';
import type { InteractionManager } from './interaction';

/** First start time of each cue in the scene being played (seconds). */
export type Cues = Partial<Record<CueKind, number>>;

/** Sounds the scenes ask for; the app maps them to the audio engine (muted = silent). */
export type SoundKind = 'pick' | 'drop' | 'tick' | 'note' | 'chirp' | 'rustle' | 'whoosh' | 'chime' | 'knock' | 'pluck' | 'basket' | 'creak' | 'bell' | 'hop' | 'hover';

export interface SceneCtx {
  glow: Texture;
  beam: Texture;
  interaction: InteractionManager;
  sound: (kind: SoundKind, index?: number) => void;
  /**
   * A character starts a line: the app plays a placeholder voice for it (until real recordings replace it) and
   * returns roughly how many seconds it lasts, so the mascot can move its mouth for that long.
   */
  speak: (voice: string, text: string) => number;
  /** What can be pointed at in the clearing itself (plants, stumps, rocks). May grow as models load. */
  envItems: () => Interactable[];
}

/**
 * The part of a scene that is specific to one guardian: its table, props and the interactions on them.
 * The scene's story is still driven by the clock (cues), so a presenter can run it hands-off; the
 * interactions are what the wearer may add on top.
 */
export interface PropSet {
  readonly group: Group;
  /** Everything that can be pointed at. */
  readonly items: Interactable[];
  /** t: seconds into the scene; time: wall seconds (for idle motion); motion: 0 when reduced motion. */
  update(t: number, cues: Cues, time: number, motion: number): void;
  /** Back to the starting state (called on every scene entry, so a replay is identical). */
  reset(): void;
  dispose(): void;
}
