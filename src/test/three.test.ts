import { Texture, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_KEYS, buildActivity } from '../three/activities';
import { LANDMARK_KEYS } from '../three/landmarks';
import { buildMascot } from '../three/Mascot';
import { initialQuality, QualityGovernor, stepDown, TIERS } from '../three/quality';
import { fitView } from '../three/cameraRig';
import { Box3, PerspectiveCamera } from 'three';
import { ZoneRig } from '../three/ZoneRig';
import { GUARDIANS } from '../content/guardians';
import { cueTimes } from '../experience/timeline';
import { since } from '../three/util';

const tex = new Texture();

describe('3D content stays in sync with the guardian data', () => {
  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s: every asset key has an implementation', (_id, g) => {
    expect(ACTIVITY_KEYS).toContain(g.assetKeys.activity);
    expect(LANDMARK_KEYS).toContain(g.assetKeys.landmark);
  });
});

const finite = (v: Vector3): boolean => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

describe('activity visuals and zones run cleanly over a whole scene', () => {
  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s: no NaN or errors at any time, with and without motion', (_id, g) => {
    for (const motion of [1, 0]) {
      const rig = new ZoneRig(g, tex, tex);
      rig.setActive(true);
      rig.setLit(true);
      const cues = cueTimes(g.pitchBeats);
      for (let t = 0; t <= g.durationSec; t += 0.25) {
        rig.update(0.25, t, motion);
        rig.updateActors({
          t,
          enter: since(t, cues.enter),
          activity: since(t, cues.activity),
          moment: since(t, cues.moment),
          speaking: t % 6 < 3,
          motion,
        });
      }
      rig.group.traverse((o) => {
        expect(finite(o.position), `${g.id} ${o.type}`).toBe(true);
        expect(finite(o.scale), `${g.id} ${o.type} scale`).toBe(true);
      });
      rig.dispose();
    }
  });

  it('each activity builds a non-empty object', () => {
    for (const g of GUARDIANS) expect(buildActivity(g, tex).group.children.length).toBeGreaterThan(3);
  });

  it('mascots differ per sense and animate without errors', () => {
    const counts = GUARDIANS.map((g) => {
      const m = buildMascot(g);
      m.update(1, 0.5, true, 1);
      m.update(2, -1, false, 0);
      let n = 0;
      m.group.traverse(() => n++);
      return n;
    });
    expect(new Set(counts).size).toBeGreaterThan(2);
  });

  it('a zone is dormant until lit, then fully coloured', () => {
    const g = GUARDIANS[0]!;
    const rig = new ZoneRig(g, tex, tex);
    expect(rig.lit).toBe(0);
    rig.setLit(true, true);
    expect(rig.lit).toBe(1);
    rig.setLit(false);
    for (let i = 0; i < 120; i++) rig.update(0.1, i * 0.1, 1);
    expect(rig.lit).toBeLessThan(0.01);
  });
});

describe('quality governor', () => {
  it('asks for a cheaper tier only after sustained slow frames', () => {
    const gov = new QualityGovernor(27, 30, 5);
    const results: boolean[] = [];
    for (let i = 0; i < 60; i++) results.push(gov.record(0.05)); // 20 fps
    expect(results.some(Boolean)).toBe(true);
  });

  it('never complains about a healthy device or about one-off long frames', () => {
    const gov = new QualityGovernor(27, 30, 5);
    for (let i = 0; i < 200; i++) expect(gov.record(i % 50 === 0 ? 0.6 : 0.016)).toBe(false);
  });

  it('steps down high → medium → low and stops', () => {
    expect(stepDown('high')).toBe('medium');
    expect(stepDown('medium')).toBe('low');
    expect(stepDown('low')).toBe('low');
    expect(TIERS.low.particles).toBeLessThan(TIERS.high.particles);
    expect(['high', 'medium', 'low']).toContain(initialQuality());
  });
});

describe('camera fitting', () => {
  it('frames the same box from further away on a narrow (portrait) screen', () => {
    const box = new Box3(new Vector3(-4, 0, -2.8), new Vector3(4, 1, 2.8));
    const wide = new PerspectiveCamera(38, 16 / 9);
    const tall = new PerspectiveCamera(46, 9 / 19);
    const a = fitView(wide, box, 0, 0.9).position.distanceTo(box.getCenter(new Vector3()));
    const b = fitView(tall, box, 0, 0.9).position.distanceTo(box.getCenter(new Vector3()));
    expect(b).toBeGreaterThan(a);
    expect(Number.isFinite(a) && Number.isFinite(b)).toBe(true);
  });
});
