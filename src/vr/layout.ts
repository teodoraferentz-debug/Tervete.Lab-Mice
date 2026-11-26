import { Vector3 } from 'three';

/**
 * Where things sit in the headset, in metres, relative to the player's head when the session starts
 * (reference space "local": works the same seated or standing). The player faces -Z.
 */

/**
 * The map becomes a tabletop miniature: 8 map units × this scale ≈ 2.4 m wide. The five zones are close
 * together on the real map, so the table is centred on the park core (the average of the zones), which
 * is what sits in front of the player.
 */
export const VR_MAP_SCALE = 0.3;
export const VR_MAP_POSITION = new Vector3(0, -0.8, -1.1);

/** Centre (x, z) of a set of zone positions, on the map's own axes. */
export function coreCenter(points: readonly Vector3[]): Vector3 {
  const c = new Vector3();
  for (const p of points) c.add(p);
  return points.length ? c.multiplyScalar(1 / points.length).setY(0) : c;
}

/** Where a point of the map lands on the table (before the player-anchored rotation and offset). */
export function tablePoint(mapPoint: Vector3, core: Vector3): Vector3 {
  return mapPoint.clone().sub(core).multiplyScalar(VR_MAP_SCALE).add(VR_MAP_POSITION);
}

/** Story scenes become a "theatre": the 16 × 9 stage is this scale, so ≈ 2.4 m wide, 1.35 m tall. */
export const VR_STAGE_SCALE = 0.15;
/**
 * Where the player's eyes are on the stage's depth axis. The screen version is authored for an eye 16 units
 * from the stage; a headset's field of view is far wider, so the player stands closer (11): the scene fills
 * their view and the layers separate more, which is where the stereo depth comes from.
 */
export const VR_EYE_Z = 11;
export const VR_STAGE_POSITION = new Vector3(0, 0, -VR_EYE_Z * VR_STAGE_SCALE);

/** Quest 1 is a 2019 phone-class GPU: render fewer pixels and let the headset blur the edges. */
export const VR_RESOLUTION_SCALE = 0.8;
export const VR_FOVEATION = 1;
