---
project: "Opieka dla bliskich"
version: 1
status: draft
created: 2026-09-24
updated: 2026-09-24
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: first-matched-contact
milestone_seq: 1
milestone_status: open
---

# Roadmap: Opieka dla bliskich

> Derived from `context/foundation/prd.md` (v1) + `tech-stack.md` + `infrastructure.md` + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Koordynator znajduje dopasowanego opiekuna i jego kontakt** — Status: open

- **Intent:** Na wdrożonej wersji działa pełny przepływ z głównego kryterium sukcesu PRD: opiekun publikuje profil, koordynator bez logowania filtruje i przegląda uszeregowane wyniki, a po założeniu konta widzi dane kontaktowe dopasowanej osoby.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`, a przepływ z PRD §Success Criteria → Primary (kroki 1–4) przechodzi na wdrożonym Workerze.
- **Scope anchors:** wszystkie konieczne wymagania PRD — FR-001…FR-012, FR-016 — oraz US-01. Wymagania nice-to-have (FR-013, FR-014, FR-015) są poza tym kamieniem milowym (zob. `## Parked`).

## Vision recap

Rodzinny koordynator opieki — np. córka organizująca stałą opiekę dla matki po wylewie — nie ma jednego miejsca, w którym zobaczy, kto realnie może pomóc, gdzie dojeżdża i kiedy jest wolny; dziś ustala to dziesiątkami telefonów i przeglądaniem grup. Portal pokazuje opiekunów od razu z terenem dojazdu (gminą), usługami i dostępnością, szereguje ich według dopasowania do potrzeby i odsłania kontakt dopiero po zalogowaniu. Portal jest wyłącznie pośrednikiem: dalszy kontakt, ustalenia i rozliczenia odbywają się poza nim.

## North star

**S-03: Koordynator filtruje opiekunów po gminie i usłudze, zakłada konto i widzi dane kontaktowe wybranego opiekuna** — to dosłownie kroki 2–4 głównego kryterium sukcesu i US-01; przy celu `speed` ustawiamy go tak wcześnie, jak pozwalają zależności, bo dopiero on pokazuje, że portal zastępuje telefony.

> „North star” oznacza tu najmniejszy kompletny przepływ, którego dostarczenie udowadnia główną hipotezę produktu — dlatego stoi tak wcześnie, jak pozwalają jego warunki wstępne, bo wszystko inne ma sens tylko wtedy, gdy on działa.

## At a glance

| ID   | Change ID                      | Outcome (user can …)                                                                  | Prerequisites | PRD refs                                  | Status   |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------- | ----------------------------------------- | -------- |
| F-01 | gmina-and-service-dictionaries | (foundation) słownik gmin i zamknięty katalog usług są dostępne w aplikacji            | —             | FR-005, FR-006, FR-009, FR-010            | in-progress |
| S-01 | caregiver-profile-setup        | opiekun zakłada konto i publikuje profil z kontaktem, gminami i usługami               | F-01          | FR-001, FR-003, FR-004, FR-005, FR-006    | proposed |
| S-02 | public-caregiver-search        | każdy bez logowania przegląda listę opiekunów i filtruje ją po gminie i usłudze        | F-01, S-01    | US-01, FR-008, FR-009, FR-010             | proposed |
| S-03 | contact-reveal-after-signin    | koordynator zakłada konto i widzi dane kontaktowe opiekuna                             | S-01, S-02    | US-01, FR-002, FR-012                     | proposed |
| S-04 | caregiver-availability-filter  | opiekun ustawia dostępność (dni tygodnia × pory dnia), a koordynator po niej filtruje  | S-01, S-02    | FR-007, FR-011                            | proposed |
| S-05 | ranked-match-results           | koordynator widzi wyniki uszeregowane według dopasowania, z oznaczeniem braków         | S-02, S-04    | US-01, FR-016                             | proposed |
| S-06 | caregiver-profile-deletion     | opiekun trwale usuwa swój profil i znika on ze wszystkich wyników                      | S-01, S-02    | FR-003                                    | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                                  | Note                                                                                   |
| ------ | ----------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| A      | Od profilu do kontaktu  | `F-01` → `S-01` → `S-02` → `S-03`      | Najkrótsza ścieżka do north star — przy celu `speed` idzie jako pierwsza.              |
| B      | Dopasowanie             | `S-04` → `S-05`                        | Dołącza do strumienia A w `S-02`; może iść równolegle z `S-03`.                        |
| C      | Kontrola nad danymi     | `S-06`                                 | Dołącza do strumienia A w `S-02`; niezależny od B, można go zrównoleglić z `S-03`–`S-05`. |

## Baseline

What's already in place in the codebase as of `2026-09-24` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 7 SSR + React 19 islands + Tailwind 4 + shadcn/ui (per tech-stack.md); w kodzie tylko strony startera (`src/pages/index.astro`, `src/pages/auth/*`, `src/pages/dashboard.astro`).
- **Backend / API:** partial — trasy API wyłącznie dla auth (`src/pages/api/auth/{signin,signup,signout}.ts`); brak warstwy `src/lib/services/` i endpointów domenowych.
- **Data:** partial — klient Supabase gotowy (`src/lib/supabase.ts`), `supabase/config.toml`; brak `supabase/migrations/`, zero tabel domenowych i polityk RLS.
- **Auth:** partial — rejestracja i logowanie e-mail/hasło przez Supabase, middleware z `PROTECTED_ROUTES` (`src/middleware.ts`); brak rozróżnienia ról opiekun / koordynator; potwierdzanie e-maila wyłączone w lokalnej konfiguracji.
- **Deploy / infra:** partial — Worker skonfigurowany (`wrangler.jsonc`, `session: false`), pierwszy ręczny deploy wykonany; CI uruchamia lint, type check, build i smoke; brak joba auto-deploy i nagłówka noindex dla `*.workers.dev`.
- **Observability:** partial — Workers Logs włączone (`observability.enabled` w `wrangler.jsonc`); brak śledzenia błędów.

## Foundations

### F-01: Słowniki gmin i usług

- **Outcome:** (foundation) słownik gmin i zamknięty katalog rodzajów usług są dostępne w aplikacji jako wspólne listy wyboru — tylko dane referencyjne, bez tabel profili.
- **Change ID:** gmina-and-service-dictionaries
- **PRD refs:** FR-005, FR-006, FR-009, FR-010 (te same słowniki zasilają edycję profilu i filtry — PRD §Business Logic wymaga, by potrzeba i profil używały tych samych pól)
- **Unlocks:** S-01 (opiekun wybiera gminy i usługi z list), S-02 (filtry gminy i usługi działają na tych samych wartościach)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Zakres słownika gmin — cała Polska czy region startowy? — Owner: user. Block: no.
  - Treść zamkniętego katalogu usług (PRD utrzymał zamknięty słownik, ale nie wymienia pozycji) — `/10x-plan` przygotuje projekt listy do akceptacji. — Owner: user. Block: no.
- **Risk:** Wydzielone, bo obie strony rynku muszą mówić tymi samymi wartościami — rozjazd słowników między profilem a filtrem po cichu zeruje wyniki; zakres ograniczony do danych referencyjnych, żeby nie budować z wyprzedzeniem warstwy danych.
- **Status:** in-progress

## Slices

### S-01: Opiekun zakłada konto i publikuje profil

- **Outcome:** opiekun zakłada konto, loguje się, uzupełnia dane kontaktowe, obsługiwane gminy i oferowane usługi, a następnie widzi swój profil.
- **Change ID:** caregiver-profile-setup
- **PRD refs:** FR-001, FR-003, FR-004, FR-005, FR-006
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy rejestracja wymaga potwierdzenia e-maila (PRD Open Question 1)? Planowanie może ruszyć na obecnej konfiguracji bez potwierdzenia. — Owner: user. Block: no.
- **Risk:** Tu po raz pierwszy zapisujemy dane kontaktowe, więc już w tym wycinku muszą być oddzielone od publicznej części profilu regułami dostępu w bazie — dokładanie tego później oznacza migrację danych, które już wyciekały do publicznych zapytań.
- **Status:** proposed

### S-02: Publiczna lista opiekunów z filtrami gminy i usługi

- **Outcome:** każdy — także bez logowania — przegląda listę opiekunów i zawęża ją po gminie i rodzaju usługi; widzi profile bez danych kontaktowych.
- **Change ID:** public-caregiver-search
- **PRD refs:** US-01, FR-008, FR-009, FR-010
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Czy publiczne strony profili (bez kontaktu) mają być indeksowane przez wyszukiwarki, czy tylko sama lista? — Owner: user. Block: no.
- **Risk:** Pierwsza strona publiczna — tutaj najłatwiej o wyciek kontaktu przez szeroki select lub sitemapę; kryteria akceptacji US-01 (komunikat przy braku wyników, filtry łączone i zdejmowane pojedynczo, profil bez gminy niewidoczny) wchodzą w ten wycinek, a nie później.
- **Status:** proposed

### S-03: Odsłonięcie kontaktu po zalogowaniu

- **Outcome:** koordynator z listy przechodzi do profilu, zakłada konto lub loguje się i widzi dane kontaktowe opiekuna.
- **Change ID:** contact-reveal-after-signin
- **PRD refs:** US-01, FR-002, FR-012
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-04, S-06
- **Blockers:** —
- **Unknowns:**
  - Czy rejestracja wymaga potwierdzenia e-maila (PRD Open Question 1)? Wpływa na to, czy kontakt odsłania się od razu po rejestracji. — Owner: user. Block: no.
- **Risk:** To north star — zamyka główne kryterium sukcesu; dane kontaktowe mogą trafić wyłącznie na trasę chronioną, a publiczny host `*.workers.dev` nie może ich wystawić wyszukiwarkom.
- **Status:** proposed

### S-04: Dostępność opiekuna i filtr po dostępności

- **Outcome:** opiekun ustawia swoją dostępność w dniach tygodnia i porach dnia, a koordynator zawęża listę po dostępności razem z gminą i usługą.
- **Change ID:** caregiver-availability-filter
- **PRD refs:** FR-007, FR-011
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-03, S-06
- **Blockers:** —
- **Unknowns:**
  - Jakie pory dnia rozróżniamy (np. rano / popołudnie / wieczór / noc)? — Owner: user. Block: no.
- **Risk:** Wymiar dostępności przechodzi przez obie strony rynku naraz (edycja i filtr), więc dostarczamy go jako jeden pionowy wycinek; bez niego ranking z S-05 ma tylko jeden miękki wymiar.
- **Status:** proposed

### S-05: Wyniki uszeregowane według dopasowania

- **Outcome:** koordynator widzi listę posortowaną od profilu najpełniej pokrywającego potrzebę (gmina twardo, usługi ważą najwięcej, dostępność miękko), a przy każdym profilu widzi, czego w nim brakuje.
- **Change ID:** ranked-match-results
- **PRD refs:** US-01, FR-016
- **Prerequisites:** S-02, S-04
- **Parallel with:** S-03, S-06
- **Blockers:** —
- **Unknowns:**
  - Czy plan Workers Free (10 ms CPU na żądanie) wystarczy, czy od razu przejść na Paid? Decyzja po pomiarze czasu CPU. — Owner: user. Block: no.
- **Risk:** Reguła domenowa i wyróżnik produktu; musi liczyć się po stronie bazy, żeby zmieścić się w NFR „poniżej 1 sekundy” i nie przekroczyć limitu CPU Workera przy rosnącym katalogu.
- **Status:** proposed

### S-06: Trwałe usunięcie profilu opiekuna

- **Outcome:** opiekun trwale usuwa swój profil wraz z danymi kontaktowymi, a profil przestaje pojawiać się w jakichkolwiek wynikach.
- **Change ID:** caregiver-profile-deletion
- **PRD refs:** FR-003 (akcja dostępna z widoku własnego profilu); PRD §Non-Functional Requirements — trwałe usunięcie profilu
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-03, S-04, S-05
- **Blockers:** —
- **Unknowns:**
  - Czy usunięcie profilu usuwa też konto logowania, czy tylko profil i kontakt? — Owner: user. Block: no.
- **Risk:** Niezależny od ścieżki do north star, więc idzie równolegle; weryfikacja wymaga istniejącej listy (S-02), żeby potwierdzić, że profil znika z wyników.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                      | Suggested issue title                                        | Ready for `/10x-plan` | Notes                                           |
| ---------- | ------------------------------ | ------------------------------------------------------------ | --------------------- | ----------------------------------------------- |
| F-01       | gmina-and-service-dictionaries | Słowniki gmin i usług jako wspólne listy wyboru              | yes                   | Run `/10x-plan gmina-and-service-dictionaries`  |
| S-01       | caregiver-profile-setup        | Opiekun zakłada konto i publikuje profil                     | no                    | Czeka na F-01                                   |
| S-02       | public-caregiver-search        | Publiczna lista opiekunów z filtrami gminy i usługi          | no                    | Czeka na F-01, S-01                             |
| S-03       | contact-reveal-after-signin    | Koordynator widzi kontakt opiekuna po zalogowaniu            | no                    | Czeka na S-01, S-02; north star                 |
| S-04       | caregiver-availability-filter  | Dostępność opiekuna i filtr po dostępności                   | no                    | Czeka na S-01, S-02                             |
| S-05       | ranked-match-results           | Ranking wyników według dopasowania z oznaczeniem braków      | no                    | Czeka na S-02, S-04                             |
| S-06       | caregiver-profile-deletion     | Opiekun trwale usuwa swój profil                             | no                    | Czeka na S-01, S-02                             |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

1. **Potwierdzanie rejestracji** — czy założenie konta wymaga potwierdzenia adresu e-mail? (PRD Open Question 1) — Owner: user. Block: S-01, S-03 (nie blokuje planowania; domyślnie obecna konfiguracja bez potwierdzenia, której wymaga też `npm run smoke`).
2. **Oddzielne środowisko testowe** — wersje preview Workera używają produkcyjnego projektu Supabase (`infrastructure.md` § Risk Register); czy przed testami na preview potrzebny jest osobny projekt Supabase? — Owner: user. Block: roadmap-wide (nie blokuje planowania; do czasu decyzji żadnych zapisów testowych przez preview).

## Parked

- **Płatności i rozliczenia w portalu** — Why parked: PRD §Non-Goals.
- **Kalendarz rezerwacyjny** — Why parked: PRD §Non-Goals; dostępność jest informacją, nie zobowiązaniem.
- **Weryfikacja i moderacja opiekunów** — Why parked: PRD §Non-Goals.
- **Wiadomości wewnątrz portalu** — Why parked: PRD §Non-Goals; kontakt odbywa się poza systemem.
- **FR-013: profil koordynatora** — Why parked: nice-to-have; przy celu `speed` i ryzyku `time` poza pierwszym kamieniem milowym.
- **FR-014: opiekun przegląda zgłoszenia koordynatorów** — Why parked: nice-to-have; wraca razem ze zgłoszeniem potrzeby i automatycznym dopasowaniem.
- **FR-015: powiadomienia o nowym profilu w gminie** — Why parked: nice-to-have; wymaga osobnego workera lub kolejki (`tech-stack.md`).
- **Automatyczne wdrożenie po scaleniu do master** — Why parked: produkcyjny deploy wymaga człowieka (`infrastructure.md` § Operational Story → Approval); ręczny `wrangler deploy` wystarcza przy celu `speed`.
- **Śledzenie błędów poza Workers Logs** — Why parked: brak NFR, który by go wymuszał; Workers Logs już włączone.
- **Ranking oparty na reputacji lub historii współpracy** — Why parked: PRD §Vision — potrzebny dopiero przy znacznie większym katalogu.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived.)
