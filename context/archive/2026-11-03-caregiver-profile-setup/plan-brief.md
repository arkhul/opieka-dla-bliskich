# Opiekun zakłada konto i publikuje profil — Plan Brief

> Full plan: `context/changes/caregiver-profile-setup/plan.md`

## What & Why

Wycinek S-01: opiekun zakłada konto, uzupełnia dane kontaktowe, obsługiwane gminy i oferowane usługi, a potem widzi swój profil. To pierwszy zapis danych kontaktowych w systemie, więc ich rozdział od publicznej części profilu musi być wymuszony w bazie już teraz. Dokładanie tego później oznaczałoby migrację danych, które już wyciekały do publicznych zapytań.

## Starting Point

Działa logowanie e-mail/hasło bez ról (strony startera po angielsku) i publiczne słowniki gmin i usług z API autocomplete. W bazie nie ma żadnych tabel profili. Generator gmin umie wycofywać gminy, ale nie ma jeszcze czego przepinać.

## Desired End State

Opiekun rejestruje się po polsku z rolą, trafia od razu do formularza, zapisuje profil (także częściowo) i na `/profil` widzi swoje dane oraz listę braków albo informację „Profil jest kompletny”. Anonim i koordynator nie mogą odczytać kontaktu opiekuna nawet bezpośrednio przez API Supabase, a smoke w CI to udowadnia. Odświeżenie gmin przepina profile na aktywnych następców.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Model ról | Rola wybierana przy rejestracji, trigger kopiuje ją do `public.accounts` (bez polityk zapisu) | Rola jest zaufana w RLS, a S-03 użyje jej bez zmian; `user_metadata` użytkownik może edytować sam. |
| Dane kontaktowe | Telefon (polski, zapisywany jako `+48XXXXXXXXX`) + opcjonalny e-mail (domyślnie e-mail konta) | Minimum danych zgodne z PRD; lokalizację opisują gminy, więc adres nie jest potrzebny. |
| „Publikacja” | Bez przełącznika: profil jest kompletny przy imieniu, telefonie, ≥1 aktywnej gminie i ≥1 usłudze; zapis częściowy dozwolony | Zgodne z US-01; reguła żyje w jednej funkcji SQL, której użyje też S-02. |
| Widoczność w S-01 | Część publiczna czytelna anonimowo od razu, kontakt tylko dla właściciela | Rozdział jest sprawdzany już teraz, a S-02 nie musi zmieniać RLS; S-03 otworzy kontakt zalogowanym. |
| Klucz profilu | `caregiver_profiles.user_id` = `auth.users.id` | Polityki sprowadzają się do `= auth.uid()`, bez złączeń. |
| Zapis | Jedna funkcja SQL `save_caregiver_profile` (`security invoker`) | Wymiana list gmin i usług jest atomowa i podlega RLS wywołującego. |
| Po rejestracji/logowaniu | Opiekun → `/profil/edycja` / `/profil`; koordynator → `/`; bez sesji → confirm-email | Najkrótsza droga do celu wycinka i działa przy obu ustawieniach potwierdzania e-maila. |
| UI | Polskie strony profilu i auth (z Topbarem), styl startera bez zmian | Jeden język na całej ścieżce opiekuna, bez prac projektowych (restyle osobno przez `/10x-ui`). |
| Walidacja | Imię 2–60, opis ≤1000, ≤30 gmin, usługi tylko z katalogu, tylko aktywne gminy | Limity chronią przyszłą listę publiczną przed śmieciami; numery zagraniczne są odrzucane. |
| Przepinanie gmin | Najpierw wstaw powiązanie z aktywnym następcą (`on conflict do nothing`), potem usuń stare | Nie łamie klucza głównego, gdy opiekun ma już następcę; bez aktywnego następcy powiązanie zostaje do ręcznego rozstrzygnięcia. |
| Testy | Rozszerzony smoke: przepływ API i stron + bezpośrednie zapytania REST Supabase jako anon i koordynator | Ryzyko wycieku jest pilnowane w CI bez nowych narzędzi. |

## Scope

**In scope:**
- Migracja: `accounts` + trigger, `caregiver_profiles`, `caregiver_contacts`, `caregiver_gminas`, `caregiver_services`, RLS, RPC zapisu, funkcja kompletności
- Krok przepinania profili w generatorze gmin + README
- Rejestracja z rolą, przekierowania, polskie strony auth, Topbar, `lang="pl"`
- `GET`/`PUT /api/caregiver/profile`, `/profil`, `/profil/edycja`, wybór gmin z autocomplete
- Rozszerzenie `npm run smoke`

**Out of scope:**
- Publiczna lista i filtry (S-02), odsłonięcie kontaktu (S-03), dostępność (S-04), usuwanie profilu (S-06)
- Profil koordynatora, zmiana roli, uzupełnianie ról dla starych kont
- Konfiguracja potwierdzania e-maila, numery zagraniczne, adres, nowy wygląd UI

## Architecture / Approach

Kolejność: baza → generator → auth → API → UI. Baza wymusza rozdział danych (RLS per operacja i rola). Endpointy idą według istniejącego wzorca: zod → `createClient` (null → 503) → serwis → JSON. Strony `.astro` czytają dane przez `caregiver.service.ts`, a interaktywny formularz to wyspa React z comboboxem shadcn (`Popover` + `Command`), korzystającym z istniejącego API gmin.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schemat profilu i ról | Tabele, RLS, trigger roli, RPC zapisu i kompletności | Błąd w triggerze blokuje każdą rejestrację; brak RLS = wyciek przez domyślne granty Supabase |
| 2. Przepinanie w generatorze | Profile przechodzą na aktywnego następcę przy odświeżeniu TERC | Konflikt klucza głównego przy duplikatach; brak automatycznego testu (scenariusz ręczny) |
| 3. Role w auth | Rejestracja z rolą, przekierowania, polskie UI auth | Mapowanie komunikatów Supabase na polski może nie objąć wszystkich przypadków |
| 4. API profilu | `GET`/`PUT` z walidacją, smoke z dowodem RLS | Smoke zależy teraz od `SUPABASE_URL`/`KEY` w `.env` |
| 5. Strony profilu | Podgląd z brakami, formularz z wyborem gmin | Dostępność comboboxa i użyteczność na telefonie |

**Prerequisites:** F-01 i `gminas-generator-upsert` zamknięte (są); lokalny Supabase z wyłączonym potwierdzaniem e-maila do smoke.
**Estimated effort:** ~4–5 sesji, po jednej na fazę (fazy 1 i 2 krótsze, 5 najdłuższa).

## Open Risks & Assumptions

- Zakładamy, że produkcyjny projekt Supabase ma rejestrację zgodną z lokalną konfiguracją; jeśli ma włączone potwierdzanie e-maila, opiekun przejdzie przez `/auth/confirm-email` i zaloguje się później.
- Rejestracja koordynatora (rola) pojawia się już teraz, ale jej wartość (odsłonięcie kontaktu) przychodzi dopiero w S-03.
- Konta utworzone przed migracją (np. testowe na produkcji) zostają bez roli.
- Preview Workera korzysta z produkcyjnego Supabase (Open Roadmap Question 2) — testy zapisu wyłącznie lokalnie.

## Success Criteria (Summary)

- Nowy opiekun przechodzi od rejestracji do kompletnego profilu w jednej sesji, po polsku, także na telefonie.
- Kontakt opiekuna jest niedostępny dla anonima i innych zalogowanych — potwierdza to smoke w CI.
- Odświeżenie gmin nie zrywa profili: przepina je na aktywnych następców albo raportuje, co wymaga decyzji.
