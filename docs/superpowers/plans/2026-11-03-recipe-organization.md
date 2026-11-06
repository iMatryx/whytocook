# Favorite, colecții și istoric — plan de implementare

Scop: etapa 5 cerută de utilizator, fără alte module sau dependențe.
Arhitectură: extindem feature-ul recipes; reutilizăm favoritele și acțiunile Cooking. Pagina /favorites este disponibilă invitaților. API privat cu sesiune verificată, origin check și expectedAccountId la mutații; RPC SECURITY DEFINER cu RLS forțat și owner derivat din JWT.

- [x] Teste pentru compatibilitatea stocării v1, duplicate, conflicte și ștergerea selectivă a istoricului.
- [x] Contract Zod pentru colecții și comenzi, extensie aditivă a stocării locale existente.
- [x] Migrare: colecții, membri, istoric separat; backfill și trigger pentru Cooking; RPC list/mutate și teste PostgreSQL pentru izolare și idempotency.
- [x] Compoziție server, API și interfață responsive cu loading/empty/error, confirmare ștergere istoric și revalidare focus/storage.
- [x] Teste browser scrise și colectate; documentație, format pe fișierele etapei, lint, typecheck, unit/database, build Webpack și handleri compilați.
- [ ] Execuție browser: serverul local este blocat de sandbox (EPERM), cerere de permisiune externă în așteptare.

Decizii: colecțiile sunt independente de favorite; eliminarea unui favorit nu șterge colecțiile. Istoricul conține preparări, nu vizualizări. Invitații păstrează ultimele 100 preparări, conform mecanismului existent. Nu importăm automat date de invitat în cont. Nu modificăm fișierele Cooking care au schimbări locale decât dacă integrarea o cere.

Riscuri de verificat: sesiune schimbată, JSON local invalid/plin, nume duplicate după normalizare, acces la colecțiile altui cont, retry Cooking după ștergerea istoricului.

Actualizare 2026-11-04: s-a continuat implementarea necomisă existentă, fără a o
rescrie și fără a crea worktree/commit pentru a nu separa schimbările locale deja
integrate cu Cooking. Corecții verificate RED→GREEN: redenumirea nu recreează
colecțiile șterse, numele NFC și spațiile Unicode nu permit duplicate. Comanda
`saveCollection` are `create` explicit pentru creare; implicit redenumește și cere
existența colecției. Confirmările sunt invalidate la refresh/schimbarea contului.
Review independent: problema redenumirii a fost corectată; niciun blocaj de cod
rămas identificat în review. Rezultatele reale: `docs/recipes/ORGANIZATION-VERIFICATION.md`.
