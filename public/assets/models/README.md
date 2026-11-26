# 3D models

Everything here is loaded by `src/three/forest/` and is optimised for a Meta Quest 1 (meshopt-compressed GLB,
WebP textures, a few thousand triangles each).

## Mascots (provided by the team)

- `mascots/skats.glb`, `mascots/deguntins.glb`: the real 3D mascots. A scene looks for `mascots/<guardian id>.glb`
  and, when the file exists, stands that model in the clearing (scaled to about 1.15 m); otherwise a provisional
  carved-wood totem with the sense emblem is shown. To add the others, drop `austina.glb`, `odzina.glb` and
  `plaukstina.glb` here. No code change needed.

## Forest set dressing (CC0, Poly Haven)

`pine_sapling_small`, `fir_sapling`, `fern_02`, `rock_moss_set_01`, `tree_stump_01`, `Lantern_01`, plus the
skybox (`../env/forest-sky.jpg`, from the HDRI "Misty Pines") and the ground, bark and plank textures
(`../textures/`). All CC0 (public domain), from polyhaven.com. They were decimated (gltf-transform simplify)
and resized for the headset; the original assets are not in this repository.
