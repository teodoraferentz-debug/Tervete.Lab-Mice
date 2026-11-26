import { BoxGeometry, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GUARDIANS } from '../content/guardians';
import { cueTimes } from '../experience/timeline';
import { InteractionManager, type Interactable, type PointerSource } from '../three/forest/interaction';
import { ForestScene } from '../three/forest/ForestScene';
import type { SceneCtx } from '../three/forest/types';

// No network or GPU in the tests: models are "missing" and maps are empty textures.
vi.mock('../three/forest/loaders', () => ({
  loadModel: () => Promise.resolve(null),
  loadMap: () => new Texture(),
  loadSky: () => Promise.resolve(new Texture()),
  cloneModel: (o: unknown) => o,
}));

beforeAll(() => {
  const ctx = new Proxy({}, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10 }) : typeof key === 'string' && key.startsWith('create') ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

const ray = (x: number, down: boolean, id = 0): PointerSource => ({ id, origin: new Vector3(x, 0, 0), direction: new Vector3(0, 0, -1), down });

function box(z = -2): Mesh {
  const m = new Mesh(new BoxGeometry(0.4, 0.4, 0.4), new MeshStandardMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  return m;
}

describe('InteractionManager', () => {
  it('hovers what the ray points at and presses it once per trigger pull', () => {
    const im = new InteractionManager();
    const pressed = vi.fn();
    const item: Interactable = { id: 'a', object: box(), kind: 'press', label: 'A', onPress: pressed };
    im.setItems([item]);
    const parent = new Mesh();
    parent.add(item.object);
    let frames = im.update(0.016, [ray(0, false)]);
    expect(frames[0]!.hovered).toBe(item);
    expect(frames[0]!.distance).toBeCloseTo(1.8, 1);
    im.update(0.016, [ray(0, true)]);
    im.update(0.016, [ray(0, true)]); // holding the trigger does not press again
    expect(pressed).toHaveBeenCalledTimes(1);
    frames = im.update(0.016, [ray(2, false)]);
    expect(frames[0]!.hovered).toBeNull();
  });

  it('ignores items behind a nearer panel (the limit) and disabled items', () => {
    const im = new InteractionManager();
    const item: Interactable = { id: 'a', object: box(), kind: 'press', enabled: () => false };
    im.setItems([item]);
    expect(im.update(0.016, [ray(0, false)])[0]!.hovered).toBeNull();
    item.enabled = () => true;
    expect(im.update(0.016, [ray(0, false)], new Map([[0, 1]]))[0]!.hovered).toBeNull();
    expect(im.update(0.016, [ray(0, false)], new Map([[0, 5]]))[0]!.hovered).toBe(item);
  });

  it('carries a grabbed object along the ray, then hands it to the scene on release or sends it home', () => {
    const im = new InteractionManager();
    const root = new Mesh();
    const obj = box();
    root.add(obj);
    const released = vi.fn(() => false);
    const item: Interactable = { id: 'g', object: obj, kind: 'grab', onRelease: released };
    im.setItems([item]);
    im.update(0.016, [ray(0, false)]);
    im.update(0.016, [ray(0, true)]);
    for (let i = 0; i < 30; i++) im.update(0.016, [ray(0.6, true)]);
    expect(obj.position.x).toBeGreaterThan(0.4);
    im.update(0.016, [ray(0.6, false)]);
    expect(released).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 200; i++) im.update(0.016, [ray(3, false)]);
    expect(obj.position.x).toBeCloseTo(0, 2); // not taken: it glides back to where it started
  });
});

describe('ForestScene (the five 3D scenes)', () => {
  const make = (): SceneCtx => ({ glow: new Texture(), beam: new Texture(), interaction: new InteractionManager(), sound: vi.fn() });

  for (const g of GUARDIANS) {
    it(`${g.name}: builds, registers pointable items, plays through its cues and resets`, () => {
      const ctx = make();
      const scene = new ForestScene(g, ctx);
      const cues = cueTimes(g.pitchBeats);
      scene.start();
      expect(scene.props.items.length).toBeGreaterThan(0);
      for (let t = 0; t <= g.durationSec; t += 0.5) scene.update(t, cues, t, 1, []);
      scene.update(g.durationSec, cues, 99, 0, []); // reduced motion: same end state, no throw
      scene.start(); // a replay starts clean
      scene.update(0, cues, 0, 1, []);
      for (const item of scene.props.items) expect(item.object.visible || item.object.scale.x <= 0.01).toBe(true);
      scene.dispose();
    });
  }

  it('props only become pointable once they have appeared (after the activity cue)', () => {
    const g = GUARDIANS[0]!;
    const scene = new ForestScene(g, make());
    const cues = cueTimes(g.pitchBeats);
    scene.start();
    scene.update(1, cues, 1, 1, []);
    const leaf = scene.props.items.find((i) => i.id === 'leaf-0')!;
    expect(leaf.enabled?.()).toBe(false);
    for (let t = 5; t < 10; t += 0.25) scene.update(t, cues, t, 1, []);
    expect(leaf.enabled?.()).toBe(true);
  });

  it('every item is a press, grab or drag with a hover label', () => {
    for (const g of GUARDIANS) {
      const scene = new ForestScene(g, make());
      for (const item of scene.props.items) {
        expect(['press', 'grab', 'drag']).toContain(item.kind);
        expect(item.label).toBeTruthy();
      }
    }
  });
});
