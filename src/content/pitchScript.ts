import type { Guardian, PitchBeat } from './guardians';

/**
 * Pitch copy that is not tied to a single guardian: welcome screen, map prompts,
 * finale, notices. Per-guardian dialogue lives in guardians.ts.
 * ASSUMPTION: all wording is written for the preview, based only on the product brief.
 */
export const PITCH = {
  welcome: {
    eyebrow: 'AR Experience Preview',
    lead: 'A first look at five physical attractions in Tērvete Nature Park, before they are built.',
    footnote:
      'This preview shows what families will find on the real trail. The experience itself happens in the park.',
    startAr: 'Start AR',
    startArHint: 'Point the camera at the printed A3 map.',
    magic: 'Magic Mode',
    magicHint: 'No camera needed. Same experience on screen.',
  },
  scan: {
    title: 'Point the camera at the Tērvete map',
    body: 'Hold the printed A3 map in view and keep it steady.',
    continueMagic: 'Continue in Magic Mode',
    slowHint: 'Taking a while? You can continue in Magic Mode at any time.',
  },
  map: {
    intro: 'The forest is asleep. Choose a zone to wake its guardian.',
    allAwake: 'All five guardians are awake.',
    awakenTree: 'Awaken the Tree of Five Senses',
    progress: (n: number, total: number) => `${n} of ${total} guardians awake`,
    awakened: (g: Guardian) => `${g.name} is awake. ${g.zone.name} glows again.`,
  },
  notices: {
    arDenied: 'Camera access was not granted. Continuing in Magic Mode.',
    arUnsupported: 'AR is not available on this device. Continuing in Magic Mode.',
    arError: 'The map could not be recognised. Continuing in Magic Mode.',
    arLost: 'Map out of view. Point the camera back at the map.',
    noWebgl: '3D graphics are not available on this device. Narration and captions still work.',
  },
  finale: {
    title: 'Tree of Five Senses',
    durationSec: 24,
    beats: [
      {
        at: 0,
        speaker: 'narrator',
        cue: 'enter',
        text: 'Five senses. Five guardians. One awakened forest.',
      },
      {
        at: 5,
        speaker: 'mascot',
        cue: 'activity',
        text: 'Sight, hearing, taste, smell, touch: together we are the Tree of Five Senses!',
      },
      {
        at: 11,
        speaker: 'narrator',
        cue: 'moment',
        text: 'Each sense gives the tree a new colour of light.',
      },
      {
        at: 17,
        speaker: 'presenter',
        cue: 'prompt',
        text: 'This is a preview. The real trail is waiting in Tērvete.',
      },
    ] satisfies PitchBeat[],
  },
} as const;

/** Rehearsal guide for the 6–7 minute demo (mirrored in docs/pitch-flow.md). */
export const DEMO_TIMING = [
  { step: 'Welcome and context', seconds: 40 },
  { step: 'Scan the map (or Magic Mode)', seconds: 30 },
  { step: 'Five attraction scenes, about 30 s each plus map returns', seconds: 5 * 50 },
  { step: 'Tree of Five Senses finale', seconds: 40 },
  { step: 'Close and questions buffer', seconds: 40 },
] as const;
