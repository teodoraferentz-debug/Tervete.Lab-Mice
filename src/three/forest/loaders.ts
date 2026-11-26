import { EquirectangularReflectionMapping, Group, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { assetUrl } from '../../content/assets';

/**
 * Loading of the real 3D assets (CC0 models and textures from Poly Haven, optimised for a Quest 1:
 * meshopt-compressed GLB, WebP textures). Everything is cached; a missing or broken file resolves to null /
 * an empty texture so the scene still builds (and the tests, which have no network, still run).
 */

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const textureLoader = new TextureLoader();
const models = new Map<string, Promise<Group | null>>();
const textures = new Map<string, Texture>();

/** Loads `models/<name>.glb` once. Resolves to null when the file is absent or cannot be parsed. */
export function loadModel(name: string): Promise<Group | null> {
  let hit = models.get(name);
  if (!hit) {
    hit = gltf
      .loadAsync(assetUrl(`models/${name}.glb`))
      .then((g) => g.scene)
      .catch((error: unknown) => {
        if (!name.startsWith('mascots/')) console.warn(`[assets] model "${name}" could not be loaded`, error);
        return null;
      });
    models.set(name, hit);
  }
  return hit;
}

/**
 * A tiling PBR map. Each distinct (file, tiling) is loaded once and shared (the browser caches the file, so
 * a second tiling costs no download).
 */
export function loadMap(name: string, opts: { srgb?: boolean; repeatX?: number; repeatY?: number } = {}): Texture {
  const rx = opts.repeatX ?? 1;
  const ry = opts.repeatY ?? rx;
  const key = `${name}|${rx}|${ry}|${opts.srgb ? 's' : 'l'}`;
  let t = textures.get(key);
  if (!t) {
    t = textureLoader.load(assetUrl(`textures/${name}.jpg`));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    t.repeat.set(rx, ry);
    if (opts.srgb) t.colorSpace = SRGBColorSpace;
    textures.set(key, t);
  }
  return t;
}

/** The forest skybox (equirectangular, 2048 × 1024). */
export function loadSky(): Promise<Texture> {
  return textureLoader.loadAsync(assetUrl('env/forest-sky.jpg')).then((t) => {
    t.colorSpace = SRGBColorSpace;
    t.mapping = EquirectangularReflectionMapping;
    return t;
  });
}

/** Clones a loaded model; materials stay shared unless the caller clones them. */
export function cloneModel(source: Object3D): Object3D {
  return source.clone(true);
}
