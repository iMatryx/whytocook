# Lista inteligentă — plan de implementare

Scop: etapa cerută, fără planner, feed de prețuri sau partajare publică a contului.
Stackul și componentele existente se păstrează, fără dependențe noi.

## Contract și decizii

- Feature nou `shopping`, dependent doar de contractele publice ingredients/recipes/pantry.
  Compoziția server leagă rețetele/inventarul autoritativ și adaptorul SQL. Wrapperul
  `components/shopping` compune stocările guest existente, fără deep imports între features.
- `ShoppingItem`: id UUID, revision string pozitiv, ingredient PantryIngredient|null,
  label, category, quantity|null, unitCode g/kg/ml/l/piece|null, checked boolean,
  price|null, transferred boolean, uncertain boolean. Price: amount (2 zecimale),
  currency MDL/RON, basisQuantity, basisUnit, observedOn. Numai prețuri introduse;
  peste 30 zile, viitoare sau incompatibile nu intră în subtotalul cunoscut. Nu FX.
- Comenzi: append items (max100), update id/expectedRevision/fields, remove id/revision,
  purchase confirmed:true/lines[{id,expectedRevision,pantryItemId}]/location/expiresOn.
  Transferă doar rânduri bifate, canonice, măsurate, netransferate. Loturi noi;
  cantitatea transferată este cea revizuită în listă. Textul liber nu este ghicit.
- Append agregă identități canonice cu unități compatibile, fără a comasa text liber
  sau necunoscute. Nu unește masă/volum/piece. Stock scăzut o dată după suma cerințelor,
  ignorând expiratul și marcând necunoscutele. Opționalele sunt opt-in.
- API bootstrap GET cu source, preview POST cu selections/inventory/today/account,
  mutate POST cu operationId/expectedAccountId/command. Origin/body limit/no-store.
  Preview nu scrie. SQL snapshot și mutate reutilizează shopping_lists/items; prețuri,
  categorie și transfer adăugate prin migrația 19, RLS existent/forțat și replay privat.
- Guest folosește `cookly-shopping-v1`, importă o singură dată rândurile Cooking din
  cheia veche și păstrează tombstones pentru a nu reapărea după ștergere. Transferul
  pe două chei are jurnal de recuperare și Web Locks comune cu pantry; conflictele
  nu suprascriu alte modificări. Conturile au tranzacție SQL atomică.
- UI `/shopping-list` publică: selector multi-rețetă/porții, preview, categorii, adăugare
  manuală canonică sau text liber, editare, bifare, preț/unitate/dată, subtotaluri separate,
  export text cu preview și transfer confirmat. Verde #24563d, fundal #fbfcfa și tokenuri
  dark existente; titluri Georgia, liste și formulare sans, focus/erori explicite.

## Pași

- [x] Contracte și teste RED→GREEN pentru agregare/scădere unică, porții, conversii,
      necunoscute, expirare, prețuri, monede, stocare/replay și recuperarea transferului.
- [x] Migrația 19 + teste PostgreSQL: două conturi, validări, merge, revizii, rollback,
      retry transfer, compatibilitatea cu Shopping Cooking existent.
- [x] Compoziție, API și bootstrap fără secrete; profilul nu poate fi ocolit la preview.
- [x] UI responsive, confirmări, sharing user-triggered, guest/account separate.
- [x] Handlere compilate, regresii, lint/TS/build Webpack, documentație și review.
- [ ] Execuție browser: scenarii scrise/colectate, server blocat de sandbox (EPERM), permisiune externă în așteptare.

Nu se aplică migrații live, nu se creează commit/deploy, nu se suprascriu schimbările
necomise ale etapelor anterioare. Browserul poate necesita permisiunea portului local.

Decizii verificate în implementare: incertitudinea stocului cere Editare înainte
ca rândul să fie transferabil; un preț nou explicit se aplică întregii cantități
comasate, null păstrează prețul existent. Catalogul guest se revalidează la load și
înainte de transfer. Testele de regresie pentru pierderea prețului și catalogul
învechit au fost observate RED, apoi GREEN. Review-ul independent le-a confirmat
corectate. Limita SQL de 500 este verificată în snapshot în aceeași tranzacție;
nu există commit parțial la depășire. Fișierele necomise preexistente sunt păstrate.
