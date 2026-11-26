import { describe, expect, it } from 'vitest';
import { getGuardian } from '../content/guardians';
import { SceneClock } from '../experience/SceneClock';
import { activeBeat, activeCaption, activePrompt, cueTimes } from '../experience/timeline';

const skats = getGuardian('skats');

describe('timeline', () => {
  it('finds the active beat and cue times', () => {
    expect(activeBeat(skats.pitchBeats, -1)).toBeNull();
    expect(activeBeat(skats.pitchBeats, 0)?.index).toBe(0);
    expect(activeBeat(skats.pitchBeats, 12)?.beat.speaker).toBe('narrator');
    expect(cueTimes(skats.pitchBeats)).toEqual({ enter: 0, activity: 5, moment: 15, prompt: 24 });
  });

  it('keeps presenter beats out of the captions and shows the prompt only once reached', () => {
    expect(activeCaption(skats.pitchBeats, 25)?.beat.speaker).toBe('mascot');
    expect(activePrompt(skats.pitchBeats, 23)).toBeNull();
    expect(activePrompt(skats.pitchBeats, 24)?.text).toMatch(/Raise/);
  });
});

describe('SceneClock', () => {
  it('only advances when ticked and ends exactly at the duration', () => {
    const clock = new SceneClock(skats.durationSec, skats.pitchBeats);
    let ends = 0;
    clock.subscribe(() => {
      if (clock.ended) ends++;
    });
    for (let i = 0; i < 200; i++) clock.tick(0.25);
    expect(clock.time).toBe(skats.durationSec);
    expect(clock.ended).toBe(true);
    expect(ends).toBe(1);
    clock.tick(5);
    expect(clock.time).toBe(skats.durationSec);
  });

  it('notifies on beat changes, not on every tick', () => {
    const clock = new SceneClock(skats.durationSec, skats.pitchBeats);
    let calls = 0;
    clock.subscribe(() => calls++);
    for (let i = 0; i < 100; i++) clock.tick(0.1); // 0 → 10 s: beats at 5 only
    expect(calls).toBe(1);
  });

  it('reset rewinds', () => {
    const clock = new SceneClock(10, skats.pitchBeats);
    clock.seek(10);
    clock.reset();
    expect(clock).toMatchObject({ time: 0, ended: false });
  });
});
