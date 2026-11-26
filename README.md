# Tērvete Awakens — Five Senses Trail

Prototip web pentru o demonstrație **AR Experience Preview** de pitch: arată cum vor arăta și funcționa
cele cinci atracții fizice din parcul natural Tērvete înainte să fie construite. AR-ul **nu înlocuiește**
experiența din parc și nu este jocul vizitatorului: este o prezentare navigabilă.

Cele cinci zone și gardieni (din brief): **Skats** (Sight · Hornet Garden), **Austiņa** (Hearing · Fairy
Tale Forest), **Odziņa** (Taste · Gnome Forest), **Deguntiņš** (Smell · Green Classroom–Forest Trail
Connector), **Plaukstiņa** (Touch · Old Pine Park) și finala **Tree of Five Senses**.

> Stare: tehnic complet și demonstrabil. Harta este, provizoriu, posterul oficial al parcului, în relief
> 3D; fiecare atracție este o scenă cinematică pe straturi (backdrop foto, mascotă ilustrată, recuzită,
> familie, AR ca extensie magică). Ilustrațiile de recuzită și decor sunt provizorii și se înlocuiesc fără
> modificări de cod (vezi `public/assets/illustrations/README.md`). Harta e doar poarta de intrare și
> ecranul de progres.

## Rulare

Cerințe: Node ≥ 20.19 (testat pe 22) și npm.

```bash
npm install
npm run dev
```

Deschide adresa afișată (în mod normal `http://localhost:5173`).

| Comandă | Ce face |
|---|---|
| `npm run dev` | server de dezvoltare (accesibil în rețea) |
| `npm run dev:https` | la fel, cu HTTPS autosemnat, necesar pentru cameră pe telefon |
| `npm run build` | build de producție în `dist/` |
| `npm run preview` | servește `dist/` |
| `npm run typecheck` · `npm run lint` · `npm test` | verificări |

## VR (Meta Quest)

Aplicația rulează și într-un headset, cu WebXR, direct din browserul Quest. Nu se instalează nimic pe
headset și nu se conectează nimic la mine: calculatorul tău servește pagina, iar Quest o deschide.

1. Calculatorul și Quest pe **același Wi‑Fi** (Bluetooth nu contează).
2. Pe calculator: `npm install`, apoi `npm run dev:https`. Notează adresa „Network", de forma
   `https://192.168.x.x:5173/`. Dacă Windows întreabă despre firewall, permite accesul.
3. În **browserul Quest**, deschide adresa. Apare un avertisment de certificat (autosemnat): *Advanced*,
   apoi *Proceed*. Pagina cere HTTPS, altfel butonul VR nu apare.
4. Apasă **Enter VR**.

Controale (Touch): **trigger** alege ce indică raza (o zonă de pe hartă sau un buton) · **A** următoarea
scenă · **B** anterioara · **X** meniu de prezentator (inclusiv Exit VR și Restart) · **Y** sunet.
Imaginea se poate oglindi pe un ecran cu funcția *Cast* din Quest, pentru public.

În VR harta devine o machetă pe o masă, iar fiecare atracție devine un teatru în adâncime în fața ta.
Recuzita fizică nu se vede în VR (headsetul acoperă ochii; Quest 1 nu are cameră în browser), deci mesajul
„Presenter" se citește în headset, iar recuzita se ridică înainte sau după.

## Moduri

- **Magic Mode**: funcționează complet fără cameră și fără marker. Este modul sigur pentru pitch.
- **VR mode** (`Enter VR`): apare doar dacă browserul poate porni o sesiune de headset. Înlocuiește butonul AR.
- **AR mode** (`Start AR`): încearcă recunoașterea hărții A3 tipărite cu MindAR. Dacă nu merge (cameră
  refuzată, dispozitiv nesuportat, marker lipsă, hartă nerecunoscută), aplicația continuă singură în
  Magic Mode, cu un mesaj. Camera nu blochează niciodată aplicația.
- `?ar=mock` simulează scanarea fără cameră (repetiții și teste).

Pentru AR cu harta reală trebuie compilat markerul din harta finală:
`public/assets/markers/README.md`.

## Testare pe mobil

1. Calculatorul și telefonul în aceeași rețea.
2. `npm run dev:https`, apoi deschide pe telefon adresa `https://<IP-ul-calculatorului>:5173`
   și acceptă avertismentul de certificat autosemnat. (Camera cere HTTPS.)
   Alternativ, pe Android: `adb reverse tcp:5173 tcp:5173` și deschide `http://localhost:5173`.
3. Încearcă **Magic Mode** în portret și în peisaj, apoi **Start AR** cu harta tipărită.
4. Parcurge `docs/test-checklist.md`, secțiunile 6 și 7.

## Prezentare (6–7 minute)

1. Deschide aplicația pe dispozitivul de prezentare; apasă o dată oriunde (permite sunetul).
2. Spune că este un preview al atracțiilor fizice, apoi alege **Magic Mode** sau **Start AR**.
3. Atinge pe rând cele cinci zone; în fiecare scenă, când apare mesajul galben „Presenter",
   ridică recuzita fizică. Zona se luminează la întoarcerea pe hartă.
4. După a cincea apare **Awaken the Tree of Five Senses**.

Controale de prezentator (mânerul `⋯` sus-dreapta sau `P`): `←`/`→` scene, `M` sunet, listă de scene,
Magic Mode, Restart (cu confirmare). Ghid complet, cu timpi și plan B: `docs/pitch-flow.md`.

## Documentație

- `docs/pitch-flow.md`: desfășurarea demonstrației, recuzita, controale, plan B
- `docs/technical-notes.md`: arhitectură, stare deterministă, AR, asset-uri, performanță, accesibilitate,
  **lista presupunerilor de confirmat**
- `docs/test-checklist.md`: verificări manuale și automate

## Brand

Culori și ton din brandul LVM / Tērvete (`atputa.lvm.lv`) și ilustrațiile mascotei din Figma. Logo-ul LVM
și fontul Franklin Gothic nu sunt incluse (licențe); interfața folosește un set de fonturi de sistem
similar. Nicio imagine din brand nu este copiată în repo.
