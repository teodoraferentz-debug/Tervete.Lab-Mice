/**
 * Single source of truth for the five guardians / physical attractions.
 *
 * Everything the screens show about a guardian comes from this file. Components never
 * hardcode guardian names, colours, props or dialogue.
 *
 * Provenance
 *  - id/name/sense/zone, learningGoal, physicalExperience, propCue and safetyNote follow the
 *    product brief ("Source of truth: cele cinci atracții fizice") one to one.
 *  - Latvian zone names (`zone.nameLv`) come from https://atputa.lvm.lv/galamerki/lvm-dabas-parks-tervete.
 *  - ASSUMPTION markers flag anything written for the preview only (dialogue wording,
 *    visual moments, colours, map positions). They never add park activities.
 */

export type GuardianId = 'skats' | 'austina' | 'odzina' | 'deguntins' | 'plaukstina';
export type Sense = 'sight' | 'hearing' | 'taste' | 'smell' | 'touch';

/** What the director animates when a beat fires. */
export type CueKind = 'enter' | 'activity' | 'moment' | 'prompt';

export interface PitchBeat {
  /** Seconds from the start of the scene. */
  at: number;
  /**
   * mascot    → spoken by the guardian (captioned)
   * narrator  → explains the real, physical attraction in the park (captioned)
   * presenter → instruction for the person presenting (shown as the prop prompt, not as a caption)
   */
  speaker: 'mascot' | 'narrator' | 'presenter';
  text: string;
  cue?: CueKind;
}

export type RewardKind =
  | 'ornament-glow'
  | 'sound-aura'
  | 'necklace-glow'
  | 'scent-spiral'
  | 'handprint-glow';

export interface RewardVisual {
  kind: RewardKind;
  /** The memorable visual moment, in one sentence (for docs and the rehearsal checklist). */
  description: string;
}

export interface ZoneInfo {
  name: string;
  /** Latvian name when the park publishes one. */
  nameLv?: string;
  /**
   * Normalised position on the illustrated map: u = 0 (left) → 1 (right), v = 0 (top) → 1 (bottom).
   * ASSUMPTION: placeholder positions. Re-measure against the final A3 map illustration.
   */
  mapPosition: { u: number; v: number };
}

/** Keys resolved through `content/assets.ts`. */
export interface GuardianAssetKeys {
  mascot: string;
  landmark: string;
  activity: string;
}

export interface Guardian {
  id: GuardianId;
  /** Mascot name (Latvian, as in the brief). */
  name: string;
  sense: Sense;
  /** Display label for the sense, e.g. "Sight". */
  senseLabel: string;
  zone: ZoneInfo;
  themeColor: string;
  learningGoal: string;
  /** The real, physical activity the AR scene previews. */
  physicalExperience: string;
  /** Scene length in seconds. Must stay within 20–40 s. */
  durationSec: number;
  pitchBeats: PitchBeat[];
  /** What the presenter raises when the prompt appears. */
  propCue: string;
  rewardVisual: RewardVisual;
  assetKeys: GuardianAssetKeys;
  /** Shown during the scene when present. */
  safetyNote: string | null;
}

export const SCENE_MIN_SEC = 20;
export const SCENE_MAX_SEC = 40;

// ASSUMPTION (all dialogue below): wording written for the preview, based only on the brief.
export const GUARDIANS: readonly Guardian[] = [
  {
    id: 'skats',
    name: 'Skats',
    sense: 'sight',
    senseLabel: 'Sight',
    zone: { name: 'Hornet Garden', nameLv: 'Iršu dārzs', mapPosition: { u: 0.18, v: 0.6 } },
    themeColor: '#e2aa18', // brand gold
    learningGoal: 'Shapes, colours, patterns, observation',
    physicalExperience:
      'Children turn into forest detectives: they find leaves, cones and seeds, then make an ornament from salted dough and thread.',
    durationSec: 30,
    pitchBeats: [
      { at: 0, speaker: 'mascot', cue: 'enter', text: "Psst! I'm Skats. Today, you're forest detectives!" },
      {
        at: 5,
        speaker: 'mascot',
        cue: 'activity',
        text: 'Look closely: every leaf, cone and seed hides a shape, a colour, a pattern.',
      },
      {
        at: 11,
        speaker: 'narrator',
        text: 'At the Hornet Garden, children find leaves, cones and seeds in the forest…',
      },
      {
        at: 15,
        speaker: 'narrator',
        cue: 'moment',
        text: '…then make an ornament from salted dough and thread.',
      },
      { at: 21, speaker: 'mascot', text: 'Shapes, colours, patterns: you noticed them all!' },
      {
        at: 24,
        speaker: 'presenter',
        cue: 'prompt',
        text: 'Raise the leaves, cones and seeds, and the salted-dough ornament.',
      },
    ],
    propCue: 'Leaves, cones and seeds + the salted-dough ornament with thread',
    rewardVisual: {
      kind: 'ornament-glow',
      description: 'The salted-dough ornament rises, glows amber and reveals its leaf pattern.',
    },
    assetKeys: { mascot: 'mascot-skats', landmark: 'landmark-hornet-garden', activity: 'activity-forest-detective' },
    safetyNote: null,
  },
  {
    id: 'austina',
    name: 'Austiņa',
    sense: 'hearing',
    senseLabel: 'Hearing',
    zone: { name: 'Fairy Tale Forest', nameLv: 'Pasaku mežs', mapPosition: { u: 0.34, v: 0.26 } },
    themeColor: '#4fa3b5', // ASSUMPTION: cool teal to separate hearing from the brand greens
    learningGoal: 'Sound sources and the layered sounds of the forest',
    physicalExperience:
      'Children learn to listen actively with wooden instruments, and by listening to birds, leaves and wind.',
    durationSec: 30,
    pitchBeats: [
      { at: 0, speaker: 'mascot', cue: 'enter', text: "Shhh… I'm Austiņa. Close your eyes. What do you hear?" },
      { at: 5, speaker: 'mascot', cue: 'activity', text: 'Birds above. Leaves rustling. Wind passing through.' },
      {
        at: 11,
        speaker: 'narrator',
        text: 'In the Fairy Tale Forest, children listen actively to birds, leaves and wind…',
      },
      {
        at: 15,
        speaker: 'narrator',
        cue: 'moment',
        text: '…and play wooden instruments, layer upon layer of forest sound.',
      },
      { at: 21, speaker: 'mascot', text: 'Every sound has a source. Can you find it?' },
      { at: 25, speaker: 'presenter', cue: 'prompt', text: 'Raise the wooden instruments.' },
    ],
    propCue: 'The wooden instruments',
    rewardVisual: {
      kind: 'sound-aura',
      description: 'Bird, leaf and wind sounds stack into glowing, layered rings above the forest.',
    },
    assetKeys: { mascot: 'mascot-austina', landmark: 'landmark-fairy-tale-forest', activity: 'activity-sound-layers' },
    safetyNote: null,
  },
  {
    id: 'odzina',
    name: 'Odziņa',
    sense: 'taste',
    senseLabel: 'Taste',
    zone: { name: 'Gnome Forest', nameLv: 'Rūķīšu mežs', mapPosition: { u: 0.66, v: 0.24 } },
    themeColor: '#e8743b', // ASSUMPTION: warm orange (dried orange slices)
    learningGoal: 'Tastes and ingredients',
    physicalExperience:
      'A tasting prepared safely, plus a necklace made of dried orange slices, forest berries and nuts.',
    durationSec: 32,
    pitchBeats: [
      {
        at: 0,
        speaker: 'mascot',
        cue: 'enter',
        text: "Hello, little tasters! I'm Odziņa. The forest is full of flavours.",
      },
      {
        at: 5,
        speaker: 'mascot',
        cue: 'activity',
        text: 'Sweet, sour, nutty… every ingredient has its own taste.',
      },
      {
        at: 11,
        speaker: 'narrator',
        text: 'In the Gnome Forest, the tasting is prepared safely for the children…',
      },
      {
        at: 15,
        speaker: 'narrator',
        cue: 'moment',
        text: '…and they thread a necklace of dried orange slices, berries and nuts.',
      },
      { at: 21, speaker: 'mascot', text: "Orange, berries, nuts: what's your favourite taste?" },
      {
        at: 25,
        speaker: 'narrator',
        text: 'Tasting is always prepared safely. We never eat plants found in the forest.',
      },
      {
        at: 28,
        speaker: 'presenter',
        cue: 'prompt',
        text: 'Raise the dried-orange, berry and nut necklace.',
      },
    ],
    propCue: 'The necklace of dried orange slices, berries and nuts',
    rewardVisual: {
      kind: 'necklace-glow',
      description: 'Orange slices, berries and nuts string together into a softly glowing necklace.',
    },
    assetKeys: { mascot: 'mascot-odzina', landmark: 'landmark-gnome-forest', activity: 'activity-taste-necklace' },
    safetyNote: 'Tasting is prepared safely. Never eat plants you find in the forest.',
  },
  {
    id: 'deguntins',
    name: 'Deguntiņš',
    sense: 'smell',
    senseLabel: 'Smell',
    zone: {
      name: 'Green Classroom–Forest Trail Connector',
      mapPosition: { u: 0.64, v: 0.74 },
    },
    themeColor: '#a67bc9', // ASSUMPTION: lavender, reads as "aroma" and stays distinct from the greens
    learningGoal: 'Natural smells and careful exploration',
    physicalExperience:
      'A scent wheel: children identify the smells of plants, trees and natural materials.',
    durationSec: 28,
    pitchBeats: [
      { at: 0, speaker: 'mascot', cue: 'enter', text: "Sniff, sniff! I'm Deguntiņš, your aroma explorer." },
      {
        at: 5,
        speaker: 'mascot',
        cue: 'activity',
        text: 'Spin the wheel. What does this smell like: a plant, a tree, wood?',
      },
      {
        at: 11,
        speaker: 'narrator',
        text: 'At the scent wheel, children identify the smells of plants, trees and natural materials.',
      },
      {
        at: 16,
        speaker: 'narrator',
        cue: 'moment',
        text: "Slow, careful sniffs reveal the forest's natural aromas.",
      },
      { at: 21, speaker: 'mascot', text: 'Close your eyes, sniff slowly… what do you smell?' },
      { at: 24, speaker: 'presenter', cue: 'prompt', text: 'Raise the scent wheel.' },
    ],
    propCue: 'The scent wheel',
    rewardVisual: {
      kind: 'scent-spiral',
      description: 'Coloured scent ribbons rise from the wheel and spiral up through the trees.',
    },
    assetKeys: {
      mascot: 'mascot-deguntins',
      landmark: 'landmark-green-classroom',
      activity: 'activity-scent-wheel',
    },
    safetyNote: null,
  },
  {
    id: 'plaukstina',
    name: 'Plaukstiņa',
    sense: 'touch',
    senseLabel: 'Touch',
    zone: { name: 'Old Pine Park', nameLv: 'Veco priežu parks', mapPosition: { u: 0.86, v: 0.48 } },
    themeColor: '#c98f5a', // ASSUMPTION: warm wood / bark
    learningGoal: 'Textures and natural materials',
    physicalExperience:
      'A touch panel with hidden objects, and a sensory trail of bark, cones, moss, sand and wood.',
    durationSec: 30,
    pitchBeats: [
      { at: 0, speaker: 'mascot', cue: 'enter', text: "Hello! I'm Plaukstiņa. Put your hand in. What do you feel?" },
      {
        at: 5,
        speaker: 'mascot',
        cue: 'activity',
        text: 'Rough, soft, bumpy, smooth… hidden objects are waiting inside.',
      },
      {
        at: 11,
        speaker: 'narrator',
        text: 'At Old Pine Park, children find hidden objects on a touch panel…',
      },
      {
        at: 15,
        speaker: 'narrator',
        cue: 'moment',
        text: '…and walk a sensory trail of bark, cones, moss, sand and wood.',
      },
      { at: 21, speaker: 'mascot', text: 'Every texture tells a story. Which one is your favourite?' },
      { at: 25, speaker: 'presenter', cue: 'prompt', text: 'Raise the touch panel and its hidden objects.' },
    ],
    propCue: 'The touch panel with its hidden objects',
    rewardVisual: {
      kind: 'handprint-glow',
      description: 'A glowing hand-print blooms on the panel while the five textures light up in turn.',
    },
    assetKeys: { mascot: 'mascot-plaukstina', landmark: 'landmark-old-pine-park', activity: 'activity-touch-trail' },
    safetyNote: null,
  },
];

export const GUARDIAN_IDS: readonly GuardianId[] = GUARDIANS.map((g) => g.id);

const byId = new Map<GuardianId, Guardian>(GUARDIANS.map((g) => [g.id, g]));

export function getGuardian(id: GuardianId): Guardian {
  const g = byId.get(id);
  if (!g) throw new Error(`Unknown guardian: ${id}`);
  return g;
}

export function isGuardianId(value: string): value is GuardianId {
  return byId.has(value as GuardianId);
}
