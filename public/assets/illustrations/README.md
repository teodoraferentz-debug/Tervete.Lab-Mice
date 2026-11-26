# Illustrations

What is here, and where it comes from:

| File | What | Source / status |
|---|---|---|
| `tervete-map.webp` | ground texture of the map | LVM park map poster (atputa.lvm.lv). **Interim, internal use.** Rights belong to LVM. |
| `tervete-map-relief.png` | 3D relief (R height, G trees, B water) | generated from the map by `scripts/make-relief.py` |
| `backdrops/*.webp` | photographic scene backdrops | official park photos (atputa.lvm.lv), defocused. **Interim.** |
| `mascots/skats.webp` | Skats, the detective illustration | Figma board, cut out of its white page. Also stands in for the other guardians (`mascot-default`). |

To use final art, put the file here and set `status: 'ready'` on the matching key in
`src/content/assets.ts` (the loader prefers it over the drawn version). Keys in use: `map-illustration`,
`map-relief`, `mascot-default`, `mascot-skats`, `mascot-austina`, `mascot-odzina`, `mascot-deguntins`,
`mascot-plaukstina`. Any story art key (see `src/three/story/art.ts`, e.g. `table`, `leaves-cluster`,
`person-parent`, `scent-wheel`) can be replaced the same way with a transparent PNG/WebP.

When the final map replaces the poster: run `python3 scripts/make-relief.py path/to/map.png`, recompile
the AR marker from the same image (`public/assets/markers/README.md`), and re-measure each guardian's
`zone.mapPosition` in `src/content/guardians.ts`.

Keep every file under ~450 KB (WebP, quality ~80) so the preview loads fast on mobile data.
Only use art the park owns or is licensed to use.
