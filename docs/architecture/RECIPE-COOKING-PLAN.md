# Pagina rețetei și Cooking — plan

## Decizii

- Ruta existentă `/recipes/[recipeId]` este păstrată structural, dar parametrul
  reprezintă slugul canonic, validat. URL-urile sunt `/recipes/<slug>`; sursa demo
  rămâne explicită, la fel ca în căutare. Nu se publică drafturile.
- Detaliile includ fotografie/credit/fallback, ingrediente scalate și stoc măsurat,
  porții 1–20, nutriție cu sursă/statut, alergeni, timp, echipament și pași. Similaritatea
  este deterministă după ingrediente comune, fără apă/sare/ulei; respectă restricțiile.
- Imaginea generată pentru terciul cu mere este numai demonstrativă și etichetată.
  Migrația 17 adaugă metadate de fotografie per versiune, fără upload/admin nou.
  Nu se inventează fotografii sau nutriție pentru restul colecției.
- Se reutilizează contextul server autoritativ al căutării: accountId verificat,
  inventar PostgreSQL și restricții din profil. Guest folosește starea locală.
  Cererile și dialogurile vechi se invalidează la schimbarea contextului.
- Primitivele exacte ale matchingului se mută în shared/domain și se reexportă
  din locația veche; display-ul porțiilor și matchingul au aceeași rotunjire conservatoare.
- Cooking folosește un dialog mare, navigare precedent/următor, progres și buton
  de încheiere. Nu deduce cronometre din text: folosește timer_seconds sau o durată
  aleasă de utilizator. Deadline-uri absolute, pause/reset, mai multe cronometre,
  progres în sessionStorage per rețetă/revizie/porții/cont. Nu promite alarmă în fundal.
- Screen Wake Lock este opt-in, numai în context securizat și cu suport detectat.
  Cererea/refuzul/eliberarea sunt afișate corect; release la închidere/unmount/ascundere,
  reacquire la revenire numai cât opțiunea rămâne activă. Fără metode de simulare.
- Favorite și shopping funcționează local pentru guest; pentru cont/publicat se
  folosesc tabelele existente prin RPC atomic, cu owner derivat și operationId.
  Demo autentificat rămâne în memorie, fără a pretinde sincronizare în cont.
- Shopping are preview editabil al deficitului măsurat și confirmare. Cantitățile
  necunoscute sunt semnalate, opționalele nu se adaugă automat. Nu se comasează
  unități incompatibile și nu se modifică lista fără confirmare.
- „Am gătit” cere confirmarea marcării; jurnal separat de inventar. Consumul este
  altă acțiune explicită, prin ConsumptionForm existent (preview + confirmare),
  numai pentru loturile rețetei. Nici start/next/timer/favorite/shopping/cooked nu scad stoc.
- UI păstrează verdele #24563d, fundalul #fbfcfa, textul #202c24 și tokenurile dark;
  Georgia pentru titluri, system sans pentru pași; fotografie sus, ingrediente alături,
  Cooking cu o singură instrucțiune mare și controale de minimum 44px.

## Verificare

- [x] Contracte și teste pentru scalare/conversii/similaritate, modele timer și
      persistență locală/idempotency; testele sunt scrise înainte de implementare.
- [x] Migrația 17: fotografii și jurnal de acțiuni, reuse favorite/shopping RPC,
      privilegii, izolare între conturi, rollback/replay și lipsa efectelor pe stoc.
- [x] API detail/actions, metadate, context comun și integrare cu căutarea.
- [x] UI detaliu, acțiuni, Cooking, wake lock, stări loading/empty/error și focus.
- [ ] Teste de interacțiuni browser și handlere compilate, lint/typecheck/build,
      regresii existente, documentație și revizuire independentă.

Nu se implementează pagini complete Favorite/Shopping List, planner, AI sau admin.
Funcționalitatea cerută se limitează la acțiunile din pagina rețetei.
