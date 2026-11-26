import { describe, expect, it } from 'vitest';
import { GUARDIANS, GUARDIAN_IDS, SCENE_MAX_SEC, SCENE_MIN_SEC } from '../content/guardians';
import { ASSETS } from '../content/assets';
import { PITCH } from '../content/pitchScript';

describe('guardian content', () => {
  it('defines exactly the five brief guardians in brief order', () => {
    expect(GUARDIAN_IDS).toEqual(['skats', 'austina', 'odzina', 'deguntins', 'plaukstina']);
    expect(GUARDIANS.map((g) => g.sense)).toEqual(['sight', 'hearing', 'taste', 'smell', 'touch']);
  });

  it('maps each guardian to its zone from the brief', () => {
    expect(GUARDIANS.map((g) => g.zone.name)).toEqual([
      'Hornet Garden',
      'Fairy Tale Forest',
      'Gnome Forest',
      'Green Classroom–Forest Trail Connector',
      'Old Pine Park',
    ]);
  });

  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s has every required field', (_id, g) => {
    for (const key of ['id', 'name', 'sense', 'themeColor', 'learningGoal', 'physicalExperience', 'propCue'] as const) {
      expect(g[key], key).toBeTruthy();
    }
    expect(g.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(g.rewardVisual.description).toBeTruthy();
    expect(Object.values(g.assetKeys).every(Boolean)).toBe(true);
    expect(g.zone.mapPosition.u).toBeGreaterThan(0);
    expect(g.zone.mapPosition.u).toBeLessThan(1);
    expect(g.zone.mapPosition.v).toBeGreaterThan(0);
    expect(g.zone.mapPosition.v).toBeLessThan(1);
  });

  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s scene is 20–40 s with ordered, in-range beats', (_id, g) => {
    expect(g.durationSec).toBeGreaterThanOrEqual(SCENE_MIN_SEC);
    expect(g.durationSec).toBeLessThanOrEqual(SCENE_MAX_SEC);
    const times = g.pitchBeats.map((b) => b.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(0);
    expect(Math.max(...times)).toBeLessThan(g.durationSec - 1);
  });

  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s has the full cue set and one presenter prompt', (_id, g) => {
    const cues = g.pitchBeats.map((b) => b.cue).filter(Boolean);
    expect(cues).toEqual(expect.arrayContaining(['enter', 'activity', 'moment', 'prompt']));
    const prompts = g.pitchBeats.filter((b) => b.speaker === 'presenter');
    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.cue).toBe('prompt');
  });

  it('has unique ids and registered asset keys', () => {
    expect(new Set(GUARDIAN_IDS).size).toBe(5);
    for (const g of GUARDIANS) {
      expect(ASSETS[g.assetKeys.mascot], g.assetKeys.mascot).toBeDefined();
    }
  });

  it('keeps the taste scene safe: note present and no foraging encouraged', () => {
    const taste = GUARDIANS.find((g) => g.sense === 'taste');
    expect(taste?.safetyNote).toMatch(/never eat plants/i);
    const lines = taste?.pitchBeats.map((b) => b.text.toLowerCase()).join(' ') ?? '';
    expect(lines).toMatch(/never eat plants found in the forest/);
    expect(lines).not.toMatch(/\b(pick|forage|eat the)\b/);
  });

  it('has a finale that fits the demo', () => {
    expect(PITCH.finale.durationSec).toBeGreaterThan(Math.max(...PITCH.finale.beats.map((b) => b.at)));
  });
});
