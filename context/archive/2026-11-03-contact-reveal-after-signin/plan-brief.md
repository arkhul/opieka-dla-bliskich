# Odsłonięcie kontaktu opiekuna po zalogowaniu — Plan Brief

> Full plan: `context/changes/contact-reveal-after-signin/plan.md`

## What & Why

Wycinek S-03, north star: koordynator z publicznej listy przechodzi do profilu opiekuna, loguje się albo zakłada konto i widzi telefon oraz e-mail. To zamyka główne kryterium sukcesu PRD (kroki 3–4) i FR-012. Jednocześnie trzeba utrzymać strażnika: kontakt nie trafia do niezalogowanych ani do wyszukiwarek.

## Starting Point

S-01 rozdzieliło kontakt w RLS (`caregiver_contacts` czyta tylko właściciel) i dało zaufaną rolę w `public.accounts`. S-02 dało publiczną listę `/opiekunowie` z regułą kompletności w `caregiver_profile_missing()` i `noindex` na każdej odpowiedzi. Nie ma strony pojedynczego profilu, a logowanie i rejestracja przekierowują sztywno, gubiąc miejsce, z którego przyszedł użytkownik.

## Desired End State

Anonim klika kartę, widzi publiczny profil `/opiekunowie/<id>` i przycisk „Pokaż dane kontaktowe”. Chroniony `/kontakt/<id>` odsyła go do logowania z `next`. Po zalogowaniu albo rejestracji (rola koordynatora zaznaczona domyślnie) wraca na `/kontakt/<id>` i widzi klikalny numer i e-mail. Opiekun i konto bez roli widzą profil bez kontaktu. Profil niekompletny daje 404 i nie da się odczytać jego kontaktu nawet przez REST. Smoke to potwierdza.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Kto widzi kontakt | Tylko rola `coordinator` (plus właściciel swój) | Dosłownie FR-012 i Access Control z PRD; opiekunowie nie zbierają numerów konkurencji. |
| Model trasy | Publiczny `/opiekunowie/[id]` bez kontaktu + chroniony `/kontakt/[id]` | Reguła AGENTS.md „kontakt tylko na trasach chronionych” spełniona dosłownie; `/opiekunowie` nie może trafić do `PROTECTED_ROUTES`. |
| Powrót po logowaniu | Parametr `next` w middleware, logowaniu, rejestracji i confirm-email; jeden helper `safeNextPath` | Pełny krok 3→4 z PRD bez stanu po stronie serwera, z ochroną przed otwartym przekierowaniem. |
| Potwierdzanie e-maila | Działa w obu trybach bez `/auth/callback`; bez sesji → confirm-email z linkiem logowania niosącym `next` | Bez nowej trasy auth i konfiguracji produkcyjnego Supabase; PRD Open Question 1 zostaje otwarte. |
| Widoczność profilu | Tylko kompletne — 404 na obu stronach, a RLS koordynatora też wymaga kompletności | Jedna reguła w produkcie; kontakt profilu w trakcie zakładania jest niedostępny nawet przez REST. |
| Polityka RLS | Zastąpienie istniejącej polityki SELECT jedną: właściciel OR (koordynator AND kompletny) | AGENTS.md: jedna polityka na operację i rolę. |
| Rejestr odsłonięć | Brak w S-03 | PRD akceptuje, że jedna rejestracja otwiera wszystkie numery; bez nowych danych osobowych. |
| Forma kontaktu | `tel:` z `formatPlPhone`, `mailto:`, „Opiekun nie podał e-maila” | Jedno dotknięcie na telefonie (NFR mobilny), reużycie istniejącego formatera. |
| Testy | Rozszerzony `npm run smoke` (RLS, `next`, HTML stron, pełna ścieżka nowego koordynatora) | Ryzyko wycieku i otwartego przekierowania pilnowane w CI bez nowych narzędzi. |

## Scope

**In scope:**
- Migracja: zastąpiona polityka SELECT na `caregiver_contacts`, funkcja `get_public_caregiver()`
- `src/lib/redirect.ts`, `next` w middleware, logowaniu, rejestracji (domyślna rola koordynatora przy `/kontakt/`) i confirm-email
- `CaregiverContactDto`, serwis profilu i kontaktu, `CaregiverPublicDetails.astro`
- Strony `/opiekunowie/[id]` i `/kontakt/[id]` (w `PROTECTED_ROUTES`), linki z kart listy, 404
- Rozszerzenie `npm run smoke`, README

**Out of scope:**
- `/auth/callback`, konfiguracja potwierdzania e-maila w produkcji
- Rejestr odsłonięć, limity, kontakt dla opiekunów, profil koordynatora
- Dostępność (S-04), ranking (S-05), usuwanie profilu (S-06), Playwright, restyle

## Architecture / Approach

Baza → auth → strony. RLS jest jedyną bramką kontaktu: strona `/kontakt/[id]` czyta `caregiver_contacts` bez wcześniejszego sprawdzania roli, a rolę bierze pod uwagę tylko przy wyborze komunikatu, gdy kontaktu brak. Publiczna część profilu pochodzi z `get_public_caregiver()` (ta sama reguła kompletności co lista) i renderuje się przez komponent, który przyjmuje wyłącznie `PublicCaregiverDto`. Middleware chroni `/kontakt` i dokłada `next`; endpointy auth wracają na `next` po walidacji w jednym helperze.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Dostęp do kontaktu w bazie | Nowa polityka RLS, `get_public_caregiver()`, smoke REST (odwrócony krok koordynatora) | Zbyt szeroka polityka = wyciek; zepsuty upsert kontaktu u właściciela |
| 2. Powrót po logowaniu (`next`) | `safeNextPath`, `next` w całej ścieżce auth, smoke otwartego przekierowania | Otwarte przekierowanie przez `//` lub `/\` |
| 3. Strony profilu i kontaktu | `/opiekunowie/[id]`, `/kontakt/[id]`, linki z listy, pełny przepływ w smoke | Kontakt w HTML strony publicznej; kolejność sesji w smoke |

**Prerequisites:** S-01 i S-02 zamknięte (są); lokalny Supabase z wyłączonym potwierdzaniem e-maila do smoke.
**Estimated effort:** ~3 sesje, po jednej na fazę (faza 3 najdłuższa).

## Open Risks & Assumptions

- Przy włączonym potwierdzaniu e-maila w produkcji nowy koordynator loguje się jeden raz więcej (link z confirm-email niesie `next`); ścieżki bez sesji nie da się przetestować lokalnie smoke.
- Krok „list links to profile page” zakłada, że profil smoke jest na pierwszej stronie listy gminy 1465011 (najnowsze najpierw); lokalna baza gromadzi profile z poprzednich przebiegów.
- Jedno darmowe konto koordynatora otwiera wszystkie kontakty — świadomie akceptowane przez PRD; rejestr odsłonięć wraca, jeśli pojawi się scraping.
- Preview Workera korzysta z produkcyjnego Supabase (Open Roadmap Question 2) — testy wyłącznie lokalnie.

## Success Criteria (Summary)

- Nowy koordynator na telefonie przechodzi od listy do numeru opiekuna w jednej sesji: lista → profil → rejestracja → kontakt.
- Ani HTML strony publicznej, ani REST dla anonima, opiekuna czy koordynatora (przy profilu niekompletnym) nie zwraca kontaktu — potwierdza to smoke w CI.
- `next` zawsze wraca na lokalną ścieżkę; zewnętrzne cele są ignorowane.
