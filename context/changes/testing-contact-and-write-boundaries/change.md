---
change_id: testing-contact-and-write-boundaries
title: Granice kontaktu i zapisów (test rollout Phase 3)
status: implementing
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Notes

Rollout Phase 3 of `context/foundation/test-plan.md` §3: "Granice kontaktu i zapisów".
Goal: zmapować istniejący smoke na ryzyka #3, #4, #6 i domknąć luki tam, gdzie sprawdzenie
nie wyłapałoby wycieku, nadużycia lub utraty danych. Test types planned: integration.

Risks covered:
- #3 — Dane kontaktowe opiekuna (telefon, e-mail) docierają do osoby niezalogowanej:
  przez HTML strony publicznej, publiczne API, bezpośredni dostęp do bazy lub indeks
  wyszukiwarki.
- #4 — Nadużycie: zalogowany użytkownik zmienia, usuwa lub masowo czyta cudze dane
  z pominięciem aplikacji, albo nowa tabela trafia na produkcję z domyślnymi uprawnieniami.
- #6 — Zapis profilu po cichu gubi wcześniej zapisane dane (terminy, gminy, usługi),
  przez co opiekun znika z filtrów.

Risk response intent (from test-plan.md §2 Risk Response Guidance):
- #3: prove telefon i e-mail opiekuna nie występują w żadnej odpowiedzi dla osoby
  niezalogowanej (HTML, API, baza), a występują na chronionej stronie kontaktu dla
  zalogowanego koordynatora; challenge "strona nie pokazuje pola, więc danych nie ma"
  (mogą siedzieć w JSON lub atrybutach); avoid sprawdzanie nieobecności po fragmencie,
  który nie wystąpiłby nawet przy wycieku.
- #4: prove inny opiekun i koordynator nie zmieniają ani nie usuwają cudzego profilu
  bezpośrednio przez API bazy, a żadna tabela nie ma domyślnych uprawnień ALL; challenge
  "aplikacja na to nie pozwala, więc baza też nie"; avoid testowanie wyłącznie przez
  endpoint aplikacji.
- #6: prove edycja jednego pola profilu zostawia pozostałe zapisane dane bez zmian;
  challenge "zapis zwrócił 200, więc dane są całe"; avoid sprawdzanie tylko pola, które
  edytowano.

Likely cheapest layer for all three: integration (`scripts/smoke.mjs`, partly existing
for #3; new direct-to-database checks needed for #4).
