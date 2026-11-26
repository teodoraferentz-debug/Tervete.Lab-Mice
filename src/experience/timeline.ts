import type { CueKind, PitchBeat } from '../content/guardians';

export interface ActiveBeat {
  beat: PitchBeat;
  index: number;
}

/** The latest beat whose start time is ≤ t, or null before the first beat. */
export function activeBeat(beats: readonly PitchBeat[], t: number): ActiveBeat | null {
  let found: ActiveBeat | null = null;
  beats.forEach((beat, index) => {
    if (beat.at <= t) found = { beat, index };
  });
  return found;
}

/** First start time per cue kind. Directors animate relative to these. */
export function cueTimes(beats: readonly PitchBeat[]): Partial<Record<CueKind, number>> {
  const out: Partial<Record<CueKind, number>> = {};
  for (const b of beats) {
    if (b.cue && out[b.cue] === undefined) out[b.cue] = b.at;
  }
  return out;
}

/** The last spoken (captioned) beat at or before t; presenter beats are not captions. */
export function activeCaption(beats: readonly PitchBeat[], t: number): ActiveBeat | null {
  let found: ActiveBeat | null = null;
  beats.forEach((beat, index) => {
    if (beat.speaker !== 'presenter' && beat.at <= t) found = { beat, index };
  });
  return found;
}

/** The presenter prompt, once its beat has been reached. */
export function activePrompt(beats: readonly PitchBeat[], t: number): PitchBeat | null {
  for (const b of beats) {
    if (b.speaker === 'presenter' && b.at <= t) return b;
  }
  return null;
}
