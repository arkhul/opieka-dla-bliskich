---
change_id: caregiver-profile-setup
title: Caregiver profile setup
status: impl_reviewed
created: 2026-11-03
updated: 2026-11-03
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Status (2026-11-03)

Wszystkie 5 faz zaimplementowane i zacommitowane (p4 `53bb039`, p5 `d6991c6`, epilog `5891c2e`). Wszystkie wiersze Progress `[x]` z SHA. Następny krok: `/10x-impl-review caregiver-profile-setup` (uruchamia użytkownik), potem `/10x-archive`.

Testy ręczne faz 4–5 wykonał agent (psql/curl, Claude in Chrome); 375 px sprawdzone w iframe 375 px (okna Chrome nie dało się zwęzić).

### Decyzje spoza planu (do przeglądu)

- `eslint.config.js`: `@typescript-eslint/no-misused-promises` wyłączone tylko dla `**/*.astro` — reguła crashuje ESLint na `return Astro.redirect(...)` we frontmatterze (zatwierdzone przez użytkownika).
- Strony `/profil` i `/profil/edycja` wysyłają `Cache-Control: private, no-store` (jak API) i zawierają `Topbar`.
- `PUT /api/caregiver/profile` zastępuje cały profil: pominięte `description`/`phone`/`email` → `null`, pominięte `gminas`/`services` → `[]`.
- Smoke: opcja `exact` dla dopasowania `location` (`"/"` przez `startsWith` pasowało do wszystkiego).

### Otwarte drobiazgi

- Formularz pokazuje podpowiedź „Telefon i e-mail nie są pokazywane publicznie.” — spoza planu; do usunięcia, jeśli niepożądana.
- README (sekcja smoke) nie wspomina kroków stron profilu z fazy 5.
