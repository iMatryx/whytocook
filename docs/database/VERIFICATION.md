# Cookly — verificarea schemei de date

Data: 1 noiembrie 2026. Etapa 3, numai schema bazei de date.

## Rezultate reale

| Comandă / acțiune                                                                                | Rezultat                                                                                                                      |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                                                                       | PASS: 28 teste existente, 0 eșecuri                                                                                           |
| `npm run lint`                                                                                   | PASS, exit 0, fără warnings                                                                                                   |
| `npm run typecheck`                                                                              | PASS, exit 0, tipuri Next generate și tsc fără erori                                                                          |
| `node --check tests/database/schema.test.mjs`                                                    | PASS, sintaxa JavaScript acceptată; nu validează SQL                                                                          |
| `git diff --check`                                                                               | PASS; verifică whitespace-ul modificărilor urmărite, nu execută SQL                                                           |
| `npx --no-install prettier --check` pe README, package.json, planul DB, documentele DB și runner | PASS, exit 0, toate fișierele vizate respectă stilul                                                                          |
| `npm run test:db`                                                                                | FAIL înainte de inițializare: `ERR_MODULE_NOT_FOUND` pentru `@electric-sql/pglite`; nicio migrație nu a fost executată        |
| Instalare PGlite în sandbox                                                                      | FAIL: `ENOTFOUND registry.npmjs.org`                                                                                          |
| Reîncercare instalare cu acces la rețea                                                          | Cerere de aprobare în așteptare; dependența și lockfile-ul nu sunt încă actualizate                                           |
| PostgreSQL local / Docker                                                                        | psql/postgres/initdb/pg_ctl absente; Docker CLI prezent, daemon indisponibil (socket absent)                                  |
| Revizuire independentă a SQL și documentației                                                    | Statică, fără blocaje rămase; corectate regula pentru viitoare grants de funcții și scrierea părintelui pentru conflicte MVCC |

**Nu este confirmat că migrațiile se execută cu succes.** Nu folosim testele UI
sau verificarea sintactică JavaScript ca dovadă pentru validitatea PostgreSQL.
Nu au fost pornite servere, contactate baze Supabase sau folosite credențiale.

## Testele livrate

Runnerul `tests/database/schema.test.mjs` creează exclusiv o bază în memorie;
nu acceptă un URL către o bază existentă. Fixture-ul `bootstrap.sql` simulează
numai rolurile Supabase și cheia `auth.users`, iar `fixtures.sql` conține date
sintetice. Scenariile acoperă:

- FORCE RLS, absența politicilor și granturilor client; refuzul citirii după un
  grant accidental de SELECT unui rol fără BYPASSRLS;
- loturi multiple, NULL față de zero, valori negative/NaN/Infinity și unități;
- aliasuri, FK între proprietari diferiți, publicare și conținut publicat;
- pointeri de versiuni, intervale de plan, porții și retragerea rețetelor;
- unicitatea listei active și a grupurilor generate, inclusiv unitate NULL;
- revizii, nutriție necunoscută, idempotenta AI și consistența status/cost;
- RESTRICT pentru catalog, ștergerea drafturilor, cascada contului și păstrarea
  rețetelor/auditului cu actor nul.

Pentru deblocare, aprobă cererea de instalare afișată sau execută local:

```sh
npm install --save-dev --save-exact @electric-sql/pglite
npm run test:db
```

Dependența este justificată numai pentru executarea PostgreSQL în teste, fără
daemon sau port. Instalarea trebuie să actualizeze împreună `package.json` și
`package-lock.json`; nu am inventat manual o versiune, integritate sau un lockfile.
Testul DB este script separat și nu este inclus în rezultatul celor 28 teste.

## De verificat manual pe Supabase de dezvoltare

1. Aplică toate patru migrațiile atomic pe un proiect nou; verifică versiunea PG,
   FK, indexuri, triggeri, RLS forțat și lipsa politicilor/granturilor permisive.
2. Confirmă că `app_private` nu este expusă în Data API și că `api` nu oferă încă
   acces. Provisionarea Auth nu este implementată; nu testa signup ca funcționalitate.
3. Verifică în sesiuni concurente publicare/editare și mutarea planului/adăugarea
   unei mese, cu READ COMMITTED și REPEATABLE READ, inclusiv retry la 40001/40P01.
4. Verifică ștergerea unui cont cu date reprezentative, păstrarea catalogului și
   regulile de retenție. Storage, backupurile și furnizorii externi cer procese separate.
5. Randează ERD-urile în viewerul Mermaid; revizuiește unitățile, limitele porțiilor,
   sursele/licențele, politica de nutriție/preț și retenția audit/AI înainte de API.

## Protejarea lucrului existent

Comparația SHA-256 cu snapshotul de la începutul acestei sarcini arată modificări
numai în `README.md` și `package.json` dintre fișierele deja existente. Codul
shell-ului și UI kitului, inclusiv modificările necomise, a fost păstrat.
Nu s-a făcut commit, deploy, reset de DB sau implementare din etapa următoare.
