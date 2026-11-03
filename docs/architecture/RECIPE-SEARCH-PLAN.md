# Căutare și filtre rețete

## Decizii

Pagina /recipes folosește UI kitul/tokenurile existente: verde #24563d, fundal
#fbfcfa, text #202c24, panouri #ffffff și contur #d5ded6; variantele dark rămân
semantice. Titluri Georgia și text system sans. Formular lateral pe desktop,
pliabil pe mobil, rezultate cu ingrediente și compatibilitate în prim-plan.
Fără imagini fictive, favorite neimplementate sau modificarea UI kitului.

Filtre validate Zod și serializare canonică în URL: q, ingredient, minutes,
difficulty, meal, cuisine, budget/currency, calories, protein, diet, equipment,
exclude, allergy, compatibility, servings, sort, page/size, source. Listele sunt
repetate în URL; AND între grupe, OR pentru masă/dificultate/bucătărie, AND pentru
ingredientele cerute/diete. Echipamentul selectat reprezintă ce este disponibil:
toate echipamentele cerute de rețetă trebuie acoperite. Reset șterge filtrele și
revine la pagina 1 în sursa aleasă. Back/forward și linkurile directe refac starea.

Catalog implicit: numai versiuni curente publicate prin RPC PostgreSQL nou, cu
snapshot restrâns la câmpurile necesare. Drafturile nu sunt expuse. Source=demo
este alegere explicită și folosește JSON-urile existente, cu etichetare persistentă.
Bugetul/nutriția sunt nullable și se folosesc numeric numai cu statut verificat.
Nu există FX, estimări inventate sau includere implicită a valorilor necunoscute
în filtre numerice. Prețurile se compară numai în moneda selectată.

POST /api/v1/recipes/search păstrează inventarul în body și răspunsurile private
no-store. Invitat: snapshot local validat. Cont: inventar citit pe server și
expectedAccountId verificat; serverul unește alergiile și ingredientele excluse
din profil cu filtrele explicite. Nicio informație privată în search params.
Abort și verificarea contextului/numărului cererii previn răspunsurile întârziate.

Composition root leagă recipes, matching și pantry; modulele nu importă internale
reciproc. Filtrele ieftine se aplică înaintea matchingului; matching și sortarea
globală preced pagination. Un snapshot public bounded (maximum 1000 rețete) se
încarcă într-un singur RPC, fără cereri pe fiecare card/ingredient. Depășirea
capacității este eroare explicită, fără trunchiere ascunsă. Nu se cache-uiește
inventar sau rezultate personale. Profilul și inventarul se citesc atomic în
context SQL separat. Nu se introduc dependențe.

## Livrare

- [x] Teste query codec, filtre combinate, null/monedă, score-before-pagination,
      sinonime, date invalide și stări goale.
- [x] Contracte recipes, index de căutare și serviciu cu port pentru matching.
- [x] Migrația 16: snapshot public, context privat, privilegii și teste PGlite.
- [x] Adaptoare server, demo explicit și rută HTTP cu limite de body/response.
- [x] Formular URL, inventar guest/cont, rezultate responsive, explicații,
      detalii în dialog, loading/error/empty, reset și paginare accesibilă.
- [x] Teste browser definite/colectate pentru URL/back/reset/paginare/inventar și erori.
      Lint, typecheck, teste, build și documentație.
- [ ] Execuție Chromium și QA vizuală: blocată de listen EPERM, rerulare extinsă solicitată.

Nu se implementează favorite, shopping list, gătire, AI sau altă etapă.
