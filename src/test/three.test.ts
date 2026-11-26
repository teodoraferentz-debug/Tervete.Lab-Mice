import { Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { LANDMARK_KEYS } from '../three/landmarks';
import { buildMascot } from '../three/Mascot';
import { initialQuality, QualityGovernor, stepDown, TIERS } from '../three/quality';
import { fitView } from '../three/cameraRig';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { ZoneRig } from '../three/ZoneRig';
import { GUARDIANS } from '../content/guardians';
import { Terrain } from '../three/terrain';
import { MAP_D, MAP_W } from '../three/textures';

const tex = new Texture();

describe('map landmarks stay in sync with the guardian data', () => {
  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s has a landmark on the map', (_id, g) => {
    expect(LANDMARK_KEYS).toContain(g.assetKeys.landmark);
  });
});

describe('zones on the map', () => {
  it('a zone is dormant until lit, then fully coloured, and fades back when reset', () => {
    const g = GUARDIANS[0]!;
    const rig = new ZoneRig(g, tex, tex);
    expect(rig.lit).toBe(0);
    rig.setLit(true, true);
    expect(rig.lit).toBe(1);
    rig.setLit(false);
    for (let i = 0; i < 120; i++) rig.update(0.1, i * 0.1, 1);
    expect(rig.lit).toBeLessThan(0.01);
    rig.dispose();
  });

  it('runs without NaN with and without motion, and sits on the terrain it is given', () => {
    for (const motion of [1, 0]) {
      for (const g of GUARDIANS) {
        const rig = new ZoneRig(g, tex, tex);
        rig.setLit(true);
        rig.triggerActivation();
        rig.setGround(0.2, true);
        for (let t = 0; t < 5; t += 0.2) rig.update(0.2, t, motion);
        rig.group.traverse((o) => {
          expect(Number.isFinite(o.position.x + o.position.y + o.position.z)).toBe(true);
          expect(Number.isFinite(o.scale.x + o.scale.y + o.scale.z)).toBe(true);
        });
        expect(rig.worldPosition.y).toBe(0.2);
        rig.dispose();
      }
    }
  });

  it('uses the illustrated mascot, never primitives (a sprite, one mesh-free child)', () => {
    for (const g of GUARDIANS) {
      const m = buildMascot(g);
      m.update(1, 0.5, true, 1);
      let meshes = 0;
      m.group.traverse((o) => {
        if ((o as { isMesh?: boolean }).isMesh) meshes++;
      });
      expect(meshes).toBe(0);
    }
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

describe('terrain', () => {
  // 4×4 relief: left half high, right half low; trees only in the left column; water in the bottom-right.
  const w = 4;
  const h = 4;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = x < 2 ? 200 : 40;
      data[i + 1] = x === 0 ? 255 : 0;
      data[i + 2] = x === 3 && y === 3 ? 255 : 0;
      data[i + 3] = 255;
    }
  }
  const terrain = new Terrain(w, h, data);

  it('reads height, tree mask and water at world positions, and stays flat at the border', () => {
    const high = terrain.heightAt(-MAP_W * 0.3, 0);
    const low = terrain.heightAt(MAP_W * 0.3, 0);
    const mid = terrain.heightAt(0, 0);
    expect(high).toBeGreaterThan(mid); // smooth slope between the two levels
    expect(mid).toBeGreaterThan(low);
    expect(terrain.treeAt(-MAP_W * 0.49, 0)).toBeGreaterThan(0.8);
    expect(terrain.treeAt(MAP_W * 0.3, 0)).toBeLessThan(0.2);
    expect(terrain.isWater(MAP_W * 0.49, MAP_D * 0.49)).toBe(true);
    expect(terrain.heightAt(-MAP_W / 2, 0)).toBe(0); // eased to flat at the very edge
    expect(Number.isFinite(terrain.heightAt(10, 10))).toBe(true); // outside the map is clamped, not NaN
  });
});
