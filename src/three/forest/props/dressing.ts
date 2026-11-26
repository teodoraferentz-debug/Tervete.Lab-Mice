import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Sprite, SpriteMaterial, Vector3, type Texture } from 'three';
import { cloneModel, loadModel } from '../loaders';
import { signTexture } from '../procedural';
import { cord, glowSprite, matte, mesh, planks } from '../propKit';

/**
 * The gateway every scene stands under: two posts and a beam with the guardian's trail sign and three
 * hanging lanterns (the real lantern model, decimated). It is the in-world title of the scene.
 */
export class Gateway {
  readonly group = new Group();
  private readonly lanterns: Array<{ group: Group; glow: Sprite; phase: number }> = [];

  constructor(glow: Texture, title: string, sub: string, accent: string) {
    const wood = planks('#c9ab88', 0.4, 2);
    for (const sx of [-1, 1]) this.group.add(mesh(new BoxGeometry(0.15, 2.55, 0.15), wood, sx * 1.55, 1.275, -2.1));
    this.group.add(mesh(new BoxGeometry(3.5, 0.14, 0.16), planks('#c4a584', 2, 0.2), 0, 2.5, -2.1));
    for (let i = 0; i < 6; i++) this.group.add(mesh(new BoxGeometry(0.08, 0.09, 1.1), planks('#c4a584', 0.3, 0.8), -1.4 + i * 0.56, 2.58, -2.1));

    const face = new MeshStandardMaterial({ map: signTexture(title, sub, accent), roughness: 0.85 });
    const edge = matte('#4a2e1a');
    const sign = new Mesh(new BoxGeometry(1.0, 0.31, 0.04), [edge, edge, edge, edge, face, face]);
    sign.position.set(0, 2.02, -2.1);
    sign.castShadow = true;
    this.group.add(sign);
    for (const x of [-0.4, 0.4]) this.group.add(cord([new Vector3(x, 2.43, -2.1), new Vector3(x, 2.2, -2.1), new Vector3(x, 2.175, -2.1)], 0.006, '#6f5230', 4));

    const spots: Array<[number, number]> = [
      [-1.1, 1.95],
      [1.05, 1.85],
      [1.5, 2.12],
    ];
    spots.forEach(([x, y], i) => {
      const lg = new Group();
      lg.position.set(x, y, -2.05);
      const halo = glowSprite(glow, '#ffb347', 0.95, 0.85);
      halo.position.y = -0.1;
      lg.add(halo);
      lg.add(cord([new Vector3(0, 2.45 - y, 0), new Vector3(0, (2.45 - y) / 2, 0), new Vector3(0, 0.12, 0)], 0.004, '#3b2a1a', 4));
      this.group.add(lg);
      this.lanterns.push({ group: lg, glow: halo, phase: i * 1.7 });
      void loadModel('Lantern_01').then((src) => {
        if (!src) return;
        const lamp = cloneModel(src);
        lamp.scale.setScalar(0.3 / 0.9);
        lamp.position.y = -0.24;
        lamp.traverse((o) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          m.castShadow = false;
          const mat = (m.material as MeshStandardMaterial).clone();
          mat.emissive.set('#ff9a3a');
          mat.emissiveIntensity = 0.35;
          m.material = mat;
        });
        lg.add(lamp);
      });
    });
  }

  /** The lanterns sway and flicker. */
  update(time: number, motion: number): void {
    for (const l of this.lanterns) {
      l.group.rotation.z = Math.sin(time * 0.8 + l.phase) * 0.025 * motion;
      (l.glow.material as SpriteMaterial).opacity = 0.72 + Math.sin(time * 5.1 + l.phase) * 0.07 * motion + Math.sin(time * 2.3 + l.phase) * 0.05 * motion;
    }
  }
}
