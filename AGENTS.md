# Cookly — reguli pentru agent

La început citește .ai/STATE.md; caută modulul în .ai/MAP.md.
Lucrează numai la ID-ul cerut din .ai/TASKS.md.
Citește secțiuni și importuri relevante; fără audit integral implicit.
Stack curent: Next App Router, React, TypeScript, Tailwind, Zod, Supabase.
Node 24.x >=24.14.0; npm + package-lock.json. Scriptul check folosește npm run.
Respectă tooling/eslint/import-boundaries.mjs și contractele publice.
DB: app_private + api; migrații noi incrementale, fără rescrierea celor aplicate.
Nu folosi secrete în client/loguri; nu citi .env reale pentru context.
Nu amesteca guest și cont; nu importa automat localStorage în cont.
Inventarul contului și restricțiile se citesc autoritativ pe server.
Păstrează confirmările, reviziile și replay/idempotency.
Nu fabrica prețuri/nutriție/alergeni/verificări sau rezultate de teste.
Nu promova date demo ca verificate/publicate.
Nu citi implicit lockfile, seed complet, SQL generat, .next sau rapoarte mari.
Extinde contextul când e necesar corectitudinii și spune scurt de ce.
O funcție per sarcină; fără refactor/migrare de stack oportunistă.
Testează schimbarea și raportează comanda/rezultatul; --list nu înseamnă PASS.
La blocaj de mediu raportează cauza; nu repeta comanda fără schimbare.
La final actualizează STATE/TASKS compact, fără istoric conversațional.
Fără commit/push/deploy/migrare live dacă nu sunt cerute separat.
