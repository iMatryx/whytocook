# Checklist de lucru

Format: [ ] TODO | [~] în lucru | [x] verificat | [!] blocat | [-] amânat.
Nu bifa un modul complet doar pentru că există UI/schema/testele scrise.
N05/N06/N22/N25/N28 se execută separat pentru fiecare țintă, cu sub-ID-uri.
Sursă: catalogul de audit din 2026-11-06 (până la N01) și cererile N02–N04 din chat.
Titlurile și criteriile lipsă nu sunt deduse din etapele vechi sau inventate.
ID-urile rezervate mai jos nu autorizează implementarea lor.

- [x] N01 — Instalează memoria minimă | Criteriu: 4 fișiere scurte; căi și HEAD
      confirmate; dovezi curente separate de istoric. Dovadă: validarea locală N01.
      Limitare: catalogul nu include titlurile/criteriile N02–N38.
- [x] N02 — Unifică comenzile pe npm | Criteriu: check fără pnpm, README aliniat;
      instalare și rezultat check raportate, inclusiv formatarea preexistentă.
      Dovadă: Node 24.14.0; npm ci offline: exit 0, 407 pachete; lockfile neschimbat.
      npm run check: exit 1, formatare neconformă în 31 fișiere preexistente;
      etapele lint/typecheck/test nu au rulat. Următor pas: N03.
- [~] N03 — Curăță formatarea într-un lot mic | Lotul 2 verificat: 5 primitive UI
  (badge, button, input, skeleton, tag), exclusiv Prettier; verificare selectivă PASS.
  Lotul 1: cele 2 componente feedback formatate. Gate inițial lot 2: 29 fișiere
  neconforme; rămân 24 (calcul din lista inițială).
  Următor pas: lotul 3 de maximum 5 fișiere, într-o sarcină separată.
- [x] N04 — Stabilește baseline-ul real | 2026-11-06, Node 24.14.0/npm 11.9.0.
      npm test 140/140, test:db 57/57, lint/typecheck/build Webpack: exit 0;
      format:check: exit 1, 24 fișiere neconforme. Cod nemodificat; rezultate în STATE.
- [ ] N04-F01 — Rezolvă separat eșecul de formatare, continuând N03.
      Primul fișier investigat: docs/architecture/README.md:17, tabel Markdown nealiniat.
      Criteriu pentru lotul următor: maximum 5 fișiere coerente, numai format,
      Prettier selectiv PASS și număr rămas raportat; fără corecție în N04.
- [!] N05 — titlu/criteriu/ținte nefurnizate.
- [!] N06 — titlu/criteriu/ținte nefurnizate.
- [!] N07 — titlu/criteriu nefurnizate.
- [!] N08 — titlu/criteriu nefurnizate.
- [!] N09 — titlu/criteriu nefurnizate.
- [!] N10 — titlu/criteriu nefurnizate.
- [!] N11 — titlu/criteriu nefurnizate.
- [!] N12 — titlu/criteriu nefurnizate.
- [!] N13 — titlu/criteriu nefurnizate.
- [!] N14 — titlu/criteriu nefurnizate.
- [!] N15 — titlu/criteriu nefurnizate.
- [!] N16 — titlu/criteriu nefurnizate.
- [!] N17 — titlu/criteriu nefurnizate.
- [!] N18 — titlu/criteriu nefurnizate.
- [!] N19 — titlu/criteriu nefurnizate.
- [!] N20 — titlu/criteriu nefurnizate.
- [!] N21 — titlu/criteriu nefurnizate.
- [!] N22 — titlu/criteriu/ținte nefurnizate.
- [!] N23 — titlu/criteriu nefurnizate.
- [!] N24 — titlu/criteriu nefurnizate.
- [!] N25 — titlu/criteriu/ținte nefurnizate.
- [!] N26 — titlu/criteriu nefurnizate.
- [!] N27 — titlu/criteriu nefurnizate.
- [!] N28 — titlu/criteriu/ținte nefurnizate.
- [!] N29 — titlu/criteriu nefurnizate.
- [!] N30 — titlu/criteriu nefurnizate.
- [!] N31 — titlu/criteriu nefurnizate.
- [!] N32 — titlu/criteriu nefurnizate.
- [!] N33 — titlu/criteriu nefurnizate.
- [!] N34 — titlu/criteriu nefurnizate.
- [!] N35 — titlu/criteriu nefurnizate.
- [!] N36 — titlu/criteriu nefurnizate.
- [!] N37 — titlu/criteriu nefurnizate.
- [!] N38 — titlu/criteriu nefurnizate.
