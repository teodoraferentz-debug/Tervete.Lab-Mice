import { Group, Sprite, SpriteMaterial } from 'three';
import { isReady } from '../content/assets';
import type { Guardian } from '../content/guardians';
import { loadArt } from './story/art';
import { easeOutBack } from './util';

export interface MascotRig {
  group: Group;
  /** appear = seconds since the guardian arrived (-1 = not yet). */
  update(t: number, appear: number, speaking: boolean, motion: number): void;
}

/**
 * Billboard of the illustrated mascot (used where a mascot stands in the 3D diorama, e.g. the finale).
 * A guardian with its own ready illustration uses it; otherwise the main Tērvete mascot stands in.
 * Mascots are never built from 3D primitives.
 */
export function buildMascot(guardian: Guardian, scale = 1): MascotRig {
  const key = isReady(guardian.assetKeys.mascot) ? guardian.assetKeys.mascot : 'mascot-default';
  const group = new Group();
  const material = new SpriteMaterial({ transparent: true, depthWrite: false });
  const sprite = new Sprite(material);
  const height = 1.1 * scale;
  sprite.scale.set(height, height, 1);
  sprite.position.y = height / 2;
  group.add(sprite);
  void loadArt(key)
    .then((art) => {
      material.map = art.texture;
      material.needsUpdate = true;
      sprite.scale.set(height * art.aspect, height, 1);
    })
    .catch((error) => console.warn('[mascot] art not available', error));

  return {
    group,
    update(t, appear, _speaking, motion) {
      const p = appear < 0 ? 0 : easeOutBack(appear / 0.7);
      group.scale.setScalar(Math.max(0.0001, p));
      sprite.position.y = height / 2 + Math.sin(t * 1.8) * 0.01 * motion;
    },
  };
}
