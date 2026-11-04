---
change_id: dictionaries-review-cleanup
title: Domknięcie otwartych ustaleń z przeglądu F-01 i porządki w roadmapie
status: implemented
created: 2026-11-03
updated: 2026-11-04
archived_at: null
---

## Notes

Zmiana porządkowa po wdrożeniu S-01…S-03 na produkcję (2026-11-03). Zakres:

- Otwarte ustalenia z `context/archive/2026-09-24-gmina-and-service-dictionaries/reviews/impl-review.md` (`Decision: PENDING`), stan sprawdzony w kodzie 2026-11-03:
  - F3 — `catch {}` bez logowania w `src/pages/api/dictionaries/gminas.ts:41` i `services.ts:14`.
  - F4 — brak `revoke insert, update, delete, truncate` na `public.gminas` i `public.services` dla `anon`/`authenticated`.
  - F5 — middleware woła `getUser()` przy każdym zapytaniu `/api/dictionaries/` (autocomplete gmin).
  - F6 — README:221 nadal opisuje smoke jako „whole auth flow”.
  - F8 — `scripts/smoke.mjs` bez try/catch wokół kroku: błąd sieci/JSON daje wyjątek zamiast FAIL.
  - F7 już zrobione (`20261103120000_retirable_gminas.sql`), F1/F2 zamknęła zmiana `gminas-generator-upsert`.
- Zaktualizować decyzje F3–F8 w archiwalnym przeglądzie F-01.
- `roadmap.md`: tabela „Backlog Handoff” (S-04, S-06 gotowe do `/10x-plan`) oraz notatka, że przepływ PRD §Success Criteria (kroki 1–4) przeszedł na wdrożonym Workerze 2026-11-03.
