# Trwałe usunięcie profilu opiekuna — Plan Brief

> Full plan: `context/changes/caregiver-profile-deletion/plan.md`

## What & Why

Opiekun musi móc trwale usunąć swój profil razem z danymi kontaktowymi, a profil ma od razu zniknąć ze wszystkich wyników (PRD: NFR „trwałe usunięcie profilu”, FR-003; roadmap S-06). To ostatni slice kamienia milowego M-1. Daje opiekunowi kontrolę nad danymi, które udostępnił koordynatorom.

## Starting Point

Wszystkie tabele profilu (kontakt, gminy, usługi, dostępność) mają `on delete cascade` od `caregiver_profiles.user_id`, ale `caregiver_profiles` nie ma polityki ani grantu DELETE. Migracja S-01 celowo zostawiła to na później. API profilu ma `GET` i `PUT`, a `/profil` nie ma żadnej akcji usuwania.

## Desired End State

Na `/profil` opiekun klika „Usuń profil”, potwierdza w oknie dialogowym i trafia na `/profil?usunieto=1` z komunikatem „Profil został usunięty” nad pustym stanem „Utwórz profil”. Profil z wszystkimi danymi zależnymi znika z bazy, z listy `/opiekunowie` oraz ze stron `/opiekunowie/<id>` i `/kontakt/<id>` (404). Konto logowania zostaje.

## Key Decisions Made

| Decision           | Choice                                                     | Why (1 sentence)                                                                                        |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Zakres usuwania    | Sam profil z danymi zależnymi; konto i rola zostają        | Dokładne brzmienie PRD; jedna polityka pod RLS, bez `SECURITY DEFINER` na `auth` i bez nowego sekretu.   |
| Mechanizm          | Polityka DELETE dla właściciela + grant + kaskady FK       | Kaskady już istnieją i działają z uprawnieniami właściciela tabel, więc dane zależne znikają w jednym kroku. |
| Rodzaj usunięcia   | Twarde, natychmiastowe, bez cofnięcia                      | „Trwale” w PRD; widoczność jest liczona na żywo, więc nie ma cache'u do unieważniania.                   |
| Potwierdzenie      | Okno dialogowe shadcn (Anuluj / Usuń na zawsze)            | Gotowy `ui/dialog.tsx`, jedna mała wyspa, działa na telefonie.                                           |
| Po usunięciu       | `/profil?usunieto=1` z komunikatem nad pustym stanem       | Jasne potwierdzenie nieodwracalnej akcji z wykorzystaniem istniejącego stanu „Utwórz profil”.            |
| Odpowiedzi API     | 200 `{deleted:true}`, 404 przy braku profilu, 401/403/503 z `guard()` | `delete().select()` odróżnia „usunięto” od „nie było profilu”, bo RLS przy cudzym wierszu nie zgłasza błędu. |
| Testy              | Smoke: kroki REST (dostęp, kaskada) + kroki aplikacji, osobne konta „Dorota/Ewa Smoke” | Jedyny zestaw testów w repo; osobne profile nie psują pozostałych kroków.                              |

## Scope

**In scope:**

- Migracja `20261104160000_caregiver_profile_delete.sql` (polityka + grant DELETE)
- `deleteOwnProfile()` w serwisie, `DELETE /api/caregiver/profile`
- `DeleteProfileDialog.tsx` na `/profil` i komunikat po usunięciu
- Kroki smoke (REST i aplikacja), README
- Wdrożenie produkcyjne i weryfikacja na tymczasowym koncie (sprzątanym na końcu)

**Out of scope:**

- Usunięcie konta logowania (także dla koordynatorów)
- Miękkie usuwanie i okno na cofnięcie
- Czyszczenie kopii zapasowych i PITR
- Wpisywanie słowa w potwierdzeniu, log usunięć, powiadomienia

## Architecture / Approach

Baza robi całą pracę. `caregiver_profiles_delete_authenticated` (`using (user_id = auth.uid())`) i `grant delete` pozwalają właścicielowi usunąć wiersz, a kaskady FK czyszczą kontakt, gminy, usługi i dostępność. Aplikacja dostaje cienką warstwę: wyspa z oknem dialogowym → `fetch DELETE /api/caregiver/profile` → `guard()` → `deleteOwnProfile()` → przekierowanie na `/profil?usunieto=1`. Wdrożenie idzie w kolejności baza → Worker.

## Phases at a Glance

| Phase                     | What it delivers                                                        | Key risk                                                          |
| ------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Usuwanie w bazie       | Polityka + grant DELETE; smoke REST: tylko właściciel, kaskada, znika z wyników | Grant szerszy niż polityka (pilnuje krok smoke `anon` i ręczne 1.6; `check-table-grants.sql` sprawdza tylko TRUNCATE/REFERENCES/TRIGGER) |
| 2. Przycisk i API         | Endpoint, okno dialogowe, komunikat, smoke aplikacji, README            | Kolejność sesji w `jar` smoke'a (kroki na końcu listy)            |
| 3. Wdrożenie produkcyjne  | `db push` → `deploy`, przepływ na produkcji, sprzątnięte konto testowe   | Zapisy testowe na produkcji (tylko za zgodą, z usunięciem konta)   |

**Prerequisites:** S-01 i S-02 `done`; lokalny Supabase z wyłączonym potwierdzaniem e-maila (dla smoke); dostęp do `supabase --linked` i `wrangler` dla fazy 3.
**Estimated effort:** ~1 sesja na fazy 1–2 i krótka sesja na fazę 3.

## Open Risks & Assumptions

- Założenie: kaskada FK nie podlega RLS ani grantom tabel zależnych (zachowanie Postgresa). Smoke to dowodzi krokiem „deleted profile leaves no data”.
- Otwarta w innej karcie edycja może po usunięciu założyć profil od nowa. To akceptowane, bo jest akcją właściciela.
- E-mail logowania zostaje w `auth.users`. Pełne usunięcie konta to osobna zmiana.

## Success Criteria (Summary)

- Opiekun usuwa profil dwoma kliknięciami z `/profil` i widzi potwierdzenie.
- Usunięty profil nie pojawia się na liście, a jego strony publiczna i kontaktowa dają 404, lokalnie i na produkcji.
- W bazie nie zostaje żaden wiersz profilu ani danych zależnych, a nikt poza właścicielem nie może usunąć profilu.
