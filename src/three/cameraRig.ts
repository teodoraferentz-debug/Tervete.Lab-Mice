import { Box3, PerspectiveCamera, Vector3 } from 'three';

export interface ViewGoal {
  position: Vector3;
  target: Vector3;
}

/**
 * Finds the closest camera position, looking at the centre of `box` from the given
 * yaw/pitch, from which every corner of the box stays inside the frame.
 * Works for any aspect ratio, so phones in portrait get the same framing logic as a projector.
 */
export function fitView(
  camera: PerspectiveCamera,
  box: Box3,
  yaw: number,
  pitch: number,
  marginX = 0.92,
  marginY = 0.8,
): ViewGoal {
  const target = box.getCenter(new Vector3());
  const dir = new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const probe = camera.clone();
  probe.aspect = camera.aspect;
  probe.updateProjectionMatrix();

  const corners: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) corners.push(new Vector3(x, y, z));
    }
  }

  const v = new Vector3();
  const fits = (d: number): boolean => {
    probe.position.copy(target).addScaledVector(dir, d);
    probe.lookAt(target);
    probe.updateMatrixWorld(true);
    return corners.every((c) => {
      v.copy(c).project(probe);
      return Math.abs(v.x) <= marginX && Math.abs(v.y) <= marginY && v.z < 1;
    });
  };

  let lo = 0.5;
  let hi = 90;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return { position: target.clone().addScaledVector(dir, hi), target };
}
