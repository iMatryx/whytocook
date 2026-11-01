# Cookly — README de arhitectură

Acesta este punctul de intrare tehnic pentru echipă. Organizarea țintă este definită în Etapa 1; sursele fundației din Etapa 2 și starea instalării/verificărilor sunt descrise în [README-ul proiectului](../../README.md) și [raportul de setup](SETUP-VERIFICATION.md).

## Ordinea de citire și autoritatea documentelor

1. [PRD](../product/PRD-Cookly.md): ce construim și în ce versiune.
2. [Arhitectura completă](ARCHITECTURE-Cookly.md): granițe, fluxuri, securitate și compromisuri.
3. [Structura și convențiile](PROJECT-STRUCTURE.md): unde va sta codul și cum se scrie.

Pentru nomenclatura fizică, `src/features` și denumirile din documentul de structură înlocuiesc propunerea orientativă `src/modules` din arhitectura inițială. Nu coexistă două ierarhii. `identity` devine `auth`, `catalog` se împarte în `ingredients` și `recipes`, `inventory` devine `pantry`, `meal-planning` devine `meal-planner`, iar `nutrition-pricing` devine `nutrition`, cu subdomeniu `pricing`. Responsabilitățile de securitate și regulile de produs rămân aceleași. Nu există încă fișiere de cod de migrat.

Într-un conflict privind produsul se revine la PRD și la deciziile explicite ale beneficiarului. O schimbare de mecanism de securitate, persistență sau scop cere actualizarea arhitecturii și motivarea într-un ADR; o convenție de naming nu o autorizează implicit.

## Organizarea în cinci straturi

| Strat | Responsabilitate | Interdicție principală |
|---|---|---|
| `presentation` | Componente, formulare, hookuri și apeluri HTTP din browser | Fără repository, SDK DB sau secrete |
| `contracts` | DTO-uri și scheme Zod care pot traversa granițele | Fără importuri server, DB sau UI |
| `application` | Use case-uri, autorizare prin porturi și coordonare | Fără dependență de framework/SDK concret |
| `domain` | Reguli și valori deterministe | Fără React, Next.js, Zod, rețea sau persistență |
| `infrastructure` | Adaptoare Supabase, mapări și implementări de porturi | Nu este API public pentru alte features |

`src/app` este adaptorul de rutare Next.js. RSC cheamă serviciile compuse server-side; componentele client folosesc `/api/v1`. `src/server/composition` injectează implementările. `src/workflows` coordonează operații între features; atomicitatea inventar/plan/listă se păstrează într-o singură RPC, conform arhitecturii.

## Reguli esențiale

- Features MVP: `auth`, `ingredients`, `pantry`, `recipes`, `matching`, `shopping`, `meal-planner`, `nutrition`, `admin`. `ai`, `community` și `billing` sunt definite pentru V2 și se creează numai când sunt cerute.
- `recipes/favorites` deține favoritele private; `auth/profile` deține profilul. Admin coordonează servicii autorizate și nu deține copii ale regulilor celorlalte features.
- Alte features consumă numai `contracts`; apelurile server între features sunt compuse prin porturi, fără importul repository-ului sau al serviciului concret al vecinului.
- Niciun barrel rădăcină care amestecă exporturi browser și server. Adaptoarele și entrypointurile server sunt marcate `server-only` la implementare.
- Tabelele aplicației nu primesc DML direct pentru membri; mutațiile critice trec prin RPC restrânse și RLS. Cheia privilegiată este rezervată mentenanței.
- Datele private și răspunsurile care setează sesiunea sunt `no-store`. Rețetele retrase au verificare de status curent, separată de cache-ul conținutului imuabil.
- Cantitățile și banii traversează JSON ca șiruri zecimale; `unknown`, `partial`, `empty` și `error` au semnificații distincte.
- Orice suprafață interactivă prevede loading, empty, eroare recuperabilă, accesibilitate și comportament la sesiune expirată, după caz.

## Configurare, verificări și decizii rămase

[Modelul de mediu](../../.env.example) separă parametrii publici de secretele server și ale mentenanței. Etapa 2 adaugă implementarea configurației Zod, TypeScript, lint și shell-ului; existența surselor nu demonstrează încă instalarea sau verificarea executabilă. Vezi raportul de setup pentru rezultatele reale.

[Convențiile](PROJECT-STRUCTURE.md) definesc scenariile viitoare pentru features. Fundația folosește runnerul nativ Node pentru teste pure și Playwright pentru shell; alegerea evită un framework suplimentar pentru aceste teste. RLS și testele de domeniu rămân în etapele de business. Typecheck/build/E2E se raportează numai după execuție reală.

Înainte de inițializare se confirmă versiunile, package managerul și lockfile-ul unic, instrumentele de test, hostingul/regiunea, configurația schedulerului și izolarea secretelor. Piața, sursele datelor și politicile de retenție rămân decizii de produs/operaționale din PRD. Nu se începe o altă etapă pe baza acestui README.
