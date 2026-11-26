import { Group, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, TextureLoader, TorusGeometry, SRGBColorSpace, SphereGeometry } from 'three';
import { BRAND } from '../content/brand';
import { getAsset, isReady } from '../content/assets';
import type { Guardian, Sense } from '../content/guardians';
import { Kit } from './kit';
import { easeOutBack, mixHex } from './util';

const SKIN = '#f2caa0';
const HAIR = '#7a4f2d';

export interface MascotRig {
  group: Group;
  /** t = scene seconds, appear = seconds since the guardian entered (-1 = not yet), speaking = a mascot line is on screen. */
  update(t: number, appear: number, speaking: boolean, motion: number): void;
}

/**
 * Placeholder mascot built from primitives: a little forest sprite with a leaf crown,
 * tinted per guardian, with one oversized feature for its sense.
 * If final art is registered as a ready sprite (content/assets.ts), a billboard replaces it.
 */
export function buildMascot(guardian: Guardian, scale = 1): MascotRig {
  const key = guardian.assetKeys.mascot;
  if (isReady(key)) return buildSpriteMascot(key, scale);
  return buildPrimitiveMascot(guardian, scale);
}

function buildSpriteMascot(key: string, scale: number): MascotRig {
  const entry = getAsset(key);
  const group = new Group();
  const material = new SpriteMaterial({ transparent: true, depthWrite: false });
  const sprite = new Sprite(material);
  const height = (entry?.height ?? 1.5) * scale * 0.55;
  sprite.scale.set(height, height, 1);
  sprite.position.y = height / 2;
  group.add(sprite);
  if (entry) {
    new TextureLoader().load(entry.url, (tex) => {
      tex.colorSpace = SRGBColorSpace;
      material.map = tex;
      material.needsUpdate = true;
      const img = tex.image as { width: number; height: number };
      sprite.scale.set(height * (img.width / img.height), height, 1);
    });
  }
  return {
    group,
    update(t, appear, _speaking, motion) {
      const p = appear < 0 ? 0 : easeOutBack(appear / 0.7);
      group.scale.setScalar(Math.max(0.0001, p));
      sprite.position.y = height / 2 + Math.sin(t * 2) * 0.012 * motion;
    },
  };
}

function buildPrimitiveMascot(guardian: Guardian, scale: number): MascotRig {
  const kit = new Kit(false);
  const root = new Group();
  const body = new Group();
  root.add(body);
  const theme = guardian.themeColor;
  const tunic = mixHex(theme, '#e8dcb8', 0.45);
  const sense: Sense = guardian.sense;

  // Legs + bark boots
  for (const x of [-0.07, 0.07]) {
    kit.capsule(body, 0.045, 0.1, '#8a5a33', x, 0.17, 0);
    const boot = kit.sphere(body, 0.065, '#6b4a2c', x, 0.055, 0.015, 8);
    boot.scale.set(1, 0.7, 1.25);
  }
  // Tunic + moss vest + belt
  const torso = kit.capsule(body, 0.15, 0.2, tunic, 0, 0.42, 0);
  torso.scale.set(1, 1, 0.88);
  const vest = kit.capsule(body, 0.158, 0.16, BRAND.colors.leaf, 0, 0.42, 0.012);
  vest.scale.set(1.0, 0.9, 0.9);
  vest.material = kit.mat(BRAND.colors.leaf);
  kit.mesh(body, new TorusGeometry(0.15, 0.014, 6, 16), '#6b4a2c', 0, 0.34, 0).rotation.x = Math.PI / 2;
  const emblem = kit.cone(body, 0.03, 0.06, '#f3e9cf', 0, 0.4, 0.14, 5);
  emblem.rotation.x = Math.PI / 2 - 0.1;

  // Arms (pivot at shoulder so the right one can wave)
  const armL = new Group();
  armL.position.set(-0.17, 0.52, 0);
  body.add(armL);
  const armR = new Group();
  armR.position.set(0.17, 0.52, 0);
  body.add(armR);
  for (const arm of [armL, armR]) {
    kit.capsule(arm, 0.04, 0.12, '#9c6b3f', 0, -0.09, 0);
    kit.sphere(arm, 0.045, SKIN, 0, -0.19, 0, 8);
  }
  armL.rotation.z = 0.35;
  armR.rotation.z = -0.35;

  // Head
  const head = new Group();
  head.position.set(0, 0.72, 0);
  body.add(head);
  kit.sphere(head, 0.19, SKIN, 0, 0, 0, 14);
  const hair = kit.mesh(head, new SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), HAIR, 0, 0.015, -0.012);
  hair.rotation.x = -0.25;
  for (const x of [-0.065, 0.065]) {
    kit.sphere(head, 0.038, '#ffffff', x, 0.02, 0.16, 8);
    const pupil = kit.sphere(head, 0.021, '#2a1a10', x, 0.02, 0.19, 6);
    pupil.name = 'pupil';
    kit.sphere(head, 0.016, '#f9b9a0', x * 1.9, -0.045, 0.145, 6).scale.set(1, 0.6, 0.4);
  }
  const smile = kit.mesh(head, new TorusGeometry(0.05, 0.009, 5, 12, Math.PI), '#7a3a2a', 0, -0.055, 0.176);
  smile.rotation.z = Math.PI;

  // Leaf crown with berries in the guardian's colour
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const leaf = kit.cone(head, 0.034, 0.1, i % 3 === 0 ? BRAND.colors.moss : BRAND.colors.leaf, Math.sin(a) * 0.17, 0.14, Math.cos(a) * 0.17, 4);
    leaf.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    if (i % 3 === 1) kit.sphere(head, 0.024, theme, Math.sin(a) * 0.16, 0.2, Math.cos(a) * 0.16, 6);
  }

  // One oversized feature per sense
  const props = new Group();
  body.add(props);
  switch (sense) {
    case 'sight': {
      // Magnifying glass
      armR.add(props);
      props.position.set(0.02, -0.2, 0.06);
      const ring = new Mesh(new TorusGeometry(0.075, 0.014, 6, 16), new MeshBasicMaterial({ color: BRAND.colors.gold }));
      ring.position.set(0, 0.07, 0);
      props.add(ring);
      const lens = new Mesh(new SphereGeometry(0.07, 12, 8), new MeshBasicMaterial({ color: '#bfe8f2', transparent: true, opacity: 0.4 }));
      lens.scale.z = 0.15;
      lens.position.copy(ring.position);
      props.add(lens);
      kit.cyl(props, 0.011, 0.011, 0.11, '#6b4a2c', 0, -0.07, 0, 5);
      break;
    }
    case 'hearing': {
      // Big leaf-ears
      for (const s of [-1, 1]) {
        const ear = kit.sphere(head, 0.09, mixHex(theme, '#ffffff', 0.15), s * 0.2, 0.04, 0, 8);
        ear.scale.set(0.45, 1.25, 0.9);
        ear.rotation.z = s * 0.25;
      }
      break;
    }
    case 'taste': {
      // Berry cap and a wooden spoon
      const berry = kit.sphere(head, 0.075, '#c4452f', 0.0, 0.215, 0.05, 8);
      berry.scale.y = 0.85;
      armR.add(props);
      props.position.set(0.0, -0.2, 0.05);
      kit.cyl(props, 0.008, 0.008, 0.16, BRAND.colors.woodLight, 0, -0.04, 0, 5);
      const spoon = kit.sphere(props, 0.03, BRAND.colors.woodLight, 0, 0.1, 0, 6);
      spoon.scale.set(1, 1.3, 0.4);
      break;
    }
    case 'smell': {
      // Big friendly nose
      const nose = kit.sphere(head, 0.05, '#f0a98c', 0, -0.02, 0.2, 10);
      nose.scale.set(1, 1.05, 1.1);
      break;
    }
    case 'touch': {
      // Oversized mitten hands
      for (const arm of [armL, armR]) {
        const hand = kit.sphere(arm, 0.07, mixHex(SKIN, theme, 0.25), 0, -0.2, 0.0, 9);
        hand.scale.set(1.15, 1, 0.7);
        kit.sphere(arm, 0.028, mixHex(SKIN, theme, 0.25), 0.07 * (arm === armL ? 1 : -1), -0.18, 0, 6);
      }
      break;
    }
  }

  root.scale.setScalar(scale);

  const pupils = head.children.filter((c) => c.name === 'pupil');
  return {
    group: root,
    update(t, appear, speaking, motion) {
      const p = appear < 0 ? 0 : easeOutBack(appear / 0.7);
      root.scale.setScalar(Math.max(0.0001, p * scale));
      body.position.y = Math.max(0, Math.sin(t * 2.1)) * 0.012 * motion;
      head.rotation.z = Math.sin(t * 1.3) * 0.04 * motion;
      // Friendly wave while a mascot line is on screen
      const wave = speaking ? Math.sin(t * 7) * 0.35 * motion : 0;
      const rest = sense === 'sight' || sense === 'taste' ? -0.55 : -0.35;
      armR.rotation.z = speaking && sense !== 'sight' && sense !== 'taste' ? -2.3 + wave : rest + Math.sin(t * 1.6) * 0.04 * motion;
      // Blink
      const blink = Math.sin(t * 0.9 + 1) > 0.985 ? 0.15 : 1;
      pupils.forEach((pp) => (pp.scale.y = blink));
    },
  };
}
