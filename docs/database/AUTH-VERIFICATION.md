# Cookly — verificarea Auth, profil și acces

2 noiembrie 2026. Raport pentru sarcinile Supabase/access și autentificare/profil.
Nu reprezintă validare de producție sau aplicarea migrațiilor pe un proiect conectat.

## Rezultate reale

| Comandă                           | Rezultat                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                        | PASS: 28 teste existente + 21 de securitate/Auth = 49, zero eșecuri                                                                         |
| `npm run test:security`           | PASS: 21; Auth și Data API sunt stub-uri HTTP la limita externă                                                                             |
| `npm run lint`                    | PASS, exit 0                                                                                                                                |
| `npm run typecheck`               | PASS, exit 0; Next typegen și TypeScript strict                                                                                             |
| `npm run build -- --webpack`      | PASS, build de producție; rutele și proxy-ul sunt compilate fără credențiale                                                                |
| `npm run test:prerender`          | PASS: nouă rute private/contextuale sunt dinamice și nu au HTML static; manifestele conțin rutele publice                                   |
| `npm run test:access-routes`      | PASS: un smoke în proces pe handlerii compilați; Bearer/cookie criptat, cookie invalid, rol/MFA, erori și no-store                          |
| `npm run test:e2e -- --list`      | PASS: 26 de cazuri colectate, **nu executate**                                                                                              |
| `npm run test:e2e -- --workers=1` | FAIL înaintea browserului: serverul nu poate asculta pe 127.0.0.1:3100, `listen EPERM`; reîncercarea cu aprobare este în așteptare          |
| `npm run test:db`                 | FAIL înaintea inițializării: ambele module raportează `ERR_MODULE_NOT_FOUND` pentru PGlite; nicio migrație sau politică nu a fost executată |
| Instalare PGlite                  | Prima încercare: `ENOTFOUND registry.npmjs.org`; reîncercarea cu acces de rețea este în așteptarea aprobării                                |
| PostgreSQL/Supabase local         | CLI și binarele PostgreSQL lipsesc; Docker CLI există, daemonul nu are socket activ                                                         |

Formatarea fișierelor schimbate și verificarea whitespace sunt rulate separat;
nu validează sintaxa SQL sau compatibilitatea configurației CLI. Încercarea de
parsare TOML cu Python a fost indisponibilă (`tomllib` lipsește); configurația
Supabase necesită încă validare cu CLI-ul real.

**Nu sunt confirmate prin execuție SQL migrațiile 01–08, RLS, provisioningul sau
Storage. Nu sunt confirmate live signup, SMTP, MFA sau refresh-ul Supabase.**
Buildul și testele cu provider HTTP de test nu substituie aceste verificări.

## Ce acoperă testele livrate

- Auth verificat + roluri DB live; metadata `role=admin`, subiect diferit și roluri
  necunoscute sunt respinse. Secret key nu poate substitui cheia publishable.
- Refuz anon/rol/MFA, resource ownership, no-store, răspunsuri 204 pentru RPC void,
  erori HTTP/rețea, redirecturi externe și payloaduri excesive.
- Criptare/autenticitate/expirare/origin binding a cookie-ului, redirecturi locale,
  atribute Secure la ștergerea cookie-ului __Host și Origin pentru mutații.
- Password grant/refresh, identificarea aceleiași persoane, mesaje nediferențiate,
  recovery marker, logout după expirare, restart MFA neverificat și păstrarea
  deadline-ului de recuperare după challenge.
- Zod pentru parole, confirmare, persoane, buget **per masă**, monedă și fus orar.
- SQL: 14 scenarii pentru snapshotul 01–04 și 15 pentru schema curentă 01–08:
  anon/A/B/editor/admin/disabled, direct writes, rol fals, revizii, draft/publicare,
  ownership compus, Storage metadata și profil atomic/izolat. Sunt scrise, nerulate.
- Browser: rute private, catalog public, formulare, recovery context și eroare
  accesibilă pentru parole diferite, plus testele UI/shell păstrate și adaptate.

## Revizuire independentă

Au fost revizuite static politicile, granturile, ownership-ul funcțiilor, Storage,
adaptoarele și fluxurile Auth/profil. Problemele găsite au fost corectate:
proiecție editorială cu revizie pentru publicare, protejarea contribuțiilor la
shopping, succes HTTP 204, recuperare cu MFA, refresh înaintea logout-ului,
reluarea MFA abandonat și Secure la ștergerea cookie-ului de producție.
Reviewerul nu mai raportează blocaje în aceste constatări; nu a executat SQL/live.

## Deblocarea verificărilor

Pentru testele SQL în memorie trebuie aprobată instalarea afișată sau rulată local:

```sh
npm install --save-dev --save-exact @electric-sql/pglite
npm run test:db
```

Instalarea trebuie să actualizeze manifestul și lockfile-ul împreună. Nu s-a
inventat o versiune sau un lockfile; runtime-ul nu are dependențe noi. Runnerul
PGlite nu acceptă URL de DB și nu poate șterge datele unui proiect hosted.

Pentru browser trebuie permisă pornirea serverului local și instalat Chromiumul
cerut de versiunea Playwright. Pentru integrarea completă trebuie pornit Docker,
instalat CLI și configurat stackul conform [AUTH-PROFILE.md](AUTH-PROFILE.md).

## De verificat manual

1. Migrații complete pe un stack local nou, grants, RLS forțat pe toate cele 37
   de tabele și numai `api` în Exposed Schemas. Verifică și Security Advisor.
2. Signup → email local → confirmare → login, browser redeschis, refresh, logout;
   parolă uitată și link expirat/utilizat, inclusiv cont cu TOTP/AAL2.
3. Profil A/B, payload cu owner/role fals și FK străin; salvare/rollback, buget
   per masă, monedă, dietă, alergeni, echipamente și persoane.
4. Concurență între taburi pentru refresh și scrieri DB; revocare de rol/status;
   retry pentru serializare/deadlock, fără pierderea datelor personale.
5. Tastatură, screen reader, focus, mobil și light/dark; fără erori de hidratare.
6. Storage real: MIME/size/path, owner A/B, export privat și expirarea URL-ului.
   Fixture-ul SQL de metadate nu validează octeții unui fișier.

Păstrate: modificările existente ale shell-ului/UI kitului care nu erau necesare
acestei sarcini. Nu s-au creat conturi reale, copiat secrete, făcut reset/deploy
sau commit. Lista exactă este în [ACCESS-AUTH-FILES.md](ACCESS-AUTH-FILES.md).
