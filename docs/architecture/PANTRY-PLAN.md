# My Fridge — plan de implementare

Folosesc skill-urile brainstorming și writing-plans pentru a fixa deciziile în
arhitectura existentă, apoi execut planul în workspace-ul IDE. Cererea curentă
autorizează implementarea; nu se creează worktree, commit sau funcții din etapa următoare.

## Descriere și decizii

`/my-fridge` devine public: invitatul păstrează un inventar separat în localStorage,
iar contul verificat citește/scrie numai în PostgreSQL prin RPC-uri RLS. Datele din
cont nu sunt copiate în localStorage și inventarul local nu este importat automat.
Loturile nu se combină: două ingrediente identice pot expira în zile diferite.

Se pot adăuga, edita și șterge loturi cu ingredient explicit selectat din catalog,
cantitate cunoscută sau necunoscută, unitate, dată calendaristică și cămară/frigider/
congelator. Căutare, categorii, depozitare, expirare și sortare sunt locale pe
snapshotul încărcat, maximum 500 de loturi. UI reutilizează tema, typography,
controalele și dialogurile existente; lista pune expirarea și cantitatea lângă
numele ingredientului, cu acțiuni etichetate și layout mobil fără overflow.

Cantitățile sunt șiruri zecimale cu maximum 6 zecimale, calculate exact prin BigInt
și numeric SQL. Conversiile permise: g↔kg, ml↔l și aceeași unitate; bucățile sunt
întregi. Fără densități, grame/bucată, conversii masă/volum sau substituții.
Zero este distinct de necunoscut. Conversiile care necesită rotunjire sunt respinse.

Expirarea este o dată, nu un timestamp; avertizările folosesc ziua browserului:
trecută, astăzi, în următoarele 3 zile, ulterioară sau necunoscută. Nu se fac
afirmații despre siguranța consumului. Se afișează data introdusă și se poate filtra.

„Am gătit” permite introducerea cantităților consumate pe loturi, apoi arată un
preview fără scriere. Numai confirmarea trimite comanda; anularea nu schimbă nimic.
Nu se deduc automat rețete sau porții. Verificarea reviziilor previne suprascrierea,
iar operationId idempotent previne dublarea unei cereri reluate. Consumul este atomic,
fără cantități negative sau scădere dintr-o cantitate necunoscută.

## Pași

- [x] Teste RED pentru zecimale/conversii, expirare, reducer local și confirmare/idempotency.
      Fișiere: `tests/pantry/model.test.ts`, `src/shared/domain/quantity.ts`,
      `src/shared/domain/expiry.ts`, `src/features/pantry/contracts/*`,
      `src/features/pantry/presentation/pantry-model.ts`, `guest-storage.ts`.
- [x] Migrație nouă 12: snapshot propriu, comenzi restrânse, validări de unități,
      revizii, limite, idempotency și politici RLS pentru journal. Migrațiile 01–11 rămân intacte.
      Teste: `tests/database/pantry.test.mjs`, cu doi utilizatori, anon, conflict,
      rollback atomic, retry și confirmare obligatorie.
- [x] Repository/transport server-only și composition root; GET/POST `/api/v1/pantry`,
      actor verificat, no-store, Origin strict, corp JSON limitat și erori sigure.
      Teste compilate: `tests/pantry/routes.smoke.mjs`.
- [x] Interfață My Fridge: hook stare, form edit/add cu autocomplete, filtre, lista
      loturilor, ștergere confirmată și dialog consum/preview/confirmare. Stări loading,
      empty, filtered-empty, error/retry și avertizări de stocare. Modificare route publică
      și a testului Auth care cerea anterior redirect pentru această rută.
- [x] Teste Playwright guest persistence/CRUD/filtre/confirmare, verificări Node/SQL,
      lint/typecheck/build, revizuire independentă și documentație cu rezultate reale.
- [ ] Execuție Chromium și verificare Supabase live: blocate/neexecutate în acest mediu,
      rămân pașii manuali din raport; colectarea testelor nu este prezentată ca execuție.

## Riscuri urmărite de teste

- Retry după răspuns pierdut: aceeași operație nu scade și nu adaugă de două ori.
- Al doilea utilizator și actor dezactivat: nicio citire/mutație peste conturi.
- Două editări concurente: revizia veche este refuzată, preview-ul nu e acceptat pe date noi.
- Date locale corupte sau localStorage indisponibil: eroare explicită, fără ștergere implicită.
- Cantități foarte mici, comasare de loturi, unități incompatibile și date calendaristice invalide.

## Verificare și integritate

PGlite 0.5.14 este deja instalat de utilizator; modificările sale în package.json și
package-lock.json sunt păstrate. Nu se adaugă altă dependență. Baseline: testele SQL
de acces și catalog trec, dar testul istoric de DELETE RESTRICT așteaptă alt SQLSTATE.
Această diferență se investighează și se raportează separat; nu se modifică schema
istorică pentru a satisface un cod de eroare presupus. Chromium/server pot necesita
execuție în terminalul utilizatorului dacă sandboxul continuă să blocheze porturile.

## Rezultat

66 teste Node și 41 SQL trecute, build Webpack/lint/typecheck și smoke compilat
trecute. Cele șase teste Playwright sunt colectate, dar nu au rulat în browser.
Revizuirea a identificat contextul stale după schimbarea contului: corectat cu
expectedAccountId, context capturat al dialogului, revalidare la focus și guard
pentru răspunsuri întârziate. Testul de service și smoke-ul API au trecut după fix.
Unitatea loturilor retrase este păstrată; două teste de regresie au trecut după
fix. Raport complet: [VERIFICATION.md](../pantry/VERIFICATION.md).
