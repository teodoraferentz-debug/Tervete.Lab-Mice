import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type ColorRepresentation,
} from 'three';

/** A material whose colour can be dimmed to a grey "dormant" look and brought back to life. */
export interface Tint {
  mat: MeshStandardMaterial;
  base: Color;
  grey: Color;
}

/**
 * Tiny primitive kit: flat-shaded, low-poly, consistent look. Landmarks register their
 * materials so a zone can be dormant (desaturated) or awake (full colour + glow).
 */
export class Kit {
  readonly tints: Tint[] = [];

  constructor(private readonly registerTints = false) {}

  mat(color: ColorRepresentation, roughness = 0.85): MeshStandardMaterial {
    const mat = new MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    if (this.registerTints) {
      const base = new Color(color);
      const lum = base.r * 0.3 + base.g * 0.55 + base.b * 0.15;
      // Dormant = darker, desaturated, slightly cool.
      const grey = new Color(lum * 0.78, lum * 0.82, lum * 0.8);
      this.tints.push({ mat, base, grey });
    }
    return mat;
  }

  mesh(parent: Object3D, geo: BufferGeometry, color: ColorRepresentation, x = 0, y = 0, z = 0): Mesh {
    const m = new Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  box(parent: Object3D, w: number, h: number, d: number, color: ColorRepresentation, x = 0, y = 0, z = 0): Mesh {
    return this.mesh(parent, new BoxGeometry(w, h, d), color, x, y + h / 2, z);
  }

  cyl(parent: Object3D, rt: number, rb: number, h: number, color: ColorRepresentation, x = 0, y = 0, z = 0, seg = 8): Mesh {
    return this.mesh(parent, new CylinderGeometry(rt, rb, h, seg), color, x, y + h / 2, z);
  }

  cone(parent: Object3D, r: number, h: number, color: ColorRepresentation, x = 0, y = 0, z = 0, seg = 7): Mesh {
    return this.mesh(parent, new ConeGeometry(r, h, seg), color, x, y + h / 2, z);
  }

  sphere(parent: Object3D, r: number, color: ColorRepresentation, x = 0, y = 0, z = 0, seg = 10): Mesh {
    return this.mesh(parent, new SphereGeometry(r, seg, Math.max(6, seg - 2)), color, x, y, z);
  }

  capsule(parent: Object3D, r: number, len: number, color: ColorRepresentation, x = 0, y = 0, z = 0): Mesh {
    return this.mesh(parent, new CapsuleGeometry(r, len, 4, 8), color, x, y, z);
  }

  group(parent: Object3D, x = 0, y = 0, z = 0): Group {
    const g = new Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
}

/** Dispose geometries and materials below `root` (textures are owned elsewhere). */
export function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}
