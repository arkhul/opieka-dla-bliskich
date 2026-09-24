---
name: 10x-archive
description: Archive a completed change by moving its folder into context/archive/ and stamping change.md with archived status
argument-hint: "<change-id-or-path>"
allowed-tools:
  - Read
  - Glob
  - Edit
  - Bash
  - AskUserQuestion
---
# /10x-archive — Zamknij zmianę

Przenieś folder ukończonej zmiany z `context/changes/<change-id>/` do `context/archive/<created-date>-<change-id>/`, oznacz `change.md` za pomocą `status: archived` + `archived_at`, użyj `git mv`, aby historia plików została zachowana, oraz — jeśli `context/foundation/roadmap.md` zawiera element roadmapy, którego `Change ID` równa się `<change-id>` — zamknij również ten element: zmień jego `Status` na `done` i dodaj wpis do sekcji `## Done` roadmapy.

Bramka jest **łagodna i wyłącznie ostrzegawcza** — `/10x-archive` blokuje przy niezatwierdzonych zmianach wewnątrz folderu zmiany lub przy istniejących wcześniej zmianach staged. Wszystko inne (nieukończony Progress, brak impl-review, status spoza `{implemented, impl_reviewed}`) jest zgłaszane jako ostrzeżenie, po którym następuje monit o potwierdzenie; użytkownik nadal może zarchiwizować.

Po archiwizacji każda inna umiejętność 10x odmawia zapisu wewnątrz `context/archive/<...>/` (każda chroniona umiejętność sprawdza rozstrzygnięty prefiks ścieżki i przerywa z ustalonym komunikatem). Zarchiwizowane foldery są umownie tylko do odczytu.

## Początkowa odpowiedź

Gdy to polecenie zostanie wywołane:

1. **Sprawdź, czy podano jakikolwiek argument**:
   - Jeśli podano argument, sparsuj go (zobacz „Parsowanie argumentów” poniżej) i przejdź do „Rozstrzygnięcia”.
   - Jeśli NIE podano argumentu, odpowiedz następującym komunikatem i **ZATRZYMAJ SIĘ**:

```
I'll archive a completed change. Please provide a change-id (kebab-case slug) or path:

Examples:
  /10x-archive context-dir-restructure
  /10x-archive @context/changes/oauth-login/

You can list active changes with: `ls context/changes/`
```

   Następnie **poczekaj**, aż użytkownik poda argument.

## Parsowanie argumentów

Weź pierwszy token rozdzielony białymi znakami. Znormalizuj:

1. Usuń początkowy `@`, jeśli występuje.
2. Usuń końcowy `/`, jeśli występuje.
3. Jeśli wynik zawiera `/`, weź ostatni niepusty segment ścieżki.

Wynik to `<change-id>`.

## Rozstrzygnięcie

1. Rozstrzygnij `<change-id>` do `context/changes/<change-id>/`. Jeśli ta ścieżka nie istnieje:
   - Sprawdź `context/archive/` pod kątem katalogu, którego nazwa kończy się na `-<change-id>` — jeśli zostanie znaleziony, wypisz: `error: change "<change-id>" is already archived at <path>.` i ZATRZYMAJ SIĘ.
   - W przeciwnym razie wypisz: `error: no change folder at context/changes/<change-id>/. Run `ls context/changes/` to list active changes.` i ZATRZYMAJ SIĘ.
2. Odczytaj frontmatter `context/changes/<change-id>/change.md` (`status`, `created`).
   - Jeśli `status: archived`, wypisz: `error: change "<change-id>" is already archived in change.md but its folder is still under context/changes/. Inspect manually before re-running.` i ZATRZYMAJ SIĘ.
   - Jeśli `created` nie występuje lub nie ma formatu `YYYY-MM-DD`, wypisz: `error: change.md.created is missing or malformed; cannot derive archive folder name.` i ZATRZYMAJ SIĘ.

## Twarda odmowa: niezatwierdzone zmiany

Dwie kontrole przed uruchomieniem. Niepowodzenie którejkolwiek blokuje archiwizację.

**1. Niezatwierdzone edycje wewnątrz folderu zmiany.** Uruchom:

```bash
git status --porcelain "context/changes/<change-id>/"
```

Jeśli wynik nie jest pusty, **zablokuj** i wypisz:

```
✗ Cannot archive: context/changes/<change-id>/ has uncommitted changes.

  <one line per offending path from git status --porcelain>

Commit or stash them first, then re-run /10x-archive.
```

**2. Istniejące wcześniej zmiany staged gdziekolwiek.** Krok commitu archiwizacji (zobacz „Przenieś i oznacz” poniżej) łączy wszystko, co jest staged w momencie commitu. Jeśli użytkownik ma niepowiązane zmiany staged z wcześniejszej pracy, zostałyby one po cichu umieszczone w commicie `chore(archive): close ...`. Uruchom:

```bash
git diff --cached --quiet
```

Jeśli kod wyjścia jest niezerowy, **zablokuj** i wypisz:

```
✗ Cannot archive: pre-existing staged changes would be bundled into the archive commit.

  <output of `git diff --cached --name-only`>

Either commit them first or `git reset` to unstage, then re-run /10x-archive.
```

Niepowodzenie którejkolwiek kontroli → ZATRZYMAJ SIĘ. Nie przechodź do monitu ostrzegawczego; są to twarde blokady.

Jeśli `git` nie jest dostępny lub repozytorium nie jest repozytorium git, wypisz: `warning: not a git repository — skipping uncommitted-changes block.` i kontynuuj. (Archiwizacja nadal działa bez git; tracimy jedynie zachowanie historii przez `git mv` i pomijamy krok commitu archiwizacji).

## Miękkie ostrzeżenia (nieblokujące)

Zbierz następujące ostrzeżenia, a następnie przedstaw je wszystkie naraz z pojedynczym monitem o potwierdzenie.

1. **Kontrola statusu**: odczytaj `change.md.status`. Jeśli NIE należy on do `{implemented, impl_reviewed}`, dodaj do kolejki: `Status is "<status>"; expected "implemented" or "impl_reviewed".`
2. **Kontrola oczekującego Progressu**: sparsuj sekcję `## Progress` w `context/changes/<change-id>/plan.md` (jeśli `plan.md` istnieje). Dla każdego bloku `### Phase N:` zidentyfikuj jego podsekcje `#### Automated` oraz `#### Manual` i policz osobno wiersze `- [ ]` pod każdą z nich. Niech `<X>` = łączna liczba oczekujących automatycznych pozycji we wszystkich fazach, `<Y>` = łączna liczba oczekujących ręcznych pozycji we wszystkich fazach, `<N>` = `<X> + <Y>`.

   - **Jeśli plan używa podsekcji Auto/Manual** (dowolny blok `### Phase N:` zawiera nagłówek `#### Automated` lub `#### Manual`) i `<N> > 0`, dodaj do kolejki: `<N> Progress items still pending (<X> automated, <Y> manual): <comma-separated list of "N.M <title>" tokens, truncated to 5 with "…" if longer>.` Uporządkuj połączoną listę tokenów tak, aby najpierw były pozycje automatyczne (w kolejności dokumentu), a następnie ręczne (w kolejności dokumentu); limit skrócenia do 5 dotyczy połączonej listy.
   - **Starszy fallback**: jeśli żaden blok `### Phase N:` w Progressie nie zawiera nagłówka `#### Automated` ani `#### Manual`, wróć do pierwotnego zachowania — policz wiersze `- [ ]` pod podnagłówkami `### Phase`; jeśli jakiekolwiek pozostaną, dodaj do kolejki: `<N> Progress items still pending: <comma-separated list of "N.M <title>" tokens, truncated to 5 with "…" if longer>.` (bez podziału w nawiasie). Zachowuje to brak zmiany zachowania dla planów utworzonych przed workflow-v2.
   - Jeśli brakuje `plan.md`, dodaj do kolejki: `No plan.md found in change folder.` i pomiń liczenie Progressu.
3. **Kontrola pokrycia przeglądów**: zbierz każdy numer fazy z `## Progress` (w tym oczekujące fazy), a następnie odczytaj `reviews/impl-review*.md` i wykonaj sumę zbiorów numerów faz faktycznie przejrzanych dla tego planu. Nowe raporty deklarują `Reviewed phases`; pełny raport wymieniający wszystkie fazy pokrywa je tak samo jak kilka raportów fazowych. W przypadku starszych raportów zaakceptuj jednoznaczny zakres, taki jak `Phase 3 of 4` (pokrywa tylko 3), wyraźny zakres/listę lub pełny przegląd, którego treść ustala dokładnie, które fazy sprawdzono. Nazwa pliku, status `impl_reviewed`, werdykt ani samodzielna etykieta „Full plan” nie są dowodami. Ignoruj raporty dotyczące innych planów. Sprzeczny lub niejasny zakres → dodaj do kolejki `Uncertain review coverage: <report paths and reason>` bez zgadywania numerów faz. Dodaj do kolejki `Missing review coverage for phases: <numbers>` dla różnicy między Progressem a potwierdzonym pokryciem. Jeśli nie istnieją żadne raporty, dodaj także do kolejki `No impl-review found at reviews/impl-review*.md.` Jeśli Progress jest nieobecny lub niemożliwy do sparsowania, ostrzeż, że nie można określić pokrycia; nie twierdź, że pokrycie jest pełne.
4. **Kontrola brakujących SHA**: sparsuj sekcję `## Progress` w `plan.md` (jeśli istnieje). Policz wiersze `- [x]`, których linia NIE kończy się na ` — <sha>`, gdzie `<sha>` to co najmniej 7 znaków szesnastkowych (tzn. regex ` — [0-9a-f]{7,}$` nie pasuje). Jeśli liczba jest niezerowa, dodaj do kolejki: `<N> Progress rows missing SHA suffix: <comma-separated "N.M <title>" tokens, truncated to 5 with "…" if longer>.` Wiersze bez SHA są prawidłowe dla faz z pustym diffem oraz dla planów ukończonych przed wdrożeniem kontraktu SHA — jest to miękki sygnał, nie defekt. Pomiń bez komunikatu, jeśli brakuje `plan.md` (kontrola oczekującego Progressu już obejmuje ten przypadek).

5. **Kontrola historii SHA**: postępuj zgodnie z [diagnozowaniem i przepinaniem SHA](references/archive-sha.md) dla ukończonych wierszy z istniejącymi sufiksami SHA. Zbierz diagnostykę wraz z powyższymi ostrzeżeniami. Ukończ całą diagnostykę tylko do odczytu i potwierdzenie kandydata przed dokonaniem jakichkolwiek edycji plików.

Jeśli dodano do kolejki co najmniej jedno ostrzeżenie, wypisz:

```
⚠ /10x-archive warnings for <change-id>:

  - <warning 1>
  - <warning 2>
  - <warning 3>
```

Jeśli zweryfikowane mapowanie przepięcia jest gotowe, pokaż problem, gałąź docelową, mapowanie stare → nowe SHA, tytuł commitu/zakres zmiany, identyfikatory dotkniętych wierszy i łączną liczbę wierszy, wraz ze wszystkimi ostrzeżeniami. Zapytaj jeden raz: **Zaktualizuj i archiwizuj / Archiwizuj bez podmiany / Anuluj** (Polish: **Zaktualizuj i archiwizuj / Archiwizuj bez podmiany / Anuluj**). Wyraźna zgoda jest wymagana, nawet gdy PR potwierdza mapowanie. Zaktualizuj i archiwizuj → przenieś wyłącznie zatwierdzone mapowanie do „Przenieś i oznacz”; Archiwizuj bez podmiany → pozostaw Progress bez zmian; Anuluj → ZATRZYMAJ SIĘ bez zmian w plikach. Zastępuje to zwykły monit ostrzegawczy poniżej; nigdy nie traktuj potwierdzenia kandydata jako zgody na edycję. Przy niepełnej diagnostyce lub braku zweryfikowanego mapowania nie oferuj ani nie rekomenduj aktualizacji; użyj zwykłego monitu ostrzegawczego.

W przeciwnym razie użyj `AskUserQuestion`. **Zachęta wyłącznie dla ręcznych pozycji**: jeśli powyższa kontrola oczekującego Progressu dodała do kolejki ostrzeżenie, którego podział wynosił dokładnie `0 automated, <Y> manual`, gdzie `<Y> ≥ 1`, dodaj ` (Recommended)` do etykiety `Continue archiving`, aby monit widocznie zachęcał do archiwizacji — kontrole ręczne są często celowo odraczane, a archiwizacja jest oczekiwaną ścieżką. We wszystkich innych przypadkach (mieszane oczekujące, tylko automatyczne, ostrzeżenie starszego fallbacku lub brak ostrzeżenia Progressu) przedstaw etykiety dosłownie.

- pytanie: `Archive "<change-id>" anyway?`
  nagłówek: `Archive`
  opcje:
  - etykieta: `Continue archiving`
    opis: `Move the folder to context/archive/ despite the warnings.`
  - etykieta: `Resume implementation`
    opis: `Don't archive. Suggest /10x-implement <change-id> next.`
  - etykieta: `Cancel`
    opis: `Don't archive. Exit cleanly without further action.`
  multiSelect: false

- **Continue archiving** → przejdź do „Przenieś i oznacz” poniżej.
- **Resume implementation** → wypisz `→ /10x-implement <change-id>` i skopiuj to do schowka za pomocą `pbcopy 2>/dev/null || clip.exe 2>/dev/null || xclip -selection clipboard 2>/dev/null || true` (lub `Set-Clipboard` w PowerShell) (w miarę możliwości, wieloplatformowo). ZATRZYMAJ SIĘ.
- **Cancel** → wypisz `Cancelled. Folder unchanged.` i ZATRZYMAJ SIĘ.

Jeśli nie dodano do kolejki żadnych ostrzeżeń i nie zaproponowano żadnego mapowania przepięcia, pomiń monit i przejdź bezpośrednio dalej.

## Przenieś i oznacz

1. **Oblicz miejsce docelowe archiwum**:
   - `CREATED=$(awk '/^created:/ {print $2; exit}' context/changes/<change-id>/change.md)` (prefiks daty, np. `2026-04-29`).
   - `DEST="context/archive/${CREATED}-<change-id>"`.
   - Jeśli `$DEST` już istnieje, wypisz: `error: archive destination "<DEST>" already exists. Inspect manually.` i ZATRZYMAJ SIĘ.

   Przed jakimikolwiek zapisami ponownie sprawdź warunki przed uruchomieniem i upewnij się, że wiersze planu oraz kandydat nadal odpowiadają temu, co zostało zatwierdzone. Zmienione mapowanie wymaga ponownej zgody. Jeśli przepięcie zostało zatwierdzone, zastosuj teraz wyłącznie zatwierdzone edycje sufiksów i zapisz `reviews/archive-sha-repoint.md` zgodnie z opisem w odwołaniu. Odrzucenie przepięcia lub anulowanie nie może tworzyć tej notatki.

2. **Oznacz `change.md`** (na miejscu, przed przeniesieniem):
   - Ustaw `status: archived`.
   - Ustaw `archived_at: <ISO-8601 datetime, today, UTC>` — wygenerowane przez `date -u +"%Y-%m-%dT%H:%M:%SZ"`.
   - Ustaw `updated: <today as YYYY-MM-DD>`.
   - Użyj narzędzia Edit, aby zaktualizować każdą z trzech linii frontmatter. NIE zmieniaj żadnego innego pola; w szczególności pozostaw `created` i `change_id` bez zmian.

3. **Przenieś folder**:
   - Preferuj `git mv "context/changes/<change-id>" "$DEST"`, aby historia została zachowana.
   - Jeśli `git mv` się nie powiedzie (repozytorium nie jest repozytorium git lub git z jakiegoś powodu odmawia), użyj fallbacku `mkdir -p context/archive`, a następnie `mv "context/changes/<change-id>" "$DEST"`. Wypisz ostrzeżenie, jeśli użyto fallbacku.
   - Potwierdź po przeniesieniu: `[ -d "$DEST" ] && [ ! -d "context/changes/<change-id>" ]`. Jeśli którakolwiek kontrola się nie powiedzie, wypisz diagnostykę i ZATRZYMAJ SIĘ.

4. **Dodaj oznaczenie do stage wraz ze zmianą nazwy.** Edycja w kroku 2 zmodyfikowała `change.md` w drzewie roboczym, ale `git mv` dodaje do stage tylko zmianę nazwy z zawartością pliku z HEAD. Uruchom `git add "$DEST/change.md"`, aby oznaczenie frontmatter trafiło do tego samego commitu co zmiana nazwy. Jeśli przepięcie zostało zatwierdzone, uruchom także `git add "$DEST/plan.md" "$DEST/reviews/archive-sha-repoint.md"`. Zweryfikuj, że staged diff obejmuje zatwierdzone zamiany sufiksów i notatkę mapowania, a także przeniesienie; samo `git mv` nie przechwytuje tych edycji ani nowej notatki.

5. **Zamknij pasujący element roadmapy.** Uruchom to przy **każdej** archiwizacji — wyszukiwanie w roadmapie jest obowiązkowe. „Best effort” dotyczy wyłącznie *edycji*: brakująca roadmapa lub nieznaleziony cel edycji są pomijane bez komunikatu i nigdy nie blokują, nie wycofują ani nie powodują monitu archiwizacji. NIE oznacza to „załóż, że nie ma roadmapy i pomiń kontrolę”. Brak sprawdzenia jest defektem — potwierdzenie (krok 7) musi w obu przypadkach zgłosić wynik.

   1. `test -f context/foundation/roadmap.md`. Jeśli plik nie istnieje, pomiń ten krok bez komunikatu.
   2. Zapisz, czy plik jest już zmodyfikowany: `ROADMAP_PREDIRTY=$(git status --porcelain context/foundation/roadmap.md 2>/dev/null)`. (Używane w podkroku 7 do decyzji, czy dodać go do stage w commicie archiwizacji).
   3. Odczytaj `context/foundation/roadmap.md`. Szukaj `<change-id>` użytego jako `Change ID`:
      - w tabeli `## At a glance` — wiersza, którego komórka kolumny **Change ID** równa się dokładnie `<change-id>`;
      - oraz w treściach `## Foundations` / `## Slices` — bloku `### <ID>: …`, który zawiera linię `- **Change ID:** <change-id>`.

      `<ID>` to lokalny dla roadmapy identyfikator tego elementu (`F-NN` lub `S-NN`); `<Outcome>` to tekst jego linii `- **Outcome:**` (zachowaj początkowe `(foundation) `, jeśli występuje).
   4. **Brak dopasowania** → wypisz `ℹ context/foundation/roadmap.md has no item with Change ID "<change-id>" — roadmap left untouched.` i pomiń resztę tego kroku. Dopasowanie jest wyłącznie dokładnym ciągiem; fragment roadmapy może tworzyć kilka zmian, więc niemal dopasowanie celowo *nie* jest zamykane.
   5. **Znaleziono dopasowanie** → zastosuj trzy poniższe edycje za pomocą narzędzia Edit. Każda jest niezależna i best effort: jeśli celu nie ma tam, gdzie umieszcza go szablon `/10x-roadmap` (ręcznie edytowana roadmapa, starszy format), pomiń tę podedycję, kontynuuj i odnotuj, co pominięto — nigdy nie przerywaj archiwizacji z powodu struktury roadmapy. Zmieniaj tylko pola nazwane tutaj; pozostaw `Outcome`, `Prerequisites`, `Parallel with`, `Risk` itd. bez zmian.
      1. **`## At a glance`** — w dopasowanym wierszu tabeli ustaw komórkę kolumny **Status** na `done`.
      2. **Treść elementu** — w bloku `### <ID>: …` przepisz linię `- **Status:**` na `- **Status:** done`.
      3. **Sekcja `## Done`** — dodaj jeden punkt pod nagłówkiem `## Done`, w udokumentowanym formacie tej sekcji:

         ```
         - **<ID>: <Outcome>** — Archived <today> → `context/archive/<CREATED>-<change-id>/`. Lesson: —.
         ```

         `<today>` to `date -u +%F` (`YYYY-MM-DD`); `<CREATED>` to wartość obliczona w kroku 1 „Oblicz miejsce docelowe archiwum”. Jeśli roadmapa nie ma nagłówka `## Done`, dodaj nagłówek i ten punkt na końcu pliku.
   6. Podbij frontmatter roadmapy: ustaw `updated: <today as YYYY-MM-DD>`. Pozostaw każdy inny klucz (`created`, `version`, `status`, `prd_version`, `main_goal`, `top_blocker`, …) bez zmian. Jeśli plik nie ma frontmatter YAML, pomiń ten podkrok.
   7. **Dodaj go do stage w commicie archiwizacji** — tylko jeśli `git` jest dostępny **oraz** `ROADMAP_PREDIRTY` (podkrok 2) był pusty. Następnie uruchom `git add context/foundation/roadmap.md`, aby zamknięcie roadmapy trafiło do tego samego commitu co zmiana nazwy + oznaczenie. Jeśli `ROADMAP_PREDIRTY` nie był pusty, plik miał już niezatwierdzone edycje; pozostaw zamknięcie roadmapy w drzewie roboczym i wypisz `⚠ context/foundation/roadmap.md had pre-existing uncommitted changes — closed roadmap item <ID> in the working tree but did NOT stage it. Commit it yourself.` Jeśli `git` jest niedostępny, edycja po prostu pozostaje w drzewie roboczym (kontrola przed uruchomieniem już ostrzegła).
   8. Zachowaj `<ID>` i `<Outcome>` na potrzeby wyjścia potwierdzającego.

6. **Zacommituj archiwum.** Utwórz jeden commit:

   ```bash
   git commit -m "$(cat <<'EOF'
   chore(archive): close <change-id>
   EOF
   )"
   ```

   Bez treści — temat jest mechaniczny, a diff (zmiana nazwy + oznaczenie frontmatter oraz zamknięcie roadmapy, gdy jedno pasowało) jest oczywisty. Nigdy nie przekazuj flag `--no-verify` ani flag omijających podpisywanie. Jeśli hook pre-commit się nie powiedzie, napraw podstawowy problem i utwórz NOWY commit.

   Pomiń ten krok całkowicie, jeśli `git` jest niedostępny lub repozytorium nie jest repozytorium git (kontrola przed uruchomieniem już ostrzegła).

7. **Wypisz potwierdzenie**:

```
✓ Archived <change-id>
  context/changes/<change-id>/  →  <DEST>/

change.md updated:
  status:       archived
  archived_at:  <ISO datetime>
  updated:      <today>

roadmap.md:     closed <ID> "<Outcome>"  →  Status: done, entry added to ## Done    ← if matched; else print: no item with Change ID "<change-id>" — checked, left untouched. Always print one of the two; it proves the lookup ran.

Committed as: <short SHA> chore(archive): close <change-id>

The folder is now read-only by convention. To start a new change: /10x-new <new-id>
```

## Obsługa błędów

- Każdy nieoczekiwany błąd systemu plików podczas przenoszenia pozostawia folder źródłowy na miejscu — staged edycje `change.md` trafiają przed przeniesieniem, więc przy częściowym niepowodzeniu użytkownik widzi `status: archived` w `context/changes/<change-id>/change.md`, ale folder nadal znajduje się w `context/changes/`. `/10x-status` pokaże to jako ostrzeżenie `status drift: archived in wrong folder`. Ponowne uruchomienie `/10x-archive` jest bezpieczne: kontrola rozstrzygnięcia na początku wykryje `status: archived` i poprosi użytkownika o ręczną inspekcję.
- NIE próbuj wycofywania — edycje change.md oznaczają zamiar, a stan częściowy można odzyskać ręcznie.
- Krok zamknięcia roadmapy („Przenieś i oznacz”, krok 5) jest izolowany: każde niepowodzenie jest przechwytywane, odnotowywane w wyjściu potwierdzającym i pomijane. Nigdy nie przerywa archiwizacji ani nie uruchamia wycofywania. Częściowo zastosowaną edycję roadmapy można odzyskać ręcznie.

## Czego ta umiejętność NIE robi

- Nie dodaje brakujących SHA ani nie zmienia stanu ukończenia. Przed przeniesieniem mogą zostać przepięte wyłącznie jawnie zatwierdzone istniejące sufiksy w ukończonych wierszach; wiersze bez SHA i oczekujące pozostają nietknięte.
- Nie przełącza ani nie tworzy gałęzi, nie otwiera PR-ów ani nie przepisuje istniejących archiwów. Archiwizuj w bieżącej gałęzi, diagnozując pochodzenie SHA względem rozstrzygniętej gałęzi integracyjnej.
- Nie uruchamia `pnpm test` / `pnpm build` / `pnpm ci:local` jako bramki — bramka jest celowo łagodna i wyłącznie ostrzegawcza.
- Nie wykonuje push. Commit archiwizacji trafia lokalnie; `git push` należy do użytkownika.
- Nie przepisuje roadmapy poza zamknięciem jednego dopasowanego elementu. Gdy `context/foundation/roadmap.md` ma element, którego `Change ID` równa się zarchiwizowanemu `<change-id>`, ta umiejętność zmienia wyłącznie `Status` tego elementu (komórka tabeli + linia treści `### <ID>:`), dodaje jeden punkt `## Done` i podbija datę `updated:`. Nigdy nie zmienia kolejności fragmentów, nie przelicza grafu zależności, nie edytuje innych elementów ani nie tworzy nieistniejącej roadmapy. Brak dopasowania (lub brak pliku roadmapy) → roadmapa bez zmian.
- Nie zapisuje do `context/archive/<...>/` po przeniesieniu; zarchiwizowane foldery są umownie tylko do odczytu. Inne umiejętności 10x (`/10x-research`, `/10x-frame`, `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`, `/10x-tdd`, `/10x-goal-implement`) odmawiają, gdy rozstrzygnięta ścieżka zaczyna się od `context/archive/`.
- Nie przywraca z archiwum. Aby wrócić do zarchiwizowanej zmiany, otwórz nową zmianę za pomocą `/10x-new` i odwołaj się do zarchiwizowanego folderu dla kontekstu.