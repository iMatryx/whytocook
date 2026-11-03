# Motorul de potrivire — verificare

3 noiembrie 2026, Node.js v24.14.0. Comenzile de mai jos au fost executate în
workspace. Nu au fost folosite secrete, apeluri AI, servicii externe sau un proiect
Supabase real. Nu au fost aplicate migrații și nu s-a făcut deploy.

## Rezultate reale

| Comandă                      | Rezultat                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run test:matching`      | PASS: 17 teste, zero eșecuri                                                                          |
| `npm test`                   | PASS: 96 teste — 28 fundație/UI/shell, 21 securitate, 8 ingrediente, 9 pantry, 13 rețete, 17 matching |
| `npm run test:db`            | PASS: 51 teste PGlite, inclusiv părinții și verificarea normalizării SQL/JS                           |
| `npm run recipes:check`      | PASS: 72 demonstrative, zero verificate, SQL și raport reproductibile                                 |
| `npm run lint`               | PASS, fără avertizări                                                                                 |
| `npm run typecheck`          | PASS, Next typegen și TypeScript strict                                                               |
| `npm run build -- --webpack` | PASS, build de producție                                                                              |
| Prettier pe fișierele etapei | PASS                                                                                                  |
| `git diff --check`           | PASS                                                                                                  |

Verificarea Prettier a fost executată cu:

```sh
npx --no-install prettier --check src/features/matching src/shared/domain/ingredient-search-key.ts src/features/ingredients/domain/search-key.ts tests/matching scripts/matching docs/matching docs/architecture/MATCHING-PLAN.md package.json README.md
```

`npm run format:check` rămâne eșuat pe fișiere preexistente din afara etapei.
Nu au fost reformatare în masă UI kitul, Auth sau alte module pentru a ascunde
această limită. Build-ul raportat folosește explicit Webpack; nu se pretinde o
verificare Turbopack sau browser E2E pentru acest serviciu fără UI.

## Demonstrație

`node scripts/matching/demo.ts` a evaluat colecția existentă de 72 rețete, pentru
inventarul exemplu de 13 loturi și ziua explicită 2026-11-03:

| Grup                            | Rețete |
| ------------------------------- | -----: |
| ready_to_cook                   |      5 |
| almost_ready                    |      8 |
| missing_ingredients             |     59 |
| Excluse, fără alergii declarate |      0 |

Prima rețetă ready în ordinea scorului a fost `branza-cu-iaurt-si-mar`.
`--allergy milk` a fost executat și în testul CLI: exit 0, rezultat `empty`,
72 excluse, deoarece colecția are alergeni neverificați. `--servings 0` a produs
exit 1 și `INVALID_REQUEST`. Acestea nu sunt datele unui utilizator.

## Performanță observată

Comandă: `npm run matching:benchmark` (50 iterații după încălzire).

| Rețete | Loturi | Compilare | Mediană match | p95 match |
| -----: | -----: | --------: | ------------: | --------: |
|     72 |    500 |  3,098 ms |      1,058 ms |  1,945 ms |
|   1000 |    500 | 12,726 ms |      4,665 ms |  6,589 ms |

Sunt măsurători locale, nu un SLA sau test de încărcare pe server. Se includ
validarea cererii, agregarea, calculele, diagnosticele, scorul și sortarea; se
exclud citirea fișierelor și serializarea JSON. Setul de 1000 rețete este construit
din copii explicite ale rețetelor reale, fără a modifica seed-ul. Nu există praguri
de milisecunde care să facă testele instabile pe alte calculatoare.

## Acoperire și probleme rezolvate

Testele exercită codul real, fără mockuri ale motorului: aliasuri RO/RU/EN,
agregare g/kg și ml/l, dimensiuni incompatibile, lipsuri/insuficiență, opționale,
zero și null, expirări, scalarea porțiilor, bucăți întregi și sub-micro-unități,
cantități agregate mari, filtre de alergii inclusiv urme și opționale, metadate
neverificate, explicațiile scorului, ranking determinist, configurații ambigue,
date invalide și izolarea stării compilate. Adaptoarele și CLI-ul sunt testate
cu cele 72 de rețete reale din workspace.

Testele inițiale au întâlnit modulele încă inexistente înainte de implementare;
după implementare au trecut. Typecheck-ul a găsit apoi o inferență `never[]` în
fixture-ul de alias ambiguu; fixture-ul a fost corectat, fără relaxarea tipurilor.

Revizuirea independentă nu a găsit blocaje clare în aritmetică, clasificare,
alergii sau izolarea stării. A indicat un contract latent: proiecția din RecipeSeed
pierdea `state`, astfel încât gramajul declarat `cooked` putea fi interpretat ca
stoc crud al aceluiași slug. A fost adăugat un test care a eșuat cu „Missing
expected exception”; adaptorul respinge acum acea proiecție prin
`UNSUPPORTED_COOKED_QUANTITY`, iar testul și suita completă trec. Alimentele
preparate au nevoie de identități canonice distincte; nu se inventează randamente.

## Limitări și verificare manuală

- Motorul este livrat ca serviciu pur, adaptoare și CLI. Nu există încă endpoint
  sau ecran de matching și nu a fost verificată o integrare live Supabase.
- Catalogul și statutul alergenilor trebuie să provină din snapshoturi autorizate
  și revizuite. Testele verifică aplicarea filtrului, nu adevărul etichetelor.
- Pragul almost-ready și ponderile scorului sunt alegeri de produs explicite.
  Verifică manual dacă ordinea și etichetele corespund așteptărilor utilizatorilor.
- Verifică exemplele cu 1 ou pentru 3 porții și stoc necunoscut: rotunjirea este
  conservatoare, iar deficitul este numai față de cantitatea măsurată.
- Nu există conversii masă/volum, greutăți medii pe bucată, fuzzy matching,
  substituții sau crud→gătit. Verifică separat identitățile preparate din catalog.
- Invocarea nu rezervă/scade stoc. Integrarea ulterioară trebuie să păstreze
  confirmarea explicită a consumului din My Fridge.

Ghid: [MATCHING.md](MATCHING.md). Fișiere: [FILES.md](FILES.md).
Nu a fost începută etapa următoare.
