# Cookly — planul schemei de date

Etapa 3, sarcina „Schema bazei de date”. Nu include API-uri, politici de acces permisiv,
integrarea UI, importuri de rețete sau operații de business.

1. Respectăm `ARCHITECTURE-Cookly.md` și `PROJECT-STRUCTURE.md`: PostgreSQL,
   `app_private`, Supabase Auth, modular monolith, publicare versionată.
2. Livrăm migrații ordonate: fundație și identitate; catalog și rețete;
   date personale și operaționale; invariabile și securitate implicit închisă.
3. Verificăm pe PostgreSQL izolat constrângeri, relații între proprietari,
   publicare, ștergeri și refuzul accesului. PGlite este numai instrument de test;
   nu înlocuiește PostgreSQL/Supabase în aplicație.
4. Documentăm ERD, fiecare FK, indexurile, aplicarea migrațiilor și limitele.
5. Rulăm verificările disponibile, revizuim SQL și raportăm rezultate reale.

Presupuneri: proiect Supabase nou, PostgreSQL >= 15; rolurile standard Supabase și
`auth.users(id)` există deja. Nu modificăm schema gestionată `auth`. Migrațiile nu
se aplică automat și nu sunt executate pe un proiect conectat. Datele personale
nu devin accesibile aplicației înaintea etapei explicite de RLS/API.

Modificările necomise ale shell-ului și UI kitului sunt păstrate. Nu adăugăm
comunitate, billing sau funcționalități AI; `ai_requests` descrie doar persistența
cerută. Concurența pe un server Supabase real rămâne o verificare separată.
