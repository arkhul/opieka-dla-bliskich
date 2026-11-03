# Publiczna lista opiekunów z filtrami gminy i usługi — Plan Brief

> Full plan: `context/changes/public-caregiver-search/plan.md`

## What & Why

Wycinek S-02: każdy — także bez logowania — przegląda listę opiekunów i zawęża ją po gminie i rodzaju usług, bez dostępu do danych kontaktowych. To pierwsza strona publiczna portalu i pierwszy krok przepływu z PRD („koordynator przegląda opiekunów, filtrując po gminie i rodzaju usługi — bez logowania”), więc tutaj najłatwiej o wyciek kontaktu przez szeroki select albo indeksowanie.

## Starting Point

S-01 dał tabele profili z rozdziałem w RLS (część publiczna czytelna dla `anon`, kontakt tylko dla właściciela) i regułę kompletności w jednej funkcji SQL `caregiver_profile_missing()`. Strona główna to wciąż starter po angielsku, nie ma żadnej listy, a host `*.workers.dev` jest indeksowalny.

## Desired End State

Anonim przechodzi z `/` przez „Znajdź opiekuna” na `/opiekunowie`, wybiera gminę i usługi, a adres URL opisuje cały stan filtrów. Widzi tylko kompletne profile — od ostatnio aktualizowanych, po 20 na stronę — i może zdejmować filtry pojedynczo. Pusty wynik wyjaśnia przyczynę i podaje linki typu „Usuń filtr usług (wyniki: 3)”. Telefonu ani e-maila nie ma w HTML-u ani w odpowiedzi bazy, a każda odpowiedź ma `X-Robots-Tag: noindex`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Kilka wybranych usług | Profil musi mieć **wszystkie** wybrane (AND) | Dosłowne znaczenie filtra z US-01; S-05 zamieni usługi w miękki ranking z oznaczeniem braków. |
| Gmina | Jedna gmina, warunek twardy, tylko aktywne | PRD: gmina osoby pod opieką, dojazd to ograniczenie fizyczne. |
| Trasa | `/opiekunowie` + polska strona główna z linkiem „Znajdź opiekuna” | Czyste, udostępnialne adresy filtrów, a `/` przestaje być starterem. |
| Strona pojedynczego profilu | Poza zakresem — pełne karty na liście; `/opiekunowie/[id]` w S-03 | Podział publiczne/chronione na stronie profilu powstaje w jednej zmianie razem z odsłonięciem kontaktu. |
| Indeksowanie | `X-Robots-Tag: noindex` na każdej odpowiedzi SSR, bez `robots.txt Disallow` | Strażnik PRD na `*.workers.dev`; `Disallow` ukryłby nagłówek przed crawlerem. Wraca do decyzji przy starcie. |
| Kolejność i strony | `updated_at desc`, 20 na stronę, `?strona=N` | Świeże profile najpierw (PRD obawia się nieaktualnych danych), działa bez JS, tanio dla CPU Workera. |
| Pusty wynik | Linki zdejmujące jeden wymiar filtra z liczbą wyników po zdjęciu | Mówi wprost, który filtr blokuje (wymóg US-01). |
| Reguła kompletności (F7) | `search_caregivers()` `security invoker` reużywa `caregiver_profile_missing()`; grant `anon` zostaje | Jedno źródło reguły, RLS nadal pilnuje odczytów, bez N+1; lista i tak ujawnia kompletność. |
| API | Bez publicznego endpointu JSON — strona SSR woła serwis | Mniejsza powierzchnia publiczna. |
| Stan filtrów | Parametry URL + formularz `GET`; chipy to linki bez jednego parametru | „Zdjęcie jednego filtra nie kasuje pozostałych” bez stanu po stronie klienta. |
| Testy | Rozszerzony smoke: RPC jako anon + strona po wylogowaniu (HTML i nagłówki) | Ryzyko wycieku i semantyka filtrów pilnowane w CI bez nowych narzędzi. |

## Scope

**In scope:**
- Migracja `search_caregivers()` (kompletność, gmina, usługi AND, kolejność, strony, `total_count`)
- Serwis listy, `getActiveGmina`, helpery parsowania/adresów, typ `PublicCaregiverDto`
- Strona `/opiekunowie`: formularz, chipy, karty, stronicowanie, puste stany z podpowiedziami
- `GminaSelect` (pojedynczy wybór) + hook `useGminaSearch` współdzielony z `GminaPicker`
- `noindex` w middleware; polska strona główna, link w Topbarze, tytuł aplikacji
- Rozszerzenie `npm run smoke` i README

**Out of scope:**
- Strona pojedynczego profilu i kontakt (S-03), dostępność (S-04), ranking (S-05)
- Publiczne API JSON, `robots.txt`, sitemap, zmiany RLS
- Sortowanie wybierane przez użytkownika, wyszukiwanie po imieniu, wiele gmin w filtrze, restyle

## Architecture / Approach

Baza liczy wszystko: `search_caregivers()` stosuje regułę kompletności, filtry, kolejność, limit i liczbę dopasowań, zwracając wyłącznie kolumny publiczne. `caregiver.service.ts` mapuje wynik na `PublicCaregiverDto`. Strona `.astro` czyta filtry z URL (`src/lib/caregiver-search.ts`), renderuje formularz `GET` z wyspą React `GminaSelect` i natywnymi checkboxami usług. Przy pustym wyniku woła tę samą funkcję z jednym wymiarem zdjętym. Middleware dokłada `X-Robots-Tag: noindex`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Zapytanie wyszukiwania w bazie | `search_caregivers()` + smoke RPC jako anon | `total_count` liczony po limicie albo kolumna kontaktowa w wyniku — smoke to wyłapuje (drugi kompletny opiekun w smoke, kontaktowy e-mail w profilu) |
| 2. Publiczna lista z filtrami | `/opiekunowie`, `GminaSelect`, `noindex`, smoke strony | Refaktor wyszukiwania zmienia zachowanie `GminaPicker`; użyteczność filtrów na 375 px |
| 3. Wejścia do listy | Polska strona główna, link w Topbarze, tytuł, README | Niewielkie — zmiany treści |

**Prerequisites:** F-01 i S-01 zamknięte (są); lokalny Supabase z wyłączonym potwierdzaniem e-maila do smoke.
**Estimated effort:** ~3 sesje, po jednej na fazę (faza 2 najdłuższa, 3 krótka).

## Open Risks & Assumptions

- Lokalna baza gromadzi profile smoke z poprzednich przebiegów w gminie 1465011; kroki smoke szukają profilu po `caregiverId` w `p_limit: 50`, co zakłada mniej niż 50 równoległych przebiegów.
- Do czasu S-05 wybranie wielu usług szybko daje zero wyników — łagodzą to podpowiedzi z liczbami.
- Ktoś może „podbić” profil na górę ponownym zapisem; akceptowalne, bo S-05 zastępuje kolejność.
- S-03 nie może dodać `/opiekunowie` do `PROTECTED_ROUTES` (dopasowanie przez `startsWith`) — stronę z kontaktem trzeba chronić inaczej albo pod inną ścieżką.
- Preview Workera korzysta z produkcyjnego Supabase (Open Roadmap Question 2) — testy wyłącznie lokalnie.

## Success Criteria (Summary)

- Anonim od strony głównej dochodzi do listy kompletnych opiekunów w wybranej gminie z wybranymi usługami, na telefonie i po polsku.
- Pusty wynik nigdy nie jest ślepą uliczką: widać, który filtr zdjąć i ile wyników to da.
- Ani HTML, ani odpowiedź bazy dla anonima nie zawiera kontaktu, a strony mają `noindex` — potwierdza to smoke w CI.
