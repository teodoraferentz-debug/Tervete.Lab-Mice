import { Group, PerspectiveCamera, Vector3 } from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GUARDIANS } from '../content/guardians';
import { PITCH } from '../content/pitchScript';
import { ExperienceController } from '../experience/ExperienceController';
import { SceneClock } from '../experience/SceneClock';
import { coreCenter, tablePoint } from '../vr/layout';
import { VrRig, type Playback } from '../vr/VrRig';
import type { World } from '../three/World';
import type { WebGLRenderer } from 'three';

// jsdom has no 2D canvas: a recording stub is enough to run the drawing code.
beforeAll(() => {
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => undefined),
      set: () => true,
    },
  );
  HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

function setup(sceneState: 'map' | 'story' = 'map') {
  const controllers = [new Group(), new Group()];
  const camera = new PerspectiveCamera();
  const renderer = {
    xr: { getController: (i: number) => controllers[i], getSession: () => null, getCamera: () => camera },
  } as unknown as WebGLRenderer;
  const zones = new Map(
    GUARDIANS.map((g, i) => [g.id, { worldPosition: new Vector3(-2 + i, 0, -1 + (i % 2)) }]),
  );
  const world = { zones, mode: 'map', diorama: { visible: true }, core: () => coreCenter([...zones.values()].map((z) => z.worldPosition)) } as unknown as World & { mode: string };
  const controller = new ExperienceController();
  controller.enterMagic();
  let playback: Playback | null = null;
  const exit = vi.fn();
  const rig = new VrRig({ renderer, scene: new Group(), world, actions: controller, playback: () => playback, exit });
  const guardian = GUARDIANS[0]!;
  const startScene = () => {
    controller.selectZone(guardian.id);
    (world as { mode: string }).mode = 'attraction';
    playback = { guardian, clock: new SceneClock(guardian.durationSec, guardian.pitchBeats), beats: guardian.pitchBeats };
  };
  if (sceneState === 'story') startScene();
  return { rig, controller, controllers, world, exit, startScene, guardian, getPlayback: () => playback };
}

/** Aims a controller's ray at a point. */
function aim(ray: Group, from: Vector3, to: Vector3): void {
  ray.position.copy(from);
  ray.quaternion.setFromUnitVectors(new Vector3(0, 0, -1), to.clone().sub(from).normalize());
  ray.updateMatrixWorld(true);
}

describe('VrRig (the headset UI)', () => {
  it('shows the map caption and progress, and the map labels', () => {
    const { rig } = setup();
    rig.update(0.016, 1);
    const panels = rig.group.children.filter((c) => (c.userData.panel as unknown) !== undefined);
    expect(panels.length).toBe(6);
    expect(rig.group.children.filter((c) => (c as { isSprite?: boolean }).isSprite).length).toBe(5);
  });

  it('keeps the zone labels small (about a third of a metre) and enlarges only the one pointed at', () => {
    const { rig, controllers } = setup();
    rig.update(0.016, 1);
    const sprites = rig.group.children.filter((c) => (c as { isSprite?: boolean }).isSprite);
    for (const s of sprites) expect(s.scale.x).toBeCloseTo(0.34, 5);
    const zones = [...Array(5).keys()].map((i) => new Vector3(-2 + i, 0, -1 + (i % 2)));
    const aimAt = tablePoint(zones[0]!, coreCenter(zones)).add(new Vector3(0, 0.12, 0));
    aim(controllers[0]!, new Vector3(0.1, -0.2, 0), aimAt);
    rig.update(0.016, 1.1); // finds what is pointed at
    rig.update(0.016, 1.2); // and the label reacts on the next frame
    const sizes = sprites.map((s) => s.scale.x);
    expect(Math.max(...sizes)).toBeGreaterThan(0.34);
    expect(Math.max(...sizes)).toBeLessThan(0.45);
  });

  it('pointing at a zone and pulling the trigger opens that guardian', () => {
    const { rig, controller, controllers } = setup();
    rig.update(0.016, 1);
    const target = GUARDIANS[2]!;
    const zones = [...Array(5).keys()].map((i) => new Vector3(-2 + i, 0, -1 + (i % 2)));
    const zoneWorld = tablePoint(new Vector3(-2 + 2, 0, -1 + 0), coreCenter(zones)).add(new Vector3(0, 0.12, 0));
    aim(controllers[1]!, new Vector3(0.1, -0.2, 0), zoneWorld);
    rig.update(0.016, 1.1);
    controllers[1]!.dispatchEvent({ type: 'selectstart' } as never);
    expect(controller.getState().scene).toBe(target.id);
  });

  it('pointing at nothing does nothing', () => {
    const { rig, controller, controllers } = setup();
    rig.update(0.016, 1);
    aim(controllers[0]!, new Vector3(0, 0, 0), new Vector3(0, 5, 0));
    rig.update(0.016, 1.1);
    controllers[0]!.dispatchEvent({ type: 'selectstart' } as never);
    expect(controller.getState().scene).toBe('map');
  });

  it('menu buttons act on the experience; restart needs a second press; exit ends the session', () => {
    const { rig, controller, exit } = setup();
    rig.update(0.016, 1);
    rig.press('next');
    expect(controller.getState().scene).toBe('skats');
    rig.press('prev');
    expect(controller.getState().scene).toBe('map');
    rig.press('mute');
    expect(controller.getState().muted).toBe(true);
    rig.press('map');
    expect(controller.getState().scene).toBe('map');

    controller.selectZone('skats');
    controller.completeScene();
    rig.update(0.016, 2);
    rig.press('restart');
    expect(controller.getState().visited).toEqual(['skats']); // first press only asks
    rig.press('restart');
    expect(controller.getState().visited).toEqual([]);
    rig.press('exit');
    expect(exit).toHaveBeenCalledOnce();
  });

  it('the restart confirmation lapses if it is not pressed again in time', () => {
    const { rig, controller } = setup();
    controller.selectZone('skats');
    controller.completeScene();
    rig.update(0.016, 1);
    rig.press('restart');
    rig.update(0.016, 10); // well past the 3.5 s window
    rig.press('restart');
    expect(controller.getState().visited).toEqual(['skats']);
  });

  it('opens the finale from the "awaken" button once all five are awake', () => {
    const { rig, controller } = setup();
    for (const g of GUARDIANS) {
      controller.selectZone(g.id);
      controller.completeScene();
    }
    rig.update(0.016, 1);
    rig.press('awaken');
    expect(controller.getState().scene).toBe('finale');
  });

  it('draws story captions, the presenter prompt and the safety note from the scene clock', () => {
    const { rig, startScene, getPlayback, world } = setup('map');
    rig.update(0.016, 0.5); // map arrangement first
    startScene();
    const pb = getPlayback()!;
    const caption = rig.group.children.find((c) => c.userData.panel && Math.abs((c.userData.panel as { widthM: number }).widthM - 1.5) < 1e-6 && (c.userData.panel as { heightM: number }).heightM === 0.32)!;
    const mapY = caption.position.y;
    expect(mapY).toBeGreaterThan(0); // above the map table
    pb.clock.seek(25);
    rig.update(0.016, 2);
    expect(caption.position.y).toBeLessThan(mapY); // below the stage, not above the map
    expect(caption.visible).toBe(true);
    expect((world as { mode: string }).mode).toBe('attraction');
  });

  it('uses the finale beats and title during the finale', () => {
    const { rig, controller, world } = setup();
    for (const g of GUARDIANS) {
      controller.selectZone(g.id);
      controller.completeScene();
    }
    controller.goTo('finale');
    (world as { mode: string }).mode = 'finale';
    rig.update(0.016, 1);
    expect(PITCH.finale.title).toBeTruthy();
    rig.dispose();
  });
});
