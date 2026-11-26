# Note tehnice

## Pe scurt

React 19 + TypeScript + Vite 8, Three.js pentru tot ce se vede în 3D. Fără backend, autentificare,
localizare, GPS, analitice, recunoaștere de obiecte sau colectare de date. În Magic Mode nu se face
nicio cerere de rețea după încărcarea paginii.

```
src/
  content/      date: guardians.ts (sursa unică), pitchScript.ts, assets.ts, brand.ts
  experience/   starea: sceneState.ts (reducer pur), ExperienceController.ts, SceneClock.ts, timeline.ts
  ar/           ArAdapter (contract), MockArAdapter, MindArAdapter (izolat, lazy), createArAdapter
  three/        Stage (render loop, cameră, calitate), World (harta 3D), ZoneRig, SensesTree (finala),
                terrain (relief), landmarks, textures, kit, Mascot (sprite ilustrat)
  three/story/  StoryScene (scena cinematică pe straturi), compositions (datele fiecărei scene), art (ilustrații)
  scripts/      make-relief.py (relief din hartă), compile-marker.cjs (marker AR)
  scenes/       MapScene, AttractionScene, FinaleScene (HUD discret React + comenzi către Stage)
  presentation/ PresenterControls
  components/   Welcome, Scan, ZoneMarkers, Subtitles, PropPrompt, Notice, StageCanvas
  audio/        AudioEngine (WebAudio procedural, fără fișiere)
  app/          App, hooks, useArSession, main
  styles/       tokens.css (brand), base.css, ui.css
  test/         teste (vezi mai jos)
```

## Starea este deterministă

Toată experiența este un singur obiect (`ExperienceState`) care se schimbă doar prin `reduce()`
(`src/experience/sceneState.ts`): funcție pură, fără timere, fără aleatoriu, fără API-uri de browser.
Aceleași acțiuni dau mereu aceeași stare. Pentru repetiții: **Restart** readuce totul la început
(păstrează doar preferința de sunet).

```
welcome ──Start AR──▶ scan ──map found──▶ map ⇄ attraction(skats|austina|odzina|deguntins|plaukstina)
   │                    │                  │
   └──Magic Mode────────┴──────────────────┤ după toate cinci
                                           └──▶ finale
```

- Scenele de atracție rulează pe un `SceneClock` care avansează doar prin `tick(dt)`: determinist și
  testabil. `Stage` îl avansează cu timpul real (max. 0,5 s per cadru), deci o scenă de 30 s durează
  30 s și pe un telefon lent, iar un tab ascuns nu o sare.
- La sfârșitul cronologiei, scena așteaptă 1,2 s (să se citească ultima replică), apoi revine pe hartă
  și aprinde zona. `Next`/`Previous` din panou sunt definite ca inverse exacte unul altuia.
- `nonce` crește la fiecare intrare într-o scenă, așa că reluarea aceleiași scene o repornește.

## Datele ghidează totul

`src/content/guardians.ts` definește fiecare gardian: `id, name, sense, zone, themeColor,
learningGoal, physicalExperience, pitchBeats, propCue, rewardVisual, assetKeys, safetyNote` (plus
`durationSec`, `senseLabel`). Ecranele și scena 3D nu conțin nume, culori, replici sau recuzită scrise
de mână. Cheile din `assetKeys` aleg ce construiește `three/` (reper, activitate, mascotă), iar
testele verifică ca fiecare cheie să aibă implementare.

**Cronologia unei scene** este `pitchBeats`: replici (`mascot`, `narrator`) sau instrucțiuni pentru
prezentator (`presenter`), fiecare cu un moment (`at`) și, opțional, un `cue` (`enter`, `activity`,
`moment`, `prompt`). Vizualurile 3D sunt funcții de timp relative la aceste cue-uri.

## Două moduri

| | Magic Mode | AR mode |
|---|---|---|
| Cameră | nu | da (MindAR) |
| Marker | nu | `public/assets/markers/tervete-map.mind` |
| Randare | `Stage` are propriul renderer și cameră (cu mișcări cinematice) | MindAR deține camera și rendererul; diorama e atașată ancorei hărții |
| Cădere | — | orice eșec → Magic Mode, cu mesaj, fără blocaj |

`?ar=mock` simulează scanarea (fără cameră), ca să repeți fluxul AR sau să-l testezi.

### Integrarea MindAR (opțională și izolată)

- Doar `src/ar/MindArAdapter.ts` o importă, printr-un `import()` dinamic. Magic Mode nu descarcă
  MindAR/TensorFlow (≈1,3 MB, chunk separat).
- Eșecurile (`unsupported`, `denied`, `error`) devin status-uri, nu excepții. Reducerea le transformă
  în Magic Mode. Scanarea are mereu butonul „Continue in Magic Mode".
- `Stage.useHost()` mută diorama în `anchor.group` (1 unitate = lățimea hărții, +Z iese din hârtie) și
  predă bucla de randare lui MindAR.
- **Compatibilitate:** `mind-ar` importă `sRGBEncoding`, scos din three în r162. Un shim de build
  (`src/ar/threeCompat.ts`, activat din `vite.config.ts` doar pentru importurile venite din
  `mind-ar`) rezolvă asta atât la build, cât și în serverul de dev. `mind-ar` aduce și `canvas`
  (modul nativ, folosit doar de compilatorul din Node); `package.json` îl suprascrie cu un stub local
  (`stubs/canvas`) ca instalarea să nu necesite compilare nativă.
- **Marker:** trebuie compilat din harta A3 finală (vezi `public/assets/markers/README.md`). Până atunci
  `Start AR` revine în Magic Mode cu un mesaj.
- **Testat:** în Chromium, cu cameră falsă ce afișează harta și un marker compilat din harta
  placeholder: MindAR pornește, recunoaște harta, aplicația trece în `AR · tracking`, diorama se
  ancorează și marcajele se aliniază, fără erori în consolă. **Netestat:** pe un telefon real, cu harta
  tipărită (lumină, unghi, hârtie, performanță reală).
- Camera pe telefon cere HTTPS (sau `localhost`): `npm run dev:https`, apoi accepți certificatul
  autosemnat. Pe Android, `adb reverse tcp:5173 tcp:5173` face `localhost` accesibil fără certificat.

## Scenele de atracție: compoziții cinematice pe straturi

Harta 3D este doar **poarta de intrare și ecranul de progres**. Fiecare atracție este o scenă
cinematică, nu un decor 3D: ilustrații plate așezate în adâncime, fără personaje sau obiecte low-poly.

| Strat (de la fundal spre cameră) | Ce este |
|---|---|
| Backdrop fotografic | fotografie reală din parc, defocalizată (Odziņa folosește fotografia „Rūķišu Mežs" clară, cu o familie reală) |
| Siluete de pini decupate din hârtie, lumină prin copaci, particule | adâncime și atmosferă |
| Set de lemn: pergolă, felinare-cuib de viespe (Hornet Garden), masă de atelier, panou tactil, roata de mirosuri etc. | instalațiile fizice |
| Mascota ilustrată | respirație și legănare subtile |
| Recuzita reală | frunze, conuri, semințe, aluat sărat, fire, portocale, fructe de pădure, nuci… |
| Familia | copil și părinte, văzuți din spate, peste umăr |
| **AR, doar ca extensie magică** | contururi luminoase pe obiecte, modele ascunse în natură (spirala conului, forma frunzei din coroana copacilor), culori extrase din obiecte, unde sonore, amprentă |
| Prim-plan estompat | frunze defocalizate în colțuri |

Arcul fiecărei scene: **welcome** (apar decorul și mascota) → **activity** (apar recuzita reală, apoi
evidențierile AR) → **keepsake** (suvenirul călătorește de pe masă în centru și strălucește).
Suvenir există doar unde îl dă brief-ul: ornamentul din aluat sărat (Skats) și colierul (Odziņa).
La celelalte nu se inventează unul.

- **Date, nu cod:** `three/story/compositions.ts` descrie straturile (poziție în „unități de ecran" pe
  un cadru 16 × 9, adâncime `z`, moment de apariție legat de cue-urile din `pitchBeats`), evidențierile
  AR și suvenirul. `three/story/art.ts` desenează ilustrațiile (SVG/canvas) și încarcă fotografiile.
- **Parallax:** în Magic Mode camera derivă lent și înaintează ușor în cadru; câmpul vizual se alege ca
  mijlocul compoziției să încapă pe orice ecran (și pe telefon în portret). Conținutul stă puțin mai sus,
  ca subtitrările să nu acopere recuzita. Fără mișcare dacă `prefers-reduced-motion`.
- **În AR** scena devine un **pop-up** care plutește deasupra zonei, orientat spre cameră (billboard
  complet), cu harta tipărită vizibilă dedesubt. Telefonul mișcat dă parallax real.
- **Skats este scena hero:** pergolă cu felinare-cuib de viespe, masă de atelier cu frunze, conuri,
  semințe, aluat sărat, fire, lupă, copil și părinte, Skats ilustrat care îi ghidează. Celelalte patru
  folosesc același sistem, cu recuzita lor.

**ART PROVIZORIU.** Ilustrațiile de recuzită, familie și decor sunt desenate de cod (vectoriale), ca
direcția să fie demonstrabilă acum. Nu sunt arta finală. Înlocuire fără modificări de cod: pui imaginea
în `public/assets/` și o înregistrezi `ready` în `content/assets.ts` sub aceeași cheie (`loadArt` o
preferă). Mascotele celorlalți patru gardieni folosesc deocamdată mascota principală (băiatul-detectiv).

## VR (WebXR, Quest)

`src/vr/` + `Stage.enterVr()`. Același cod, o sesiune `immersive-vr` în locul adaptorului AR.

- **Pornire:** `Enter VR` apare dacă `navigator.xr.isSessionSupported('immersive-vr')` (HTTPS necesar). Orice
  eșec cade în Magic Mode cu mesaj. Sfârșitul sesiunii (headset scos, meniul Quest, Exit VR) readuce
  aplicația pe ecran, cu progresul păstrat. Starea are modul `vr` (`startVr` / `vrEnded`).
- **Interfața din headset** (`VrRig`): HTML-ul paginii nu se vede în headset, deci subtitrările, mesajul
  „Presenter", nota de siguranță, etichetele zonelor și meniul sunt desenate în 3D (`CanvasPanel`). Raza
  controllerului (Raycaster) alege zone și butoane. Nu mișcă camera niciodată (ar da rău de mișcare).
- **Machetă și teatru:** harta e o machetă de 2,4 m pe un piedestal, centrată pe nucleul parcului. Scenele
  sunt un teatru de ≈2,4 × 1,35 m; privitorul stă mai aproape decât în versiunea pe ecran, ca scena să umple
  câmpul vizual larg și straturile să se separe stereoscopic. Backdrop-ul înconjoară privitorul.
- **Ancorare:** runtime-urile pun originea spațiului „local" fie la cap, fie la podea, așa că tot conținutul
  se ancorează la poziția și direcția capului, citite după câteva cadre.
- **Quest 1 (Snapdragon 835, 2019):** calitate `low` forțată, rezoluție 0,8×, foveation maxim, build `es2020`
  (browserul Quest 1 nu se mai actualizează). Fără WebXR AR/mod mixt pe Quest 1.
- **Testat:** pe un Quest 2 **emulat** (IWER, Meta) în Chromium: sesiune, buclă de randare, ancorare, raza
  și trigger pe o zonă, butonul A, încheierea sesiunii. **Netestat pe un headset real**: fluiditate pe
  Quest 1, confort, lizibilitatea textului, versiunea reală de browser.

## Harta (poartă și progres)

Interimar, harta este **posterul oficial al parcului** (LVM, 2577 × 1851 px, aproape A3), descărcat de pe
atputa.lvm.lv. Diorama o folosește ca textură și o ridică în relief (lacul scobit, teritoriul parcului ca
platou, pădurea din jur mai joasă, copaci doar în pădurea exterioară, ca harta să rămână lizibilă).
Relieful se calculează din culorile hărții cu `scripts/make-relief.py`. Reperele celor 5 zone stau pe
poziții măsurate pe hartă. În Magic Mode camera încadrează nucleul parcului, nu tot posterul.

Markerul AR (`public/assets/markers/tervete-map.mind`) este compilat din aceeași hartă, deci
posterul tipărit poate fi folosit pentru a testa AR **acum**. Când vine harta finală: înlocuiești
imaginea, rulezi `scripts/make-relief.py`, recompilezi markerul (`scripts/compile-marker.cjs`) și
re-măsori `zone.mapPosition`.

## Asset-uri și drepturi

| Ce | Sursă | Stare |
|---|---|---|
| Harta (poster) și fotografiile de backdrop | site-ul oficial LVM (atputa.lvm.lv) | **provizoriu, intern.** Drepturile aparțin LVM; de confirmat înainte de orice publicare |
| Skats ilustrat | ilustrația mascotei din board-ul Figma, decupată din pagina albă | provizoriu; marginile decupajului pot fi retușate |
| Recuzită, familie, pergolă, felinare, panouri | desenate în cod | provizoriu, înlocuibile |
| Logo LVM, font Franklin Gothic | — | nu sunt incluse (licențe) |

## Performanță

- Totul se alocă o singură dată; nivelurile de calitate (`high`/`medium`/`low`) schimbă doar cât se
  desenează: pixel ratio, numărul de copaci (instanțiați), particule, umbre, emițătoare de zonă.
- Nivelul inițial vine din `hardwareConcurrency`, `deviceMemory` și tipul de pointer. Un guvernator
  urmărește timpul de cadru și coboară un nivel dacă media depășește ~27 ms. Doar în jos, ca imaginea să
  nu pâlpâie în mijlocul demonstrației.
- Copacii din fața scenei active se retrag în scenă și revin pe hartă.
- Bucla de randare se oprește când tabul e ascuns (rAF). Resursele Three.js sunt eliberate la `dispose()`.
- WebGL indisponibil: scenele, subtitrările și controalele continuă să funcționeze, cu un mesaj.

## Accesibilitate

- `prefers-reduced-motion`: fără legănare de cameră, cu tăieturi în loc de zboruri, particule și bucle
  oprite, fără animații CSS decorative. Informația rămâne (bara de progres și subtitrările).
- Toate replicile au subtitrări (`role="status"`, `aria-live="polite"`); narațiunea despre parc se
  distinge de vocea mascotei. Sunetul este opțional și nu poartă informație.
- Marcajele zonelor sunt butoane reale, cu etichete (`Open Skats: Sight, Hornet Garden. Asleep.`), în
  ordine de tab, cu focus vizibil. Panoul de prezentator se folosește complet de la tastatură.
- Culori din paleta LVM; text pe fundaluri închise opace/semi-opace, peste 7:1.

## Presupuneri (de confirmat)

Conținutul celor cinci zone urmează brief-ul întocmai. Ce urmează este scris pentru preview și marcat
`ASSUMPTION` în cod:

| Presupunere | Unde |
|---|---|
| Formularea tuturor replicilor mascotelor și a naratorului (fără activități noi) | `guardians.ts`, `pitchScript.ts` |
| Momentele vizuale și evidențierile AR (contur luminos, spirala conului, frunza ascunsă, culori, unde, amprentă) | `rewardVisual`, `three/story/compositions.ts` |
| Suvenir doar la Skats (ornament) și Odziņa (colier), cum cere brief-ul; la celelalte nu se inventează | `three/story/compositions.ts` |
| Culorile gardienilor, în afară de auriul brandului la Skats | `guardians.ts` |
| Pozițiile zonelor, măsurate pe posterul oficial; forma de relief și culorile copacilor | `zone.mapPosition`, `scripts/make-relief.py` |
| Mascota principală stă în locul celorlalți patru gardieni până vin ilustrațiile lor | `content/assets.ts` (`mascot-default`) |
| Ilustrațiile de recuzită, familie, decor și locul Arborelui (provizorii) | `three/story/art.ts`, `World.ts` |
| Denumirea locală „Iršu dārzs” (confirmată de poster: „IRŠU DĀRZS”); de validat cu echipa dacă brief-ul sursă folosește altă formă | `guardians.ts` |
| Tagline „Atklāj · Pēti · Sajūti", citit de pe panoul din ilustrația Figma | `content/brand.ts` |
| Numele letone ale zonelor vin de pe atputa.lvm.lv; „Green Classroom" nu are nume leton publicat | `guardians.ts` |
| Finala: text, durată (24 s) și faptul că arată mereu toți cei cinci gardieni | `pitchScript.ts` |
| Revenire automată pe hartă la sfârșitul unei scene | `AttractionScene.tsx` |
| Interfața în engleză (o singură limbă, fără sistem de localizare) | tot `src/` |

## Teste

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

- Conținut: toți gardienii au câmpurile, scenele au 20–40 s, cue-urile sunt complete, siguranța la
  Taste, fiecare cheie de asset are implementare.
- Stare: tranziții, `next`/`prev` inverse, restart, determinism, fallback AR.
- Flux integrat (jsdom, cu un `Stage` fals): Magic Mode complet până la finală, controale de
  prezentator, scurtături, mesaje AR și recuperare.
- 3D fără WebGL: zonele de pe hartă și scenele pe straturi rulează pe toată durata, în ecran și în pop-up AR, cu și fără mișcare, fără NaN; compozițiile sunt legate de biblioteca de artă; suvenirurile urmează brief-ul.
- AR: adaptorul Mock și căile de cădere ale MindAR.

Verificarea vizuală (capturi în Chromium cu WebGL software) este descrisă în `docs/test-checklist.md`.
Testarea pe un telefon real rămâne manuală.
