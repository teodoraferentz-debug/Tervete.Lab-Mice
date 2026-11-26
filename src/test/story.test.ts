import { describe, expect, it } from 'vitest';
import { getAsset } from '../content/assets';
import { GUARDIANS, type CueKind } from '../content/guardians';
import { ART_KEYS } from '../three/story/art';
import { artKeysOf, compositionFor } from '../three/story/compositions';

const CUES: CueKind[] = ['enter', 'activity', 'moment', 'prompt'];

describe('story compositions', () => {
  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s: every art key exists in the art library', (id) => {
    for (const key of artKeysOf(compositionFor(id))) {
      expect(ART_KEYS.includes(key) || getAsset(key)?.status === 'ready', `missing art "${key}"`).toBe(true);
    }
  });

  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s: has a backdrop, a mascot and the real props, with unique layer ids', (id) => {
    const comp = compositionFor(id);
    const ids = comp.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(comp.layers.some((l) => l.cover && l.z <= -10)).toBe(true); // photographic backdrop
    expect(comp.layers.some((l) => l.art === '@mascot')).toBe(true);
    const props = comp.layers.filter((l) => l.appear === 'activity' && !l.cover);
    expect(props.length).toBeGreaterThanOrEqual(1);
  });

  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s: layers and AR highlights use known cues, and highlights point at real layers', (id) => {
    const comp = compositionFor(id);
    const layerIds = new Set(comp.layers.map((l) => l.id));
    for (const l of comp.layers) if (l.appear) expect(CUES).toContain(l.appear);
    for (const h of comp.hotspots) {
      if (h.after) expect(CUES).toContain(h.after);
      expect(h.at).toBeGreaterThanOrEqual(0);
      if (h.kind === 'outline') expect(layerIds.has(h.layer), `outline of unknown layer ${h.layer}`).toBe(true);
    }
  });

  it('the scene arc is welcome → activity → AR highlights, and AR only extends physical things', () => {
    for (const g of GUARDIANS) {
      const comp = compositionFor(g.id);
      // the real objects are in the scene before any AR highlight starts
      const firstProp = Math.min(...comp.layers.filter((l) => l.appear === 'activity').map((l) => l.delay ?? 0));
      expect(firstProp).toBeLessThan(3);
      expect(comp.hotspots.length).toBeGreaterThan(0);
    }
  });

  it('keepsakes follow the brief: Skats (ornament) and Odziņa (necklace) only, none invented elsewhere', () => {
    const withKeepsake = GUARDIANS.filter((g) => compositionFor(g.id).keepsake !== null).map((g) => g.id);
    expect(withKeepsake).toEqual(['skats', 'odzina']);
    expect(compositionFor('skats').keepsake?.art).toBe('ornament-leaf');
    expect(compositionFor('odzina').keepsake?.art).toBe('necklace');
  });

  it('Skats is the hero: workshop table, leaves, cones, seeds, dough, thread, a child and a parent', () => {
    const arts = compositionFor('skats').layers.map((l) => l.art);
    for (const needed of ['table', 'leaves-cluster', 'pine-cone', 'seeds', 'dough-board', 'spools', 'person-parent', 'person-child', 'pergola', 'lantern-a']) {
      expect(arts, needed).toContain(needed);
    }
  });
});
