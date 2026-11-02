# Cookly — autentificare și profil

Etapa 3, 2 noiembrie 2026. Cererea nouă continuă fundația Supabase/access.
Se finalizează verificările și documentația acesteia, apoi fluxurile Auth/profil.
Fără matching sau alte funcționalități de business din etapa următoare.

## Decizii și limite

- Supabase Auth rămâne autoritatea; native fetch pentru API-ul său, fără SDK nou.
- Sesiune în cookie HttpOnly, SameSite=Lax, Secure în producție, criptat AES-GCM;
  cheie derivată cu separare de domeniu din CSRF_SECRET (minimum 32 bytes aleatorii).
  Tokenurile nu ajung în componente client, URL, localStorage sau loguri.
- Next proxy reînnoiește sesiunea; paginile private verifică și Auth/rolurile DB.
- Linkurile email folosesc token_hash și template-uri locale; confirmarea are
  POST explicit pentru a evita consumarea linkului de către scanerele email.
- Server Actions cu validare Origin și Zod; mesaje sigure și limitarea payloadului.
- Buget: per masă, conform răspunsului utilizatorului, opțional, cu monedă explicită;
  valoarea acoperă toate persoanele din profil.
- Preferințe/alergeri/echipamente sunt relaționale, owner derivat din actor.
- UI în română, preferința de limbă este salvată; traducerea întregii aplicații
  nu face parte din această sarcină.

## Pași

1. Teste pentru criptarea/expirarea cookie-ului, Zod și autorizarea profilului.
2. Migrația 08: buget/persoane, echipamente și RPC atomic pentru profil/preferințe.
3. Servicii server Auth (signup, password grant, logout, recover, verify, update,
   refresh), cookie persistent și protecție de rută; toate folosesc JWT-ul userului.
4. Formulare autentificare/înregistrare/recuperare/confirmare/resetare și profil,
   folosind componentele existente; stări pending/error/success/empty.
5. Template-uri email și TOTP minimal necesar accesului editorial AAL2 deja cerut.
6. Teste unitare/server/SQL; lint/typecheck/build și revizuire independentă.
7. Documentație, rezultate reale și verificări manuale pe stack Supabase pornit.

Nu se creează credențiale sau utilizatori hosted. Aprobarea descărcării PGlite și
un Docker local pornit sunt în continuare dependențe externe pentru verificări DB/live.
