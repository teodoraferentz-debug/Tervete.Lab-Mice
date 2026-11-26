import { describe, expect, it } from 'vitest';
import { GUARDIAN_IDS, type GuardianId } from '../content/guardians';
import { ExperienceController } from '../experience/ExperienceController';
import { allVisited, initialState, reduce, type Action } from '../experience/sceneState';

const run = (actions: Action[], from = initialState) => actions.reduce(reduce, from);
const complete = (id: GuardianId): Action[] => [{ type: 'selectZone', id }, { type: 'completeScene' }];

describe('experience state', () => {
  it('starts on welcome in magic mode with nothing lit', () => {
    expect(initialState).toMatchObject({ scene: 'welcome', mode: 'magic', visited: [], justActivated: null });
  });

  it('Magic Mode goes straight to the map with five inactive zones', () => {
    const s = run([{ type: 'enterMagic' }]);
    expect(s).toMatchObject({ scene: 'map', mode: 'magic', ar: 'idle', visited: [] });
  });

  it('Start AR waits on the scan screen, then opens the map when the map is tracked', () => {
    const scanning = run([{ type: 'startAr' }]);
    expect(scanning).toMatchObject({ scene: 'scan', mode: 'ar', ar: 'starting' });
    const found = reduce(reduce(scanning, { type: 'arStatus', status: 'scanning' }), { type: 'arStatus', status: 'tracking' });
    expect(found).toMatchObject({ scene: 'map', mode: 'ar', ar: 'tracking' });
  });

  it.each(['denied', 'unsupported', 'error'] as const)('AR %s falls back to Magic Mode with a notice', (status) => {
    const s = run([{ type: 'startAr' }, { type: 'arStatus', status }]);
    expect(s).toMatchObject({ scene: 'map', mode: 'magic', ar: 'idle' });
    expect(s.notice?.code).toBe(`ar-${status}`);
  });

  it('ignores AR events while in Magic Mode', () => {
    const s = run([{ type: 'enterMagic' }]);
    expect(reduce(s, { type: 'arStatus', status: 'tracking' })).toBe(s);
  });

  it('selecting a zone opens its scene; completing lights it and returns to the map', () => {
    const inScene = run([{ type: 'enterMagic' }, { type: 'selectZone', id: 'skats' }]);
    expect(inScene.scene).toBe('skats');
    expect(inScene.visited).toEqual([]);
    const back = reduce(inScene, { type: 'completeScene' });
    expect(back).toMatchObject({ scene: 'map', visited: ['skats'], justActivated: 'skats' });
  });

  it('only accepts zone selection from the map', () => {
    const s = initialState;
    expect(reduce(s, { type: 'selectZone', id: 'skats' })).toBe(s);
  });

  it('replaying a visited zone does not duplicate it or re-pulse it', () => {
    const s = run([{ type: 'enterMagic' }, ...complete('skats'), ...complete('skats')]);
    expect(s.visited).toEqual(['skats']);
    expect(s.justActivated).toBeNull();
  });

  it('unlocks the finale only after all five, but the presenter can always jump there', () => {
    let s = run([{ type: 'enterMagic' }]);
    for (const id of GUARDIAN_IDS) {
      expect(allVisited(s)).toBe(false);
      s = run(complete(id), s);
    }
    expect(allVisited(s)).toBe(true);
    expect(reduce(s, { type: 'next' }).scene).toBe('finale');
    expect(run([{ type: 'enterMagic' }, { type: 'goTo', scene: 'finale' }]).scene).toBe('finale');
  });

  it('next walks the whole demo in order and stops at the finale', () => {
    const scenes: string[] = [];
    let s = initialState;
    for (let i = 0; i < 14; i++) {
      s = reduce(s, { type: 'next' });
      scenes.push(s.scene);
    }
    expect(scenes).toEqual([
      'map', 'skats', 'map', 'austina', 'map', 'odzina', 'map', 'deguntins', 'map', 'plaukstina', 'map',
      'finale', 'finale', 'finale',
    ]);
    expect(s.visited).toEqual(GUARDIAN_IDS);
  });

  it('prev is the exact reverse of next', () => {
    let s = initialState;
    const history = [s];
    for (let i = 0; i < 7; i++) {
      s = reduce(s, { type: 'next' });
      history.push(s);
    }
    for (let i = history.length - 2; i >= 0; i--) {
      s = reduce(s, { type: 'prev' });
      const expected = history[i]!;
      expect({ scene: s.scene, visited: s.visited, mode: s.mode }).toEqual({
        scene: expected.scene,
        visited: expected.visited,
        mode: expected.mode,
      });
    }
  });

  it('direct selection works from anywhere and restarts a replayed scene', () => {
    const a = run([{ type: 'enterMagic' }, { type: 'goTo', scene: 'plaukstina' }]);
    expect(a.scene).toBe('plaukstina');
    const b = reduce(a, { type: 'goTo', scene: 'plaukstina' });
    expect(b.nonce).toBeGreaterThan(a.nonce);
  });

  it('jumping into the show while AR is not tracking switches to Magic Mode', () => {
    const s = run([{ type: 'startAr' }, { type: 'goTo', scene: 'map' }]);
    expect(s).toMatchObject({ scene: 'map', mode: 'magic', ar: 'idle' });
  });

  it('Magic Mode can be activated mid-show without losing progress', () => {
    const tracking = run([{ type: 'startAr' }, { type: 'arStatus', status: 'tracking' }, ...complete('skats')]);
    const s = reduce(tracking, { type: 'enterMagic' });
    expect(s).toMatchObject({ mode: 'magic', scene: 'map', visited: ['skats'] });
  });

  it('restart resets everything except the mute preference', () => {
    const dirty = run([{ type: 'enterMagic' }, ...complete('skats'), ...complete('austina'), { type: 'toggleMute' }]);
    const clean = reduce(dirty, { type: 'restart' });
    expect(clean).toEqual({ ...initialState, muted: true });
  });

  it('is deterministic: same actions, same state', () => {
    const actions: Action[] = [{ type: 'enterMagic' }, ...complete('odzina'), { type: 'next' }, { type: 'prev' }, { type: 'toggleMute' }];
    expect(run(actions)).toEqual(run(actions));
  });

  it('controller notifies subscribers only on real changes', () => {
    const c = new ExperienceController();
    let calls = 0;
    const off = c.subscribe(() => calls++);
    c.enterMagic();
    c.dismissNotice(); // no notice → no change
    c.selectZone('skats');
    expect(calls).toBe(2);
    off();
    c.completeScene();
    expect(calls).toBe(2);
    expect(c.getState().visited).toEqual(['skats']);
  });
});
