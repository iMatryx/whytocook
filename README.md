# Cookly

Cookly este o aplicație web proiectată pentru a recomanda rețete pornind de la ingredientele disponibile, cu cantități, ingrediente lipsă, pași, timp, cost estimat și nutriție.

Proiectul este în **Etapa 1 — arhitectură și planificare**. Repository-ul conține documentație, convenții și un model de configurare; nu există încă o aplicație executabilă, `package.json`, bază de date creată sau teste de aplicație. Nu există în această etapă comenzi `dev`, `build` sau `test` disponibile.

Stack stabilit: Next.js App Router, React, TypeScript strict, Tailwind CSS, shadcn/ui, Zod, PostgreSQL și Supabase Auth/Storage. Arhitectura este modular monolith.

## Documentație

| Document | Rol |
|---|---|
| [PRD](docs/product/PRD-Cookly.md) | Produs, personas, MVP/V2/V3, cerințe, acceptare și metrici |
| [README de arhitectură](docs/architecture/README.md) | Punct de intrare pentru echipă și regulile principale |
| [Arhitectura completă](docs/architecture/ARCHITECTURE-Cookly.md) | C4, fluxuri, API, RLS, tranzacții, caching și scalare |
| [Structura proiectului și convenții](docs/architecture/PROJECT-STRUCTURE.md) | Arborele țintă, features, TypeScript, contracte, importuri, configurare și teste |
| [Model variabile de mediu](.env.example) | Nume și valori neconfidențiale; cheile reale rămân necompletate |

## Reguli de lucru

- Citește structura și documentele existente înaintea unei schimbări. Nu înlocui funcționalități care lucrează.
- Respectă granițele `features`, separarea browser/server și autorizarea la fiecare intrare relevantă.
- Validează inputul la runtime; păstrează tipuri stricte și datele necunoscute ca stări explicite.
- Nu adăuga secrete, date personale reale sau dependențe fără justificare.
- Raportează doar verificările executate și rezultatele lor reale.
- Lucrează la etapa cerută. Inițializarea aplicației și implementarea necesită o cerere separată.

## Configurare și verificare în această etapă

`.env.example` este un contract de configurare pentru inițializarea viitoare, nu un setup funcțional. Nu completa chei în fișierul versionat. `.gitignore` exclude fișierele de mediu reale și artefactele generate; nu înlocuiește verificarea conținutului înainte de commit.

Verificări documentare care pot fi rulate acum, din rădăcina proiectului:

```sh
rg --files --hidden -g '!.git'
wc -l docs/architecture/PROJECT-STRUCTURE.md docs/architecture/README.md
git check-ignore --no-index .env.local .env.production.local
```

Ultima comandă verifică reguli de ignorare numai după ce proiectul este într-un repository Git. În lipsa unui repository, regulile pot fi verificate fără inițializarea proiectului într-un repository temporar, așa cum este descris în convenții. Inventarul de fișiere nu demonstrează corectitudinea unei aplicații.
# whytocook
