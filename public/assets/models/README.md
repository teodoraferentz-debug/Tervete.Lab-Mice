# 3D models

Everything here is loaded by `src/three/forest/` and is optimised for a Meta Quest 1 (meshopt-compressed GLB,
WebP textures, a few thousand triangles each).

## Mascots

The guardians are modelled in code, from the brand illustrations, in `src/three/forest/mascots3d.ts` (soft
rounded bodies, the big mushroom cap, black eyes with two highlights, the thick black outline of the artwork
drawn with an inverted hull, three-step cel shading with a paper grain). Skats, Deguntiņš and Plaukstiņa are
done. Austiņa and Odziņa have no illustration yet: they stand as a carved-wood totem with their sense emblem
until theirs are modelled the same way (add a builder in `mascots3d.ts` and a case in `buildMascot3D`).

## Forest set dressing (CC0, Poly Haven)

`pine_sapling_small`, `fir_sapling`, `fern_02`, `rock_moss_set_01`, `tree_stump_01`, `Lantern_01`, plus the
skybox (`../env/forest-sky.jpg`, from the HDRI "Misty Pines") and the ground, bark and plank textures
(`../textures/`). All CC0 (public domain), from polyhaven.com. They were decimated (gltf-transform simplify)
and resized for the headset; the original assets are not in this repository. Everything else (mushrooms,
basket, props, leaves) is built in code.
