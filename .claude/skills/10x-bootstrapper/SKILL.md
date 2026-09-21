---
name: 10x-bootstrapper
description: >
  Scaffold a project into the current working directory after the tech stack
  is picked. Reads context/foundation/tech-stack.md, runs the chosen starter's
  CLI with a strict conflict policy that always preserves context/, and writes
  a verification log. Use when the user says "bootstrap the project",
  "scaffold the app", "set up the codebase", "let's start the project".
  Use AFTER /10x-tech-stack-selector.
argument-hint: "[path-to-tech-stack]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Bootstrapper: Od stosu technologicznego do projektu ze szkieletem

Ta umiejętność jest końcowym ogniwem sekwencji bootstrapowania (`/10x-shape → /10x-prd → /10x-tech-stack-selector → 10x-bootstrapper`). Jej jedynym zadaniem jest przekształcenie zapisanego przekazania stosu technologicznego w projekt ze szkieletem w bieżącym katalogu roboczym, z ustaleniami weryfikacyjnymi zapisanymi do przeglądu przez użytkownika.

Umiejętność jest **konsumentem rejestru**, a nie jego właścicielem. Rejestr starterów znajduje się w `/10x-tech-stack-selector` (`/skills/10x-tech-stack-selector/references/starter-registry.yaml`); bootstrapper wyszukuje wybraną kartę przez `starter_id`, podstawia jej `cmd_template` i kieruje do właściwej strategii cwd. Walidator CI (`scripts/validate-starter-registry-sync.mjs`) zapobiega odwoływaniu się przez bootstrapper do `starter_id`, którego nie ma w tym rejestrze.

v1 działa **wyłącznie w trybie łańcuchowym**. Bez `context/foundation/tech-stack.md` umiejętność odmawia działania i przekierowuje do `/10x-tech-stack-selector`. Nie ma wbudowanego mini-przekazania, trybu samodzielnego ani awaryjnego mechanizmu AI-as-bridge dla nieznanych stosów. v1 również **nie** generuje `AGENTS.md` / `CLAUDE.md` — ta odpowiedzialność należy do przyszłej umiejętności M1L4.

## Kiedy uruchamiać

Użyj, gdy istnieje `context/foundation/tech-stack.md` i użytkownik jest gotowy do utworzenia szkieletu. Frazy wyzwalające: „bootstrap the project”, „scaffold the app”, „set up the codebase”, „let's start the project”, „spin up the repo” lub dowolna naturalna kontynuacja uruchomienia `/10x-tech-stack-selector`, które właśnie zapisało przekazanie.

Warunkiem wstępnym jest pojedynczy plik na dysku: `context/foundation/tech-stack.md`. Umiejętność nigdy nie odwołuje się awaryjnie do historii rozmowy, nigdy nie uruchamia ponownie wywiadu o stosie technologicznym i nigdy nie przyjmuje stosu podanego inline.

## Kiedy pominąć

Pomiń, gdy:

- Użytkownik jest w trakcie implementacji w istniejącej bazie kodu i prosi o dodanie pojedynczej biblioteki lub zastąpienie pojedynczej zależności — to obszar `/10x-frame`, a nie bootstrapowania.
- Użytkownik podaje stos spoza rejestru tech-stack-selector — przekieruj do `/10x-tech-stack-selector` (jest właścicielem rejestru; jeśli startera brakuje, tam należy to obsłużyć).
- Brakuje `context/foundation/tech-stack.md` — sprawdzenie warunku wstępnego w Kroku 0 obsługuje to jawnym przekierowaniem.

## Wymagane dane wejściowe

1. `context/foundation/tech-stack.md` — przekazanie zapisane przez `/10x-tech-stack-selector`. Kontrakt: zobacz `references/handoff-consumer.md` (który wskazuje `/10x-tech-stack-selector/references/handoff-schema.md` jako autorytatywny schemat).
2. Wybrana karta z `/skills/10x-tech-stack-selector/references/starter-registry.yaml`. Rozwiązywana przez wyszukiwanie `starter_id`. Zawiera `cmd_template`, `language_family`, `bootstrapper_confidence`, `toolchain.package_manager`, `deployment_defaults`.
3. `references/bootstrapper-config.yaml` — nadpisania `cwd_strategy` po stronie bootstrappera dla poszczególnych starterów + wyszukiwanie `language_family → audit_command`. Dołączone do umiejętności.
4. `references/handoff-consumer.md` — dołączone. Wczytywane w Kroku 0.
5. `references/refusal-protocol.md` — dołączone. Wczytywane, gdy zostanie spełniony dowolny warunek odmowy.
6. `references/pre-scaffold-verification.md` — dołączone. Wczytywane w Kroku 1.
7. `references/scaffold-merge.md` — dołączone. Wczytywane w Kroku 2.
8. `references/post-scaffold-verification.md` — dołączone. Wczytywane w Kroku 3.
9. `references/verification-log-schema.md` — dołączone. Wczytywane w Kroku 4.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-bootstrapper @context/foundation/tech-stack-v2.md` lub `/10x-bootstrapper path/to/tech-stack.md`), usuń początkowy `@`, jeśli występuje, i użyj ścieżki dosłownie jako lokalizacji przekazania dla tego uruchomienia.
2. **Jeśli nie podano argumentu**, domyślną ścieżką przekazania jest `context/foundation/tech-stack.md`.

Przenoś rozwiązaną ścieżkę przez Krok 0; reszta przepływu pracy operuje na niej jako `<handoff-path>`.

## Przepływ pracy

### Krok 0 — Warunek wstępny przekazania

Sprawdź warunek wstępny przekazania względem rozwiązanej ścieżki:

```bash
test -f "<handoff-path>"
```

**Jeśli nie istnieje**, wykonaj dokładnie to i ZATRZYMAJ SIĘ — bez awaryjnego wywiadu, bez wbudowanego mini-przekazania, bez czytania rozmowy w poszukiwaniu zastępczego wyboru stosu:

```bash
echo -n "/10x-tech-stack-selector" | pbcopy 2>/dev/null || echo -n "/10x-tech-stack-selector" | clip.exe 2>/dev/null || echo -n "/10x-tech-stack-selector" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-tech-stack-selector"
```

Wypisz dosłownie (podstaw rozwiązaną ścieżkę; jeśli użyto domyślnej, jest to `context/foundation/tech-stack.md`):

```
Bootstrapper wymaga przekazania stosu technologicznego w `<handoff-path>`. Najpierw uruchom `/10x-tech-stack-selector`, a następnie wywołaj ponownie.
```

Następnie ZATRZYMAJ SIĘ. Kontekst rozmowy **nie** jest rozwiązaniem awaryjnym — nawet jeśli wybór stosu był omawiany wcześniej na czacie, umiejętność wymaga pliku na dysku. Pełny zestaw warunków odmowy i tekstów schowka znajdziesz w `references/refusal-protocol.md`.

**Jeśli istnieje**, przeczytaj go W CAŁOŚCI (bez `limit`/`offset`) i kontynuuj. Przetwórz frontmatter zgodnie z `references/handoff-consumer.md` i rozwiąż wybraną kartę przez wyszukiwanie `starter_id` względem `/skills/10x-tech-stack-selector/references/starter-registry.yaml`. Jeśli wyszukiwanie się nie powiedzie, uruchom odmowę z powodu rozbieżności rejestru z `references/refusal-protocol.md` i ZATRZYMAJ SIĘ.

Powtórz użytkownikowi wykorzystane pola jako podsumowanie do potwierdzenia lub poprawienia:

```
Przekazanie otrzymane:
  Starter:        <starter_id> — <name>
  Nazwa projektu: <project_name>
  Menedżer pakietów:<package_manager | "(domyślna karty)" if omitted>
  Język:          <hints.language_family>
  Pewność:        <hints.bootstrapper_confidence>
  Wybrana ścieżka:<hints.path_taken>
  Wdrożenie:      <hints.deployment_target>
  Flagi funkcji:  <comma list of has_* set to true, or "none">
```

Zadaj jedno pytanie potwierdzające:

AskUserQuestion:
- question: "Kontynuować z tym przekazaniem, czy najpierw coś poprawić?"
  header: "Przekazanie"
  options:
  - label: "Kontynuuj (zalecane)"
    description: "Kontynuuj z przekazaniem w odczytanej postaci."
  - label: "Popraw wartość"
    description: "Zapytam, które pole nadpisać dla tego uruchomienia; plik na dysku pozostanie bez zmian."
  - label: "Zatrzymaj — najpierw popraw przekazanie"
    description: "Zakończ. Uruchom ponownie /10x-tech-stack-selector, aby zaktualizować tech-stack.md, a następnie wywołaj ponownie."
  multiSelect: false

Jeśli wybrano „Popraw wartość”: zapytaj, które pole, przechwyć nadpisanie, kontynuuj z nadpisaniem zastosowanym tylko dla tej sesji. Następnie uruchom ochronę przed zapełnionym cwd z `references/refusal-protocol.md` (ostrzeż i poproś o potwierdzenie, jeśli cwd już zawiera odcisk projektu ze szkieletem, taki jak `package.json`, `Cargo.toml`, `Gemfile`, `pyproject.toml` itd.).

### Krok 1 — Weryfikacja przed utworzeniem szkieletu

Przed uruchomieniem CLI startera wykonaj lekkie sprawdzenie aktualności opisane w `references/pre-scaffold-verification.md`. Przeczytaj teraz tę referencję. Ten etap jest tylko do odczytu — bez klonowania, bez instalacji, bez zmian w systemie plików — ma charakter informacyjny, a nie blokujący: każde ustalenie to WARN-AND-CONTINUE.

Sekwencja:

1. Z wybranej karty wyprowadź nazwę pakietu npm z `cmd_template`, jeśli `hints.language_family == js` i szablon wywołuje CLI `create-*` (np. `npm create next-app` → `create-next-app`, `npm create astro` → `create-astro`, `npm create vite` → `create-vite`). Jeśli szablon zaczyna się od `git clone`, pomiń krok npm.
2. Jeśli wyprowadzono nazwę pakietu, uruchom `npm view <package> version` i `npm view <package> time.modified`.
3. Z wybranej karty przeanalizuj `docs_url`. Jeśli wskazuje na `github.com/<owner>/<repo>`, uruchom `gh api repos/<owner>/<repo> --jq '.pushed_at'`.
4. Oblicz wagę zgodnie z progami w `pre-scaffold-verification.md` (fresh / aged / stale).
5. Wypisz jedną linię podsumowania w rozmowie. Dodaj na początku jednolinijkowe ostrzeżenie „Heads-up”, jeśli dowolny sygnał jest stale. Nigdy nie blokuj — niezależnie od tego przejdź do Kroku 2.
6. Umieść rozwiązaną nazwę pakietu (jeśli występuje), adres URL repozytorium GitHub (jeśli występuje), oba znaczniki czasu i obie wagi w rekordzie weryfikacyjnym w pamięci. Krok 4 zapisze ten rekord na dysku.

Jeśli wywołanie sieciowe się nie powiedzie, zapisz błąd w logu i kontynuuj z częściowym rekordem — zobacz „Failure mode” w referencji.

Teraz wyszukaj `cwd_strategy` dla wybranego `starter_id` w `references/bootstrapper-config.yaml` (domyślnie `subdir-then-move`, jeśli id nie znajduje się na liście). Krok 2 go potrzebuje. Jednocześnie wyszukaj `audit_commands[<hints.language_family>]` w tym samym pliku i przygotuj je dla Kroku 3 (wartość `null` oznacza, że Krok 3 pominie audyt i odnotuje pominięcie w logu).

### Krok 2 — Utworzenie szkieletu i scalenie

Przeczytaj teraz `references/scaffold-merge.md`. Zawiera pełny mechanizm trzech strategii cwd, macierz konfliktów, reguły podstawiania oraz ścieżkę HARD-STOP w przypadku awarii CLI.

Sekwencja:

1. Rozwiąż `cmd_template` z wybranej karty. Podstaw `{name}` i `{pm}` zgodnie ze strategią w danym zakresie (zobacz `scaffold-merge.md` § Substitution rules). Awaryjną wartością dla `{pm}` jest `toolchain.package_manager` karty, jeśli przekazanie pomija to pole.
2. Rozgałęź według `cwd_strategy` (rozwiązanego w Kroku 1 z `bootstrapper-config.yaml`, domyślnie `subdir-then-move`):
   - **`subdir-then-move`** — uruchom rozwiązaną komendę z `{name}=.bootstrap-scaffold`. Po kodzie wyjścia 0 zastosuj macierz konfliktów, przenosząc pliki do cwd, a następnie usuń `.bootstrap-scaffold/`.
   - **`native-cwd`** — uruchom rozwiązaną komendę z `{name}=.` bezpośrednio w cwd. Bez etapu scalania. Przed wykonaniem: wyświetl listę plików, których CLI zaraz dotknie, i pokaż je w rozmowie.
   - **`git-clone`** — uruchom rozwiązaną komendę z `{name}=.bootstrap-scaffold`. Po kodzie wyjścia 0 usuń `.bootstrap-scaffold/.git/` przed zastosowaniem macierzy konfliktów i przeniesieniem plików do cwd. Następnie usuń `.bootstrap-scaffold/`.
3. Przechwyć stdout, stderr i kod wyjścia do rekordu weryfikacyjnego w pamięci niezależnie od wyniku.
4. **Awaria CLI to HARD-STOP.** Jeśli kod wyjścia jest niezerowy, uruchom ścieżkę obsługi awarii CLI z `scaffold-merge.md` § CLI failure handling: pozostaw `.bootstrap-scaffold/` na miejscu, nie stosuj macierzy konfliktów, zapisz częściowy `verification.md` z `phase_3_status: failed`, ustaw schowek na `/10x-bootstrapper`, wypisz podsumowanie awarii i ZATRZYMAJ SIĘ. Nie przechodź do Kroku 3.
5. Po kodzie wyjścia 0 wypisz jedną linię podsumowania zgodnie z formatem w `scaffold-merge.md` § Surfacing the result. Umieść dziennik przeniesień plik po pliku w rekordzie weryfikacyjnym w pamięci. Przejdź do Kroku 3.

Ochrona przed zapełnionym cwd z Kroku 0 (`refusal-protocol.md` § (d)) została już uruchomiona przed tym krokiem. Macierz konfliktów jest zabezpieczeniem: istniejące pliki otrzymują równoległe pliki `.scaffold`, `context/` jest zawsze zachowywany, a `.gitignore` jest scalany przez dopisanie.

W rozmowie z użytkownikiem tłumacz nazwy strategii na prosty język („utwórz szkielet w katalogu tymczasowym, a następnie przenieś pliki”, „utwórz szkielet bezpośrednio w bieżącym katalogu”, „sklonuj repozytorium startera bez zachowywania jego historii git”), zamiast powtarzać wewnętrzne etykiety dosłownie.

### Krok 3 — Weryfikacja po utworzeniu szkieletu

Przeczytaj teraz `references/post-scaffold-verification.md`. Ten etap uruchamia komendę audytu rozwiązaną w Kroku 1 (`audit_commands[<hints.language_family>]` z `bootstrapper-config.yaml`) i przypisuje ustaleniom poziomy ważności.

Sekwencja:

1. Jeśli rozwiązana komenda audytu to `null`, pomiń audyt i umieść w rekordzie weryfikacyjnym ustrukturyzowaną notatkę „no built-in audit tool for <language_family>”. Wypisz linię pominięcia zgodnie z formatem Output w referencji. Przejdź do Kroku 4.
2. W przeciwnym razie uruchom rozwiązaną komendę z cwd (lub z odpowiedniego katalogu instalacji zależności, jeśli szkielet tak zorganizował projekt). Przechwyć stdout, stderr i kod wyjścia. Kod wyjścia narzędzia audytu ma charakter wyłącznie informacyjny — bootstrapper NIE zatrzymuje się przy niezerowym kodzie wyjścia audytu.
3. Przeanalizuj dane wyjściowe zgodnie z blokiem wywołania właściwym dla ekosystemu w referencji. Przypisz ustaleniom poziomy CRITICAL / HIGH / MODERATE / LOW.
4. Jeśli narzędzie obsługuje rozróżnienie bezpośrednich i przechodnich, oblicz ten podział.
5. Wypisz jedną linię podsumowania w rozmowie zgodnie z formatem Output w referencji. Liczby CRITICAL i HIGH pokazuj inline; MODERATE i LOW tylko w logu.
6. Umieść pełny podział (surowe wyjście, przeanalizowane liczby, szczegóły dla każdego ustalenia, podział bezpośrednie/przechodnie) w rekordzie weryfikacyjnym w pamięci.

Narzędzie niedostępne, awaria sieci lub awaria analizowania: WARN-AND-CONTINUE zgodnie z blokiem Failure mode w referencji. Obecne ustalenia CRITICAL: WARN-AND-CONTINUE — bootstrapper informuje, decyzja należy do użytkownika.

### Krok 4 — Zapisz verification.md i zakończ

Przeczytaj teraz `references/verification-log-schema.md`. Ten krok zapisuje ślad audytowy uruchomienia na dysku i wypisuje końcowe podsumowanie.

Sekwencja:

1. Upewnij się, że istnieje `context/changes/bootstrap-verification/`. Utwórz katalog, jeśli go nie ma (bez `change.md` — folder zawiera wyłącznie log).
2. Jeśli `context/changes/bootstrap-verification/verification.md` już istnieje, uruchom ochronę WARN-AND-CONFIRM z `references/refusal-protocol.md` § (e). Przy „Overwrite” kontynuuj. Przy „Save as verification-v2.md” przejdź do następnego dostępnego miejsca `verification-vN.md`. Przy „Abort” zatrzymaj się bez zapisywania.
3. Skomponuj treść pliku zgodnie z `references/verification-log-schema.md`: frontmatter (z `phase_3_status: ok` dla normalnych uruchomień, `failed` dla przypadku częściowego logu HARD-STOP), następnie `## Hand-off`, `## Pre-scaffold verification`, `## Scaffold log`, `## Post-scaffold audit`, `## Hints recorded but not acted on`, `## Next steps`. Sekcja `Hints recorded but not acted on` pobiera każdą wskazówkę z flag przekazania `handoff-consumer.md` jako „surfaces but does not act on in v1”.
4. Zapisz plik. Jeśli zapis się nie powiedzie (błąd systemu plików, brak uprawnień), przejdź awaryjnie do wypisania pełnej treści na czacie zgodnie z blokiem failure-mode schematu.
5. Wypisz końcowe podsumowanie w rozmowie:

   ```
   Utworzono szkielet <starter_id> w bieżącym katalogu. Log weryfikacyjny: context/changes/bootstrap-verification/verification.md.

   Przed utworzeniem szkieletu: <one-line recency summary>.
   Szkielet:                  <one-line scaffold summary>.
   Audyt:                     <one-line audit summary>.

   Następnie: przyszła umiejętność skonfiguruje kontekst agenta (CLAUDE.md, AGENTS.md). Na razie Twój projekt ma utworzony szkielet i został zweryfikowany — miłego kodowania.
   ```

6. Zatrzymaj się. Nie ustawiaj schowka do ponowienia po pomyślnym uruchomieniu; łańcuch jest kompletny dla v1.

W przypadku częściowego logu HARD-STOP (awaria CLI w Kroku 2), Krok 4 nadal jest wykonywany, ale ze skróconą strukturą treści ze schematu (sekcja `Audit not run`, `phase_3_status: failed`). Schowek jest ustawiany na `/10x-bootstrapper` do ponowienia przez ścieżkę awarii Kroku 2, a nie przez ten krok.

## Wynik

Co umiejętność tworzy zewnętrznie:

- **Pliki projektu ze szkieletem w cwd** — zapisywane przez CLI startera, z równoległymi plikami `.scaffold` tam, gdzie polityka konfliktów wykryła kolizję. `context/` w cwd jest zachowywany dosłownie.
- **`context/changes/bootstrap-verification/verification.md`** — ślad audytowy uruchomienia. Schemat w `references/verification-log-schema.md`. Jeden plik na uruchomienie; ponowne uruchomienia nadpisują go (z ochroną WARN-AND-CONFIRM).
- **Podsumowania rozmowy na każdym kroku** — echo do potwierdzenia lub poprawienia z Kroku 0, podsumowanie aktualności z Kroku 1, podsumowanie szkieletu z Kroku 2 (z informacjami o równoległych plikach `.scaffold` i obsłudze `.gitignore`), podsumowanie audytu z Kroku 3, końcowe podsumowanie z Kroku 4 ze wskazaniem kolejnych kroków.
- **Wskaźnik w schowku tylko na ścieżkach awarii** — `/10x-tech-stack-selector` dla odmów z powodu brakującego przekazania i rozbieżności rejestru, `/10x-bootstrapper` dla ponowienia HARD-STOP po awarii CLI z Kroku 2. Przy pomyślnym uruchomieniu schowek nie jest ustawiany.

Czego umiejętność NIE tworzy w v1:

- **`AGENTS.md` / `CLAUDE.md`** — odłożone do przyszłej umiejętności M1L4 („Memory Architecture”).
- **Plików przepływu CI** (`.github/workflows/ci.yml` itd.) — odłożone do tej samej przyszłej umiejętności.
- **`git init`** ani żadnej historii git — bootstrapper zakłada, że użytkownik sam zarządza swoim repozytorium. Strategia `git-clone` jawnie usuwa sklonowane `.git/` przed przeniesieniem plików, aby historia upstreamowego startera nie przedostała się do projektu.
- **Automatycznych poprawek / automatycznych łatek dla ustaleń audytu** — bootstrapper informuje; decyzja należy do użytkownika.

## Referencje

- `references/handoff-consumer.md` — które klucze frontmatter przekazania bootstrapper wykorzystuje, pokazuje lub ignoruje.
- `references/refusal-protocol.md` — warunki odmowy, teksty i ciągi do schowka.
- `references/bootstrapper-config.yaml` — nadpisania `cwd_strategy` dla poszczególnych starterów + mapa `language_family → audit_command`.
- `references/pre-scaffold-verification.md` — lekkie sprawdzenie aktualności.
- `references/scaffold-merge.md` — mechanizm `.bootstrap-scaffold/`, trzy strategie cwd, macierz konfliktów.
- `references/post-scaffold-verification.md` — dyspozycja audytu według języka + poziomowanie ważności.
- `references/verification-log-schema.md` — struktura `context/changes/bootstrap-verification/verification.md`.

## Krytyczne zabezpieczenia

1. **Przekazanie jest warunkiem wstępnym, a nie rozwiązaniem awaryjnym.** Bez wbudowanego mini-przekazania, bez czytania historii rozmowy w poszukiwaniu zastępczych pól. Plik na dysku jest kontraktem.

2. **Bootstrapper konsumuje rejestr; nie jest jego właścicielem.** Kanoniczny rejestr starterów znajduje się w `/10x-tech-stack-selector`. Rozbieżność między `starter_id` wskazywanymi przez bootstrapper a rejestrem jest błędem CI (`scripts/validate-starter-registry-sync.mjs`).

3. **`context/` jest zawsze zachowywany.** Polityka konfliktów jest ścisła: nic pod `context/` w cwd nigdy nie jest nadpisywane przez szkielet. Pełną macierz konfliktów znajdziesz w `references/scaffold-merge.md` (Faza 3).

4. **Awaria CLI to HARD-STOP.** Niezerowy kod wyjścia w Kroku 2 zatrzymuje umiejętność, pozostawia `.bootstrap-scaffold/` na miejscu do inspekcji i zapisuje częściowy log weryfikacyjny. Wszystkie inne fazy używają WARN-AND-CONTINUE — ustalenia weryfikacyjne mają charakter informacyjny, a nie blokujący.

5. **v1 nie generuje `AGENTS.md` / `CLAUDE.md`.** Ta praca przechodzi do przyszłej umiejętności M1L4 („Memory Architecture”). v1 pokazuje wartości wskazówek takie jak `bootstrapper_confidence: best-effort` i `quality_override: true` w podsumowaniu rozmowy, ale nie podejmuje żadnych działań kompensacyjnych.

6. **Wewnętrzne etykiety umiejętności pozostają wewnętrzne.** W rozmowie z użytkownikiem nigdy nie odwołuj się do numerów kroków (`Step 0`, `Step 2`), nazw strategii dosłownie (`subdir-then-move`, `native-cwd`, `git-clone`) bez kontekstu ani wewnętrznych ścieżek pól (`hints.deployment_target`). Tłumacz na prosty język: „etap tworzenia szkieletu”, „Twój cel wdrożeniowy”, „w jaki sposób CLI tworzy szkielet w bieżącym katalogu”, „przez sklonowanie repozytorium startera”.