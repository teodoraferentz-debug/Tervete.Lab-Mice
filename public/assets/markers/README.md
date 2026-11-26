# AR marker (image target)

`Start AR` looks for **`tervete-map.mind`** in this folder. The committed one is compiled from the
**interim map** (the park's official poster, `../illustrations/tervete-map.webp`), so that poster can be
printed and tracked today. Recompile it when the final map arrives. If the file is missing, `Start AR`
says so in the console and the app continues in Magic Mode (nothing breaks).

## Compile it

1. Export the final A3 map illustration as a flat image (PNG/JPG, ~1500 px wide, no crop marks, same
   proportions as the print: 420 × 297 mm, ratio 1.414:1).
2. Open the MindAR compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile
3. Upload the image, press **Start**, then **Download compiled** and save the file here as
   `public/assets/markers/tervete-map.mind`.

Tips for good tracking: the map needs plenty of detailed, high-contrast texture across the whole
sheet (forests, labels, paths) and a matte finish. Avoid large flat areas and glossy paper.

The same illustration should be used as the diorama ground texture (see
`public/assets/illustrations/README.md`), so the 3D scene lines up exactly with the paper.
