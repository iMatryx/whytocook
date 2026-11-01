# Cookly — Specificația produsului (PRD)

Versiune: 1.0 · Data: 1 noiembrie 2026 · Etapa: 1 / 01 — Arhitectură și planificare  
Stare: propunere completă pentru validare; nu autorizează implementarea.

## 1. Context, certitudini și ipoteze

Cookly ajută utilizatorul să decidă ce poate găti pornind de la alimentele disponibile. Pentru fiecare rețetă arată ingredientele disponibile și lipsă, cantitățile, pașii, timpul, costul estimat și informațiile nutriționale.

**Cerințe confirmate:** aplicație web; Next.js App Router, React, TypeScript strict, Tailwind CSS, shadcn/ui, PostgreSQL, Supabase Auth/Storage, Zod; arhitectură modular monolith; securitate și accesibilitate implicite. Modulele cerute sunt acoperite în acest PRD, dar nu toate sunt propuse pentru MVP.

**Constatare locală:** directorul `/Users/user/Desktop/Projects/WhatToCook` este gol la redactare. Nu există aplicație, schemă de date, teste sau convenții locale de evaluat. Numele directorului nu schimbă numele produsului, Cookly.

**Ipoteze propuse, nevalidate prin cercetare:** lansare inițială în limba română, pentru adulți care gătesc acasă; unități metrice; RON ca monedă inițială; o singură piață de prețuri; produs gratuit în MVP; catalog editorial inițial de minimum 100 de rețete verificate. Piața, moneda, dimensiunea catalogului și țintele de mai jos trebuie aprobate înainte de dezvoltare. Nu există în acest document rezultate de interviuri sau statistici de piață.

## 2. Problemă, viziune și obiective

Utilizatorii au ingrediente, dar nu o decizie rapidă despre masă. Căutarea obișnuită poate produce rețete incompatibile cu timpul, cantitățile, restricțiile sau bugetul lor. Inventarul neactualizat și planificarea separată de cumpărături cresc efortul.

**Promisiune:** „Spune ce ai; află ce poți găti și ce mai trebuie să cumperi.”

Obiective:

1. Reducerea timpului până la alegerea unei rețete fezabile.
2. Folosirea alimentelor deja disponibile, inclusiv a celor apropiate de data introdusă pentru expirare.
3. Conectarea rețetelor, porțiilor, planului și cumpărăturilor într-un flux coerent.
4. Creșterea încrederii prin explicații, proveniență și estimări transparente.

Nu sunt obiective ale MVP: livrări de alimente, comenzi către comercianți, recomandări clinice, diagnoză, garanții privind alergeni sau siguranța unui aliment, recunoaștere foto, aplicații native, marketplace, chat social și recomandări generative autonome.

Nu se vor ascunde ingrediente lipsă pentru a crește conversia, nu se vor prezenta estimările ca măsurători și nu se va publica automat conținut generat de AI.

## 3. Personas și nevoi

Personas sunt ipoteze de produs, de validat prin interviuri și testarea prototipurilor.

| Persona | Context și nevoie | Blocaj principal | Rezultat dorit |
|---|---|---|---|
| Ana, profesionistă ocupată | Are 20–30 minute și câteva ingrediente | Prea multe opțiuni și timpi nerealist de mici | Alege rapid o masă cu pași clari |
| Mihai, student cu buget limitat | Cumpără puțin și gătește pentru 1–2 porții | Ingrediente speciale și costuri neclare | Folosește ce are și vede costul cumpărăturilor suplimentare |
| Elena, părinte care planifică | Organizează mai multe mese și porții | Liste duplicate și alimente uitate | Un plan simplu și o listă agregată |
| Radu, utilizator cu restricții alimentare | Evită anumite ingrediente și urmărește orientativ nutriția | Etichete incomplete și substituții riscante | Excluderi explicite și limite vizibile ale datelor |
| Irina, editor/moderator | Menține un catalog utilizabil și corect | Rețete incomplete, raportări și duplicări | Publicare controlată și istoric al deciziilor |

Prioritatea MVP este Ana, apoi Mihai. Planificarea pentru Elena este simplificată. Pentru Radu, datele incomplete nu permit includerea rețetei în rezultate filtrate strict pe alergeni.

## 4. Roluri și permisiuni

| Rol | Permisiuni |
|---|---|
| Vizitator | Căutare, filtre, pagini publice și ingrediente temporare; fără salvare în cloud |
| Membru | Propriul inventar, favorite, profil, plan și listă; în V2 poate trimite rețete și raportări |
| Editor | Creează și revizuiește catalogul; fără acces implicit la datele personale ale membrilor |
| Moderator, V2 | Gestionează conținut și raportări în aria atribuită |
| Administrator | Gestionează roluri, configurări și operațiuni autorizate, cu jurnalizare |

Autorizarea se verifică pe server și la accesul la date, pentru fiecare resursă. Ascunderea unui buton nu reprezintă control de acces. Rolurile privilegiate nu se pot seta din profilul utilizatorului.

## 5. Scop și versiuni

| Domeniu | MVP | V2 | V3 |
|---|---|---|---|
| Rețete și matching | Catalog editorial, ingrediente normalizate, cantități, explicații, filtre, sortare | Substituții curate editorial, recomandări personalizate | Recomandări adaptate istoricului și gospodăriei |
| Inventar | CRUD, loturi, cantități opționale, dată opțională | Partajare în gospodărie, notificări opționale | Import bonuri/fotografii, confirmat de utilizator |
| Planificare | Săptămână, mese, rețetă și porții, confirmare gătire | Recurență, resturi și obiective orientative | Optimizare multiobiectiv cu explicarea compromisurilor |
| Cumpărături | Listă personală, agregare, bifare, elemente manuale | Partajare și notificări | Integrări comerciale, după validare |
| Nutriție | Estimări pentru rețetele cu date disponibile | Acoperire mai bună și totaluri zilnice | Preferințe avansate, fără poziționare medicală |
| AI | Fără generare; interfața nu promite AI disponibil | Asistent opțional pentru adaptări și explicații | Planuri asistate și import multimodal |
| Cont și favorite | Auth, recuperare acces, profil minim, favorite, export/ștergere | Setări extinse și gospodării | Personalizare avansată |
| Comunitate | Exclusă | Rețete trimise, ratinguri, comentarii și raportări moderate | Colecții publice și urmărire autori |
| Admin | Catalog, publicare, dezactivare, audit și roluri | Moderare, prețuri/date și suport mai avansat | Analize editoriale și operaționale extinse |
| Monetizare | Gratuit; măsurare de interes fără debitare | Abonament premium pilot, facturare și administrare | Parteneriate/afiliere etichetate, dacă sunt validate |

Ordinea propusă: catalog și taxonomie → căutare și matching → cont și inventar → favorite → plan și listă → măsurare și administrare. Este o hartă de dependențe, nu un plan de implementare sau o estimare de calendar. Orice reducere a MVP trebuie aprobată explicit.

## 6. User stories și criterii de acceptare

Prioritate P0 = obligatoriu în MVP; P1 = obligatoriu în versiunea indicată. Criteriile sunt condiții de verificat ulterior, nu rezultate de teste executate.

| ID | Versiune | User story | Criteriu de acceptare |
|---|---|---|---|
| US-01 | MVP/P0 | Ca vizitator, introduc ingrediente pentru a găsi idei | Pot selecta un ingredient canonic din sugestii, elimina selecția și căuta fără cont; textul nerecunoscut solicită clarificare |
| US-02 | MVP/P0 | Vreau să înțeleg de ce o rețetă se potrivește | Fiecare rezultat arată ingredientele acoperite, lipsă și cu cantitate necunoscută; „pot găti” respectă regulile din §8 |
| US-03 | MVP/P0 | Filtrez după timpul și restricțiile mele | Filtrele sunt cumulative, sunt vizibile și pot fi resetate; filtrul strict de alergeni exclude rețetele cu date incomplete |
| US-04 | MVP/P0 | Vreau o rețetă executabilă pentru porțiile mele | Detaliul conține randament, cantități, pași ordonați, timpi și surse; schimbarea porțiilor actualizează cantitățile și estimările eligibile |
| US-05 | MVP/P0 | Îmi gestionez alimentele | Pot crea, modifica și șterge propriile loturi; cantitatea negativă este respinsă; două conturi nu pot accesa reciproc inventarul |
| US-06 | MVP/P0 | Salvez rețete pentru mai târziu | Adăugarea repetată nu dublează favorita; o rețetă retrasă apare ca indisponibilă, cu posibilitate de eliminare |
| US-07 | MVP/P0 | Planific mesele unei săptămâni | Pot adăuga, muta și elimina o rețetă, selectând data, tipul mesei și porțiile; inventarul nu scade la simpla planificare |
| US-08 | MVP/P0 | Cumpăr numai ce mai trebuie | Lista agregă necesarul din mesele selectate și scade o singură dată stocul cunoscut; generarea repetată nu dublează intrările |
| US-09 | MVP/P0 | Confirm ce am gătit | Văd consumul propus, îl pot ajusta și confirma; repetarea aceleiași confirmări nu scade din nou stocul |
| US-10 | MVP/P0 | Vreau estimări credibile | Costul și nutriția includ unitate, porție, sursă/data datelor și marcaj de acoperire; lipsa datelor nu se afișează drept zero |
| US-11 | MVP/P0 | Îmi controlez contul | Pot intra/ieși, recupera accesul, exporta datele și solicita ștergerea; sesiunile neautorizate nu permit operațiuni private |
| US-12 | MVP/P0 | Ca editor, public rețete complete | Publicarea este blocată dacă lipsesc câmpuri obligatorii; retragerea elimină rețeta din căutare și produce audit |
| US-13 | V2/P1 | Vreau ajutor AI pentru o adaptare | Sugestia este marcată AI, respectă schema și excluderile și nu modifică datele fără confirmare; erorile păstrează accesul la rețeta originală |
| US-14 | V2/P1 | Îmi public și discut rețetele | Trimiterea intră în moderare; pot raporta conținutul; conținutul retras nu rămâne public |
| US-15 | V2/P1 | Aleg și gestionez premium | Prețul și limitele sunt explicite; plata verificată activează dreptul o singură dată; pot anula reînnoirea și vedea data încetării |

## 7. Cazuri de utilizare și fluxuri

### 7.1 Prima rețetă, fără cont

Pagina inițială → adăugare ingrediente → sugestii canonice → cantități opționale → filtre → rezultate explicate → detaliu → ajustare porții → gătire sau creare cont pentru salvare.

Ingredientele temporare rămân în sesiunea curentă. La creare cont, utilizatorul poate confirma importul în inventar; nu se suprascriu date existente. Nu se cere autentificare înaintea primei căutări.

### 7.2 Inventar și alimente apropiate de expirare

Membru autentificat → inventar → adaugă aliment/lot, cantitate, unitate, locație și dată opțională → validare → salvare → căutare cu inventarul activ → sortare opțională după folosirea alimentelor cu dată apropiată.

Datele trecute sunt semnalate și loturile sunt excluse implicit din stocul propus pentru consum. Data introdusă nu este o evaluare a siguranței alimentului. Utilizatorul poate corecta data sau elimina lotul; aplicația nu recomandă consumul pe baza scorului.

### 7.3 Plan săptămânal și cumpărături

Selectare rețetă → zi/masă/porții → salvare în plan → selectare mese pentru cumpărături → calcul necesar cumulat → alocare stoc cunoscut → listă → bifare la cumpărare → confirmare separată a adăugării în inventar.

Bifarea nu adaugă automat alimente în frigider. La regenerarea listei se arată diferențele; elementele manuale și bifările care rămân valide se păstrează. Eliminarea unei mese elimină doar necesarul derivat din acea masă. Planificarea aceluiași aliment în două mese nu îl scade de două ori din stocul disponibil pentru listă.

### 7.4 Gătire și ajustarea stocului

Deschidere masă planificată sau rețetă → „Am gătit” → confirmare porții și cantități efectiv folosite → previzualizare loturi consumate → confirmare tranzacțională. Loturile eligibile cu data cea mai apropiată sunt propuse primele. Stocul insuficient cere ajustare și nu devine negativ. Corectarea ulterioară folosește o operațiune explicită de compensare, jurnalizată.

### 7.5 Lipsă rezultate și indisponibilitate

Zero rezultate → explicarea filtrelor active → eliminare selectivă sau resetare → opțiuni cu ingrediente lipsă numai dacă nu încalcă restricțiile stricte. O eroare tehnică are mesaj și reîncercare; nu se prezintă drept lipsă de rețete.

### 7.6 Publicare și comunitate

MVP: editor → draft → verificare câmpuri și date → publicare → audit; modificările publicate creează versiune nouă. V2: membru → trimitere → verificare automată → coadă moderare → aprobare/respingere motivată → publicare; raportare → evaluare → acțiune și posibilitate de contestație. Conținutul raportat nu se șterge automat doar pe baza numărului de raportări.

## 8. Cerințe funcționale și reguli de domeniu

### FR-01. Catalog și căutare — MVP

- Rețeta include titlu, descriere, randament și unitatea randamentului, ingrediente obligatorii/opționale, cantități/unități, pași ordonați, timp activ, timp de așteptare și total editorial, dificultate, echipament, etichete, alergeni evaluați, autor/sursă și statut.
- Fotografia este opțională și are alternativă vizuală și text alternativ. Drepturile pentru text, imagini și date trebuie confirmate înainte de publicare.
- Căutare după titlu și ingrediente, cu sinonime și diacritice; paginare și ordine stabilă; filtre după timp total, dificultate, dietă, excluderi și echipament. Filtrul de cost include doar estimări suficient de complete și explică excluderile.
- Rețetele retrase nu apar în rezultate. Planurile existente păstrează o referință la versiune; retragerea pentru o problemă de siguranță blochează instrucțiunile și arată motivul relevant.

### FR-02. Matching explicabil — MVP

1. Ingredientele se mapează la identificatori canonici; aliasurile nu devin alimente separate. Variantele diferite nu sunt echivalate fără regulă editorială.
2. Cantitățile se raportează la porțiile alese. MVP acceptă 1–20 porții întregi, cu validare pe server.
3. Conversii automate numai în aceeași dimensiune: kg↔g, l↔ml. Bucăți↔grame și volum↔masă cer conversie specifică ingredientului, documentată; altfel cantitatea rămâne necomparabilă.
4. Un ingredient obligatoriu are stare: acoperit, insuficient, absent sau cantitate neverificată. Cantitatea omisă în inventar înseamnă prezență declarată, fără dovadă de suficiență.
5. „Poți găti acum” se acordă numai când toate ingredientele obligatorii sunt acoperite cantitativ și restricțiile sunt satisfăcute. Prezența fără cantități produce „Verifică cantitățile”. Ingredientele insuficiente sau absente produc „Mai ai nevoie de…”.
6. Procentul de prezență = ingrediente obligatorii prezente / total ingrediente obligatorii. Este etichetat ca prezență, nu procent de masă sau garanție de fezabilitate. Cantitățile insuficiente sunt evidențiate separat.
7. Sortarea implicită: rețete fezabile cantitativ → necesită verificare → necesită cumpărături; în fiecare grup, mai puține ingrediente lipsă, apoi procent de prezență descrescător, timp total crescător și identificator stabil. Prioritatea expirării este o sortare distinctă, opt-in.
8. Sarea, uleiul și apa nu sunt presupuse disponibile. Un utilizator poate adăuga explicit alimente uzuale în inventar. Ingredientele opționale nu reduc potrivirea; înlocuirile nu se aplică implicit.
9. Excluderile și alergenii sunt filtre stricte aplicate înainte de ranking; personalizarea, sponsorizarea sau AI-ul nu le pot relaxa.
10. Decizie propusă pentru eligibilitate: în căutarea după ingrediente/inventar intră numai rețetele cu minimum un ingredient obligatoriu prezent în selecția activă, apoi se aplică filtrele stricte. Fără ingrediente selectate, utilizatorul este invitat să adauge ingrediente sau să exploreze catalogul. Explorarea și căutarea textuală pot include rețete fără ingrediente comune; dacă utilizatorul activează și modul de potrivire cu inventarul, pragul se aplică și acolo. Ingredientele opționale comune nu satisfac pragul.

### FR-03. Inventar — MVP

Loturile pot conține ingredient, cantitate/unitate opționale, locație (frigider, congelator, cămară), data opțională și data actualizării. Cantitatea este pozitivă când există; zero reprezintă epuizare și nu contribuie la stoc. Se pot avea mai multe loturi pentru același aliment. Ștergerea cere confirmare sau posibilitate de anulare. Toate mutațiile verifică proprietarul, validitatea și conflictele de actualizare.

### FR-04. Planificare și favorite — MVP

Plan personal cu zi calendaristică și tip de masă (mic dejun, prânz, cină, gustare), rețetă și porții; mai multe intrări per masă sunt permise. Datele de plan sunt păstrate ca date locale, fără deplasare la conversia UTC. Fără rezervare de stoc în MVP; lista arată că disponibilitatea poate evolua. Favoritele sunt private și unice per utilizator/rețetă.

### FR-05. Listă de cumpărături — MVP

O listă activă personală, cu intrări manuale și derivate, origine identificabilă, cantitate, unitate și stare bifată. Ingrediente în unități convertibile se agregă. Cele neconvertibile rămân pe linii separate. Stocul fără cantitate nu se scade: linia indică „Verifică acasă”. Cantitățile negative rezultate sunt limitate la zero. Cantitatea de cumpărat reprezintă necesarul alimentar, fără rotunjire automată la ambalaje comerciale.

### FR-06. Cost — MVP

Se afișează distinct costul estimat al întregii rețete și costul estimat al necesarului lipsă; fiecare are total și valoare per porție, monedă, regiune și data prețurilor. Se folosesc prețuri de referință normalizate, nu tarife live promise. Costul ingredientului = cantitate comparabilă × preț/unitate. Ambalajele, promoțiile, transportul și energia nu sunt incluse și acest lucru este indicat.

Totalul se afișează numai când toate ingredientele obligatorii sunt evaluabile; altfel se afișează „cost parțial”, ingredientele neevaluate și subtotalul cunoscut. Fără amestec de monede. Ingredientele opționale sunt excluse până la selectare.

### FR-07. Nutriție — MVP

Energie, proteine, carbohidrați și grăsimi pentru rețetă și porție, calculate din cantități comestibile și valori de referință. Fibrele și alți indicatori se afișează doar dacă există date. Valorile lipsă nu devin zero; estimările parțiale sunt marcate și nu sunt folosite la filtre nutriționale stricte. Fără valori per 100 g de preparat când greutatea finală nu este cunoscută. Randamentul la gătire și mărcile pot schimba rezultatele; interfața explică limita. Datele nu sunt prezentate ca recomandare medicală.

### FR-08. Conturi și profil — MVP

Propunere: email/parolă prin Supabase Auth, verificare email și recuperare acces; OAuth se decide separat. Profilul include nume afișat opțional, limbă, fus orar, preferințe și excluderi opționale. Preferințele nu sunt deduse ca diagnostice. Schimbarea lor invalidează rezultatele salvate în cache și cere reevaluarea compatibilității planului. Exportul este într-un format structurat; ștergerea contului arată efectele și necesită reautentificare pentru acțiunea sensibilă.

### FR-09. AI — V2

AI este un asistent opțional, nu sursa matchingului sau a stocului. Primește doar datele necesare și nu trimite identitatea, emailul sau întregul istoric implicit. Preferințele privind trimiterea datelor sunt explicite. Rețetele și textele importate sunt date nefiabile, nu instrucțiuni pentru model.

Ieșirea structurată se validează prin Zod, apoi prin reguli de domeniu pentru ingrediente, unități și excluderi. Cantitățile și nutriția se recalculează din date cunoscute; modelul nu inventează prețuri sau valori nutriționale. Sugestiile riscante sau nevalidabile sunt refuzate ori marcate ca indisponibile. Salvarea unei adaptări creează variantă privată după confirmare, fără înlocuirea originalului. Sunt necesare cote, timeout, buget per utilizator și fallback fără AI. Lansarea cere un set de evaluare cu alergeni, date lipsă, instrucțiuni malițioase și costuri excesive.

### FR-10. Comunitate — V2/V3

Publicarea necesită cont verificat și acceptarea regulilor privind drepturile de autor și conduita. O evaluare activă per membru/rețetă; autorul nu își evaluează rețeta. Comentariile și raportările au limite de frecvență, moderare și istoric. Se prevăd blocare utilizatori, contestarea deciziilor și gestionarea solicitărilor privind conținutul. Eliminarea contului trebuie să trateze explicit rețetele publice și pseudonimizarea; politica exactă se validează înainte de lansarea comunității.

### FR-11. Administrare — MVP

Administrare catalog, ingrediente/aliasuri, unități și conversii aprobate, surse nutriționale și prețuri, drepturi media, status de publicare și acces pe roluri. Auditul reține actor, acțiune, resursă, dată și rezultat, fără secrete. Dezactivarea unui membru revocă accesul conform politicii stabilite. Operațiunile privilegiate și accesul excepțional pentru suport au scop explicit și audit.

### FR-12. Monetizare — V2/V3

Ipoteză freemium: căutarea de bază, excluderile alimentare și accesul la propriile date rămân gratuite. Premium poate include planificare avansată, gospodării și cote AI mai mari. Prețul, cotele și intervalul de facturare se validează prin cercetare și economie unitară, nu se fixează în acest PRD.

Abonamentele folosesc un procesator extern, fără stocarea datelor de card în Cookly. Drepturile se acordă pe baza evenimentelor verificate ale procesatorului; webhookurile sunt idempotente și rezistente la ordine inversată. Sunt necesare stări trial/activ/restant/anulat/expirat, după oferta aleasă, și politici explicite de anulare, rambursare și taxe. V3 poate introduce afiliere transparent etichetată; aceasta nu modifică regulile de compatibilitate alimentară.

## 9. Stări de interfață și accesibilitate

| Suprafață | Loading | Empty | Error / recuperare |
|---|---|---|---|
| Căutare | Indicator și anunț accesibil; cererile vechi nu suprascriu rezultatul nou | Îndemn de adăugare ingrediente sau ajustare filtre | Reîncercare și păstrarea selecției |
| Detaliu | Schelet cu structură stabilă | Rețetă retrasă/inexistentă explicată | Reîncercare; datele estimative indisponibile sunt distincte |
| Inventar/favorite | Încărcare inițială clară | Acțiune de adăugare/căutare | Păstrarea formularului; rollback pentru operații optimiste eșuate |
| Plan/listă | Feedback pe zona afectată | Adăugare masă/element | Explicarea conflictului, reîncărcare sau reîncercare fără duplicate |
| Auth/profil | Buton ocupat și protecție împotriva dublării | Onboarding minim | Mesaj care permite recuperarea fără dezvăluirea inutilă a existenței contului |
| Admin/AI/plată | Operațiune în curs cu stare verificabilă | Conținut indisponibil sau nicio solicitare | Motiv utilizabil, identificator de suport și fallback adecvat |

Toate fluxurile esențiale funcționează cu tastatura și cititorul de ecran: etichete, focus vizibil și restaurat, anunțuri de stare, mesaje asociate câmpurilor, contrast adecvat. Statusurile nu sunt exprimate doar prin culoare. Propunere de țintă: WCAG 2.2 AA, verificată automat și manual înainte de lansare. Interfața este responsive de la 360 px, fără funcții dependente exclusiv de hover sau drag-and-drop.

## 10. Cerințe nefuncționale

Țintele sunt propuneri de acceptare, nu performanțe măsurate.

| ID | Domeniu | Cerință și metodă de verificare |
|---|---|---|
| NFR-01 | Securitate | Validare la granițe cu Zod; autorizare server și RLS pentru date private; politici Storage; teste cu două conturi și roluri diferite; acces implicit interzis |
| NFR-02 | Protecția aplicației | Gestionare sigură a sesiunilor, protecție CSRF unde se aplică, randare fără HTML nesanitizat, queryuri parametrizate, limite de frecvență la auth/căutare/AI/upload, validare MIME și dimensiuni media |
| NFR-03 | Secrete | Cheile privilegiate rămân pe server; fișierele locale și logurile nu expun credențiale; rotația și verificarea dependențelor intră în procesul de operare |
| NFR-04 | Confidențialitate | Minimizare date, evenimente fără email sau inventar brut, politici de retenție/export/ștergere și consimțământ conform pieței; condițiile juridice se validează cu specialist înainte de lansare |
| NFR-05 | Performanță | Pe paginile principale, ținte p75: LCP ≤2,5 s, INP ≤200 ms, CLS ≤0,1; măsurare pe trafic real mobil după lansare și teste de laborator înainte |
| NFR-06 | Căutare | p95 server ≤800 ms, excluzând rețeaua clientului, la 10.000 rețete și 50 cereri/s timp de 10 minute, cu maximum 30 ingrediente/cerere; rata erorilor <1%; set și mediu documentate |
| NFR-07 | Fiabilitate | Țintă lunară disponibilitate 99,5% pentru căutare și date private, măsurată prin verificări externe; degradare separată pentru AI, media și estimări |
| NFR-08 | Integritate | Mutații critice tranzacționale, chei de idempotență și control concurență; niciun stoc negativ și nicio contaminare între utilizatori |
| NFR-09 | Recuperare | Propunere RPO ≤24 h și RTO ≤8 h; politica de backup și un exercițiu real de restaurare trebuie să demonstreze fezabilitatea înainte de producție |
| NFR-10 | Observabilitate | Loguri structurate, identificatori de corelare, metrici de latență/erori, alerte și audit; inventarul și restricțiile alimentare nu se loghează implicit |
| NFR-11 | Compatibilitate | Testare pe ultimele două versiuni stabile Chrome, Safari, Firefox și Edge la data lansării și pe Safari iOS/Chrome Android; lista exactă se fixează în planul QA |
| NFR-12 | Mentenabilitate | TypeScript strict, module cu proprietar de date și API intern, migrații versionate, verificări lint/typecheck/build și teste de domeniu/integrare/E2E potrivite riscului |

Pentru ștergere se propune blocarea imediată a accesului și procesarea datelor active în maximum 30 zile. Exportul se propune în maximum 7 zile. Acestea sunt ținte operaționale, nu afirmații despre termene legale. Retenția backupurilor, excepțiile pentru facturare/audit și propagarea ștergerii trebuie stabilite și comunicate înainte de colectarea datelor.

## 11. Arhitectură propusă și model conceptual

Un singur produs deployabil, organizat în module: `identity`, `catalog`, `matching`, `inventory`, `favorites`, `meal-planning`, `shopping`, `nutrition-pricing`, `ai`, `community`, `billing`, `admin`. Modulele V2/V3 nu se implementează preventiv în MVP. Numele de directoare sunt orientative până există convenții locale.

Next.js App Router gestionează paginile și operațiunile server. Componentele client sunt folosite pentru interacțiuni. PostgreSQL este sursa de adevăr; Supabase Auth gestionează identitatea, Storage media. Serverul păstrează regulile de domeniu. Modulele comunică prin servicii interne tipate; nu modifică arbitrar tabelele altui modul. Nu sunt necesare microservicii în această etapă.

| Entitate | Date și relații importante |
|---|---|
| Profil | Identitate Auth, preferințe, limbă, fus orar; separat de rolurile privilegiate |
| Ingredient / Alias | Identificator canonic, nume, dimensiuni/conversii aprobate, clasificări și evaluarea alergenilor |
| Rețetă / Versiune / IngredientRețetă / Pas | Autor, statut, porții, cantități, pași, surse și drepturi; versiune publicată identificabilă |
| LotInventar / MișcareStoc | Proprietar, ingredient, cantitate/unitate, dată, locație și operațiunea de consum/compensare |
| Favorită | Unicitate utilizator + rețetă |
| IntrarePlan | Proprietar, dată locală, masă, versiune rețetă și porții |
| Listă / ElementListă / SursăElement | Proprietar, stare, intrări manuale/derivate, contribuțiile meselor și reconciliere |
| ReferințăNutrițională / Preț | Ingredient, unitate de bază, sursă, regiune/monedă, data și acoperire |
| Audit | Actor autorizat, acțiune, resursă, dată și rezultat |
| V2: SolicitareAI / ConținutComunitate / Raportare / Abonament | Cote și versiuni, moderare, drepturi și evenimente de facturare |

Cantitățile folosesc precizie zecimală definită; rotunjirea este pentru afișare, nu pentru calcule intermediare. Datele calendaristice și momentele UTC sunt distincte. Cache-ul public conține numai catalog; rezultatele personale nu se distribuie între utilizatori. Planul de migrare și strategia pentru joburi de export/ștergere se aleg ulterior, fără dependențe introduse acum.

## 12. Metrici și instrumentare

Metrică principală propusă: **utilizatori activați care confirmă cel puțin o rețetă gătită într-o săptămână**. Confirmarea este o declarație a utilizatorului, nu dovada consumului și nici măsurare directă a risipei reduse.

Țintele se evaluează după minimum 4 săptămâni de beta și un eșantion propus de minimum 100 utilizatori activați; sunt ipoteze, nu benchmarkuri validate. Vizitatorii fără urmărire persistentă se raportează separat, la nivel de sesiune.

| Metrică | Definiție | Țintă inițială propusă |
|---|---|---|
| Activare în 7 zile | Membri noi care fac o căutare cu ≥2 ingrediente și deschid un rezultat / membri noi eligibili din cohorta de înscriere | ≥40% |
| Timp până la alegere | Mediana dintre prima căutare și selectarea explicită „Gătesc această rețetă”, pentru sesiuni cu alegere; abandonul se raportează separat | ≤3 minute |
| Conversie căutare → detaliu | Sesiuni cu deschidere de rezultat / sesiuni cu căutare finalizată cu succes | ≥50% |
| Relevanță declarată | Evaluări pozitive „pot folosi această rețetă” / răspunsuri primite; rata de răspuns este raportată | ≥70% |
| Confirmare gătire săptămânală | Utilizatori activați cu confirmare / utilizatori activați activi în săptămâna respectivă | ≥25% |
| Retenție W4 | Utilizatori activați în săptămâna 0 care revin și caută/planifică/gătesc în săptămâna 4 / cohortă activată cu fereastră completă | ≥20% |
| Rezultate zero | Căutări reușite tehnic fără rezultate / căutări reușite tehnic; separat pe restricții | <15% |
| Calitatea catalogului | Rețete publicate care trec checklistul editorial / rețete publicate | 100% câmpuri obligatorii |
| Fiabilitate și cost | Erori/cereri, latență, cost lunar/utilizator activ; V2: cost/solicitare AI și marjă premium | Conform NFR; plafon financiar de validat |

Evenimente propuse: `search_submitted`, `search_completed`, `recipe_opened`, `recipe_selected`, `inventory_updated`, `favorite_added`, `meal_planned`, `shopping_generated`, `cooking_confirmed`, `feedback_submitted`; V2 adaugă evenimente AI și abonamente. Evenimentele includ versiunea schemei, moment, identificator pseudonim unde este permis, ID rețetă și număr de ingrediente, fără text liber sau inventar brut. Se definesc deduplicarea, eligibilitatea, consimțământul și retenția înainte de instrumentare. Erorile tehnice nu sunt numărate ca rezultate zero.

## 13. Criterii de lansare și demonstrație

MVP este acceptabil numai dacă toate US-01–US-12 sunt demonstrate, cerințele P0 și verificările de securitate sunt îndeplinite, iar eventualele abateri sunt aprobate explicit.

Scenarii obligatorii pentru viitorul plan de verificare:

1. Vizitator cu ingrediente cunoscute, aliasuri și text nerecunoscut: selecție corectă și rezultate explicate.
2. Rețetă cu 200 g necesare și loturi de 80 g + 70 g: deficit de 50 g, fără etichetă „poți găti”. Cantitatea necunoscută nu este suficiență confirmată.
3. Scalare de la 2 la 4 porții: cantități și totaluri calculate corect; timpii și temperatura nu se dublează automat.
4. Două mese care cer câte 200 g și stoc de 250 g: lista cere 150 g, inclusiv după regenerare. Unitățile incompatibile nu se însumează.
5. Confirmare gătire repetată și operații concurente: o singură mișcare, fără stoc negativ; eroarea nu lasă actualizare parțială.
6. Filtru strict pentru alergeni: ingredient cunoscut incompatibil sau evaluare incompletă exclude rețeta, inclusiv din sugestiile alternative.
7. Cost sau nutriție incompletă: subtotal/estimare parțială vizibilă, niciodată zero implicit sau total complet inventat.
8. Cont A încearcă să citească/modifice datele contului B și un membru încearcă accesul admin: acces refuzat pe toate căile relevante.
9. Catalog gol, eroare de rețea, sesiune expirată și rețetă retrasă: mesaje distincte, recuperare și păstrarea intrărilor unde este posibil.
10. Parcurs complet cu tastatura și cititor de ecran pe mobil/desktop: ingrediente → rețetă → plan → listă; focus și anunțuri verificate.
11. Export și ștergere cont: datele potrivite, acces autorizat, stare de procesare și verificarea retenției convenite.
12. Editorul publică și retrage o rețetă: validare, audit și reflectare în căutare/favorite/plan.
13. Căutare după inventar cu un singur ingredient: rețetele fără ingrediente obligatorii comune nu apar; explorarea catalogului poate afișa aceleași rețete, cu stările de disponibilitate corecte.

Testarea viitoare include teste unitare pentru matching/conversii/agregare, integrare PostgreSQL/RLS și tranzacții, E2E pentru fluxurile esențiale, audit accesibilitate și încărcare conform profilului NFR. Nu se declară succes până nu există execuții și rezultate reale.

## 14. Riscuri, constrângeri și dependențe

| Risc / dependență | Impact | Măsură și responsabilitate propusă |
|---|---|---|
| Catalog sau surse fără drepturi clare | Lansare blocată | Product/editor confirmă licențele și proveniența înainte de import |
| Cantități, conversii sau alergeni incompleți | Potriviri înșelătoare | Editor validează datele; matching conservator și etichete explicite |
| Prețuri nereprezentative | Pierderea încrederii | Product stabilește piața și actualizarea; costul rămâne estimativ |
| Inventar neactualizat | Liste și rețete greșite | Data actualizării, editare rapidă, confirmare consum; fără pretinsă precizie |
| MVP prea larg pentru echipă | Întârziere și calitate redusă | Estimare după validare; reducerea scopului numai prin decizie explicită |
| Restricții ale planului de găzduire/backup | Ținte nerealiste | Tech lead validează costul, limitele și restaurarea înainte de producție |
| Erori AI și costuri necontrolate | Sugestii riscante și pierderi | V2 condiționat de evaluări, cote și buget aprobat |
| Abuz în comunitate | Cost operațional și conținut nociv | V2 condiționat de moderare, reguli și capacitate de răspuns |
| Preferințe alimentare și date personale | Impact de confidențialitate | Minimizare, acces limitat și validarea politicilor pentru jurisdicția aleasă |
| Plăți și fiscalitate | Obligații operaționale neacoperite | Billing se lansează numai după validarea procesatorului și politicilor |

Nu există buget, dimensiune de echipă sau termen de lansare confirmate. Nu se poate promite un calendar sau o economie unitară în absența lor. Acest PRD nu introduce biblioteci, furnizori AI, servicii de plăți sau surse externe obligatorii.

## 15. Decizii de validat înainte de implementare

Stackul și modular monolith sunt cerințe confirmate; lista de mai jos validează detaliile, fără a redeschide automat aceste cerințe.

| ID | Decizie și propunere | Motiv / alternativă | Cine validează și când |
|---|---|---|---|
| D-01 | Piață inițială România, română, RON, adulți | Determină prețuri, conținut, condiții și suport; alternativa este altă piață/monedă | Product, înainte de schema prețurilor și lansare |
| D-02 | MVP conform §5, fără AI/comunitate/plăți | Favorizează validarea utilității; un MVP redus ar schimba criteriile US | Product, înainte de planul de implementare |
| D-03 | Catalog editorial și minimum 100 rețete cu drepturi clare | API extern/import licențiat poate reduce efortul, dar schimbă costul și dependențele | Product/editor, înainte de import |
| D-04 | Taxonomie canonică, conversii explicite, matching determinist conform §8 | Decide ce înseamnă „pot găti”; embeddings pot fi evaluate ulterior, fără ocolirea regulilor stricte | Tech lead + Product, înainte de modelarea catalogului |
| D-05 | PostgreSQL cu RLS pentru date private și politici Storage | Trebuie ales accesul server/user și gestionarea rolurilor fără bypass accidental | Tech lead/security, înainte de primul flux privat |
| D-06 | Email/parolă, verificare email; MFA pentru admin | OAuth sau linkuri de autentificare pot schimba UX și operațiunile | Product + Tech lead, înainte de auth |
| D-07 | Căutare PostgreSQL și indexare a aliasurilor pentru MVP | Motor extern numai dacă relevanța sau încărcarea justifică dependența | Tech lead, prin benchmark pe catalog reprezentativ |
| D-08 | Numere zecimale, unități de bază, versiuni rețete, tranzacții și idempotență | Evită erori de calcul, planuri schimbate retroactiv și consum duplicat | Tech lead, înainte de schema de date |
| D-09 | Fără rezervare stoc; o listă activă; regenerare cu reconciliere | Rezervarea, mai multe liste și gospodăriile schimbă concurența și UX | Product + Tech lead, înainte de plan/listă |
| D-10 | Surse nutriționale și prețuri cu versiune, acoperire și dată | Licența, frecvența actualizării și conversiile decid calitatea estimărilor | Editor/Product, înainte de afișarea estimărilor |
| D-11 | Găzduire, regiune Supabase, backup, joburi și medii separate | Costul și planul ales trebuie să susțină NFR/RPO/RTO; furnizorul de hosting nu este fixat | Tech lead, înainte de infrastructură |
| D-12 | Retenție, export/ștergere, analytics și consimțământ | Se validează pentru piața și datele reale; nu se presupune conformitate prin stack | Product + responsabil juridic/date, înainte de colectare |
| D-13 | Ținte NFR și accesibilitate din §9–10 | Compromisuri de buget și capacitate, verificabile pe profilul definit | Product + QA + Tech lead, înainte de planul QA |
| D-14 | Buget, calendar, echipă și proprietari de module | Fără acestea nu există estimare de livrare credibilă | Sponsor/Product, înainte de planificarea execuției |
| D-15 | Furnizor AI, locația/prelucrarea datelor, cote, evaluări și plafon de cost | Alegerea se face pe un set de evaluare Cookly, nu doar pe demonstrații | Product + Tech lead, înainte de V2 AI |
| D-16 | Procesator, ofertă premium, drepturi, anulări și taxe | Necesită validarea modelului comercial și reconcilierea evenimentelor | Product/financiar + Tech lead, înainte de V2 billing |
| D-17 | Reguli comunitate, capacitate de moderare și contestații | Publicarea fără operațiuni pregătite nu este acceptabilă | Product + moderator, înainte de V2 comunitate |

## 16. Limitele etapei și verificarea manuală

Livrabilul este documentație de produs și arhitectură conceptuală. Nu sunt implementate aplicația, tabelele, autentificarea, politici RLS, prototipuri sau teste. Metricile și performanțele sunt ținte; personas și segmentarea sunt ipoteze. Nu au fost consultate surse externe și nu se afirmă validare juridică, medicală sau comercială.

De verificat manual de către beneficiar:

- Aprobarea pieței, monedei, publicului și problemei prioritare.
- Aprobarea graniței MVP/V2/V3, în special includerea planificatorului și listei în MVP.
- Confirmarea sensului „poți găti”, a cantităților necunoscute, excluderilor și tratării datelor de expirare.
- Identificarea surselor și drepturilor pentru rețete, imagini, nutriție și prețuri.
- Validarea țintelor, bugetului, echipei și responsabililor pentru deciziile D-01–D-17.

Etapa următoare nu se începe fără o cerere separată. Aprobarea acestui PRD nu este echivalentă cu autorizarea implementării.
