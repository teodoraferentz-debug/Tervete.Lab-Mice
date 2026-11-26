# Listă de verificare

Bifează înainte de fiecare prezentare. Primele patru secțiuni se pot face la birou, restul pe
dispozitivele reale.

## 1. Automat (la fiecare modificare)

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`

## 2. Magic Mode, de la cap la coadă (desktop)

- [ ] Ecranul de bun venit are **Start AR** și **Magic Mode**, iar textul spune că este un preview.
- [ ] **Magic Mode** deschide dioramă cu **5 zone adormite** (gri, fără lumină) și „0 of 5 guardians awake".
- [ ] Fiecare marcaj de zonă se poate atinge cu mouse-ul și se poate ajunge la el cu Tab (Enter îl deschide).
- [ ] Fiecare scenă (20–40 s) arată: titlul gardianului, mascota, reprezentarea activității fizice,
      un moment vizual memorabil, subtitrări, mesajul galben „Presenter" cu recuzita, apoi revine pe hartă.
- [ ] La revenire, **zona vizitată se luminează** în culoarea ei, are bifă, iar contorul crește.
- [ ] Scenele sunt compoziții pe straturi (backdrop foto, mascotă ilustrată, recuzită, familie, AR), fără personaje low-poly și fără text mare peste scenă.
- [ ] **Skats (hero):** masă de atelier cu frunze, conuri, semințe, aluat sărat, fire, lupă; copil și părinte; AR scoate la iveală spirala conului, culorile, forma frunzei ascunse în natură; ornamentul-suvenir urcă în centru.
- [ ] **Odziņa:** colierul din portocală uscată, fructe de pădure și nuci apare ca suvenir; zonele fără suvenir în brief (Austiņa, Deguntiņš, Plaukstiņa) nu inventează unul.
- [ ] Scena **Odziņa** arată nota de siguranță, iar replicile nu încurajează consumul de plante din pădure.
- [ ] După a cincea zonă apare butonul **Awaken the Tree of Five Senses**; finala arată toți cei cinci
      gardieni și copacul cu cinci culori.
- [ ] O zonă vizitată se poate redeschide (Replay) fără să se dubleze în contor.

## 3. Controale de prezentator

- [ ] `P` (sau mânerul `⋯`) deschide/închide panoul; `Esc` îl închide.
- [ ] `→` / `←` merg la scena următoare/anterioară. `←` după o scenă încheiată o redeschide.
- [ ] Lista de scene sare direct la oricare dintre cele 9 (Welcome, Map, 5 gardieni, Finală).
- [ ] `M` și butonul opresc/pornesc sunetul (ambianță și clinchet).
- [ ] „Switch to Magic Mode" funcționează în mijlocul demonstrației și păstrează progresul.
- [ ] **Restart** cere a doua apăsare și readuce la bun venit cu 0/5; repetă fluxul de două ori și
      verifică că arată identic.
- [ ] Panoul nu acoperă informații importante și nu se deschide singur.

## 4. Reziliență

- [ ] **Fără cameră / permisiune refuzată:** Start AR → mesaj și continuare în Magic Mode, fără blocaj.
- [ ] **Fără marker** (`tervete-map.mind` lipsă): Start AR → mesaj și Magic Mode. Consolă: avertisment clar.
- [ ] Ecranul de scanare are mereu „Continue in Magic Mode".
- [ ] `?ar=mock`: scanare simulată → hartă în modul AR; panoul arată `AR · tracking`.
- [ ] Rețea oprită după încărcare: Magic Mode merge complet (nu face cereri de rețea).
- [ ] WebGL dezactivat: apare mesajul, iar subtitrările și controalele rămân utilizabile.

## 5. Accesibilitate

- [ ] **Reduced motion** (setarea sistemului): fără legănare de cameră, cu tăieturi în loc de zboruri,
      particule oprite; subtitrările și bara de progres rămân.
- [ ] Subtitrările pot fi citite pe proiector de la distanță (≥ 18 px, contrast mare).
- [ ] Cititor de ecran: replicile sunt anunțate politicos; marcajele au etichete cu zona și starea.
- [ ] Focusul este mereu vizibil; totul se poate face fără mouse.
- [ ] Zoom 200%: butoanele și textul rămân utilizabile.

## 6. Mobil (telefon real, portret și peisaj)

- [ ] `npm run dev:https` (sau `adb reverse`), deschide adresa pe telefon, acceptă certificatul.
- [ ] Bun venit încape fără scroll; butoanele sunt ușor de atins (≥ 44 px).
- [ ] Harta se rotește în portret și rămâne lizibilă; etichetele nu se suprapun.
- [ ] Scenele sunt încadrate corect, iar subtitrările și mesajul de recuzită nu se suprapun.
- [ ] Rotirea ecranului în timpul unei scene nu strică încadrarea.
- [ ] Fluiditate: scena curge fără sacadări vizibile. Pe dispozitive slabe, calitatea scade singură.
- [ ] Bateria și încălzirea după 10 minute sunt acceptabile (rulează demonstrația de două ori).

## 7. AR cu harta tipărită (după ce există harta finală și markerul)

- [ ] Markerul compilat este în `public/assets/markers/tervete-map.mind` (vezi README-ul din acel folder).
- [ ] Start AR → cere camera → „Point the camera at the Tērvete map" → harta e recunoscută în câteva secunde.
- [ ] Diorama se aliniază cu hârtia (marginile și poziția zonelor coincid cu harta tipărită).
- [ ] O scenă de atracție apare ca **pop-up** deasupra zonei, orientat spre cameră, citibil și când telefonul privește de sus.
- [ ] Marcajele zonelor urmăresc zonele când mișcăm telefonul.
- [ ] Harta iese din cadru → „Map out of view" → revine fără să piardă progresul.
- [ ] Testat în lumina sălii reale, de la 30–60 cm, cu harta pe masă.
- [ ] Plan B verificat: Magic Mode e la un apel distanță.

## 7b. VR (Quest)

- [ ] Quest și calculatorul pe același Wi‑Fi; `npm run dev:https`; adresa „Network" se deschide în browserul Quest (certificat acceptat).
- [ ] Butonul **Enter VR** apare; la apăsare headsetul intră în sesiune, iar macheta apare în fața ta, pe masă.
- [ ] Etichetele zonelor se citesc și nu se suprapun; raza (trigger) deschide zona indicată.
- [ ] **A** merge la scena următoare, **B** la anterioara, **X** deschide meniul, **Y** oprește sunetul. Exit VR din meniu readuce pagina pe ecran.
- [ ] Scena este un teatru în fața ta: straturile se separă când miști capul; subtitrările și mesajul „Presenter" se citesc fără să acopere imaginea.
- [ ] Fluiditate (≈72 Hz) fără sacadări în hartă, scene și finală. Dacă sacadează: notează unde.
- [ ] Confort după 5 minute (fără amețeală; camera nu se mișcă singură).
- [ ] Scoți headsetul / meniul Quest: aplicația revine pe ecran, cu progresul păstrat.

## 8. Înainte de lansare / campanie

- [ ] Harta finală și mascotele finale puse în `public/assets/illustrations/` și activate în
      `src/content/assets.ts`; pozițiile zonelor re-măsurate.
- [ ] Presupunerile din `docs/technical-notes.md` confirmate (replici, culori, tagline, finală).
- [ ] Dreptul de a folosi logo-ul și fonturile LVM confirmat (nu sunt incluse acum).
