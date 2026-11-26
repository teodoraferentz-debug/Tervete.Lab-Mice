import { Box3, Group, SRGBColorSpace, Sprite, SpriteMaterial, TextureLoader, Vector3 } from 'three';
import { getAsset, isReady } from '../content/assets';
import type { Guardian } from '../content/guardians';
import { buildMascot3D } from './forest/mascots3d';
import { easeOutBack } from './util';

export interface MascotRig {
  group: Group;
  /** appear = seconds since the guardian arrived (-1 = not yet). */
  update(t: number, appear: number, speaking: boolean, motion: number): void;
}

/**
 * A mascot standing in the 3D diorama (the finale). A guardian with a real 3D model
 * (public/assets/models/mascots/<id>.glb) stands there as that model; otherwise its illustration is a
 * billboard, and the main Tērvete mascot stands in when there is none.
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
  const entry = getAsset(key);
  if (entry) {
    new TextureLoader().load(
      entry.url,
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        material.map = texture;
        material.needsUpdate = true;
        const img = texture.image as { width: number; height: number };
        sprite.scale.set(height * (img.width / img.height), height, 1);
      },
      undefined,
      () => console.warn('[mascot] art not available'),
    );
  }
  const model = buildMascot3D(guardian.id);
  if (model) {
    const box = new Box3().setFromObject(model);
    const size = box.getSize(new Vector3());
    model.scale.setScalar(height / Math.max(0.001, size.y));
    box.setFromObject(model);
    model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    sprite.visible = false;
    group.add(model);
  }

  return {
    group,
    update(t, appear, _speaking, motion) {
      const p = appear < 0 ? 0 : easeOutBack(appear / 0.7);
      group.scale.setScalar(Math.max(0.0001, p));
      sprite.position.y = height / 2 + Math.sin(t * 1.8) * 0.01 * motion;
    },
  };
}
