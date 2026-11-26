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
  const make = (): SceneCtx => ({ glow: new Texture(), beam: new Texture(), interaction: new InteractionManager(), sound: vi.fn(), speak: vi.fn(() => 1), envItems: () => [] });

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

  it('a character speaks when its line of text appears: mascot lines in its own voice, narrator lines softly', () => {
    const g = GUARDIANS[0]!;
    const ctx = make();
    const scene = new ForestScene(g, ctx);
    const cues = cueTimes(g.pitchBeats);
    scene.start();
    scene.update(0, cues, 0, 1, []);
    expect(ctx.speak).toHaveBeenCalledWith('skats', g.pitchBeats[0]!.text);
    scene.update(0.5, cues, 0.5, 1, []); // same line: not repeated
    expect(ctx.speak).toHaveBeenCalledTimes(1);
    scene.update(12, cues, 12, 1, []); // a narrator line
    expect(ctx.speak).toHaveBeenLastCalledWith('narrator', expect.any(String));
    scene.start(); // replay: the first line speaks again
    scene.update(0, cues, 0, 1, []);
    expect(ctx.speak).toHaveBeenCalledTimes(3);
  });

  it('mushrooms can be picked and collected in the basket, and a replay puts them back', () => {
    const g = GUARDIANS[2]!;
    const ctx = make();
    const scene = new ForestScene(g, ctx);
    scene.start();
    const items = [...ctx.interaction['tracked' as never] as unknown as Array<{ item: Interactable }>].map((t) => t.item);
    const mushrooms = items.filter((i) => i.id.startsWith('mushroom-'));
    const basket = items.find((i) => i.id === 'basket')!;
    expect(mushrooms.length).toBeGreaterThanOrEqual(10);
    expect(basket.label).toBe('Basket: 0 mushrooms');
    mushrooms[0]!.onGrab?.();
    expect(mushrooms[0]!.onRelease!(new Vector3(-1.2, 0.3, -0.95))).toBe(true);
    expect(basket.label).toBe('Basket: 1 mushroom');
    expect(mushrooms[0]!.enabled?.()).toBe(false); // it is in the basket now
    mushrooms[1]!.onGrab?.();
    mushrooms[1]!.onRelease!(new Vector3(-2, 0.2, -2.8)); // set down elsewhere: not collected
    expect(basket.label).toBe('Basket: 1 mushroom');
    scene.start();
    expect(basket.label).toBe('Basket: 0 mushrooms');
    expect(mushrooms[0]!.enabled?.()).toBe(true);
  });

  it('pointing at the guardian and pressing makes it say hello', () => {
    const g = GUARDIANS[1]!;
    const ctx = make();
    const scene = new ForestScene(g, ctx);
    scene.start();
    const items = [...ctx.interaction['tracked' as never] as unknown as Array<{ item: Interactable }>].map((t) => t.item);
    const guardian = items.find((i) => i.id === 'guardian')!;
    guardian.onPress?.({} as never, 0);
    expect(ctx.speak).toHaveBeenCalledWith(g.id, expect.stringContaining('Hello'));
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
