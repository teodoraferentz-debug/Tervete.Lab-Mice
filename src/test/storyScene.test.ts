import { PerspectiveCamera, Texture, Vector3, Group, type Mesh, type Object3D } from 'three';
import { describe, expect, it, vi } from 'vitest';

// jsdom cannot draw SVG or decode photos, so the art library is replaced by plain textures.
vi.mock('../three/story/art', () => ({
  ART_KEYS: [],
  loadArt: async () => ({ texture: new Texture(), aspect: 1.4 }),
  preloadArt: async () => {},
}));

import { GUARDIANS } from '../content/guardians';
import { cueTimes } from '../experience/timeline';
import { compositionFor } from '../three/story/compositions';
import { StoryScene } from '../three/story/StoryScene';

const glow = new Texture();

function allFinite(root: Object3D): boolean {
  let ok = true;
  root.traverse((o) => {
    const { position: p, scale: s, rotation: r } = o;
    if (![p.x, p.y, p.z, s.x, s.y, s.z, r.x, r.y, r.z].every(Number.isFinite)) ok = false;
    const mat = (o as Mesh).material;
    const op = Array.isArray(mat) ? 1 : (mat as { opacity?: number } | undefined)?.opacity;
    if (op !== undefined && !Number.isFinite(op)) ok = false;
  });
  return ok;
}

describe('StoryScene', () => {
  it.each(GUARDIANS.map((g) => [g.id, g] as const))('%s plays a whole scene cleanly (screen and AR pop-up, with and without motion)', async (_id, g) => {
    const scene = new StoryScene(g, compositionFor(g.id), glow, glow);
    await scene.load();
    const cues = cueTimes(g.pitchBeats);
    const camera = new PerspectiveCamera(32, 16 / 9);
    camera.position.set(0, 0, 16);

    for (const mode of ['screen', 'popup', 'vr'] as const) {
      const popup = mode !== 'screen';
      scene.setView(32, popup ? 1 : 16 / 9, mode);
      if (popup) {
        const parent = new Group();
        parent.add(scene.group);
        if (mode === 'vr') scene.placeVr(new Vector3(0, 0, -2.4), 0.15);
        else scene.placePopup(new Vector3(1, 1, 1));
      } else scene.placeScreen();
      for (const motion of [1, 0]) {
        for (let t = 0; t <= g.durationSec; t += 0.5) {
          scene.update(t, cues, t + 3, motion, g.durationSec, camera);
          expect(allFinite(scene.group), `${g.id} t=${t} mode=${mode} motion=${motion}`).toBe(true);
        }
      }
    }
    scene.dispose();
  });

  it('fades in from nothing and out again, so scenes never pop', async () => {
    const g = GUARDIANS[0]!;
    const scene = new StoryScene(g, compositionFor(g.id), glow, glow);
    await scene.load();
    const cues = cueTimes(g.pitchBeats);
    const vignette = (): number => {
      let op = -1;
      scene.group.children.forEach((c) => {
        const m = (c as Mesh).material as { opacity?: number } | undefined;
        if (m && Math.abs(c.renderOrder - (6.2 * 10 + 901 * 0.001)) < 1e-6) op = m.opacity ?? -1;
      });
      return op;
    };
    scene.update(0, cues, 0, 1, g.durationSec, null);
    const start = vignette();
    scene.update(g.durationSec / 2, cues, 10, 1, g.durationSec, null);
    const middle = vignette();
    scene.update(g.durationSec, cues, 20, 1, g.durationSec, null);
    const end = vignette();
    expect(start).toBe(0);
    expect(middle).toBeGreaterThan(0.5);
    expect(end).toBe(0);
  });
});
