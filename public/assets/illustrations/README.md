# Illustrations

The prototype draws placeholder art procedurally. To use final art, add the file here and flip the
entry to `status: 'ready'` in `src/content/assets.ts`. No other code changes are needed.

| Asset key | File | Notes |
|---|---|---|
| `map-illustration` | `tervete-map.webp` | Final illustrated A3 map, landscape 1.414:1, ~2048 px wide. Becomes the diorama ground. Re-measure each guardian's `zone.mapPosition` (u, v from the top-left, 0–1) in `src/content/guardians.ts`. |
| `mascot-skats` | `mascots/skats.webp` | Transparent background (WebP or PNG), full body, facing the camera. |
| `mascot-austina` | `mascots/austina.webp` | same |
| `mascot-odzina` | `mascots/odzina.webp` | same |
| `mascot-deguntins` | `mascots/deguntins.webp` | same |
| `mascot-plaukstina` | `mascots/plaukstina.webp` | same |

Keep every file under ~400 KB (WebP, quality ~80) so the preview loads fast on mobile data.
Only use art the park owns or is licensed to use.
