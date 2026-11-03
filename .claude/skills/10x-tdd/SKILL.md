---
name: 10x-tdd
description: Drive an approved plan from context/changes/<change-id>/plan.md phase by phase, test-first, through red→green→refactor — only for TDD'able phases not yet implemented; everything else routes to /10x-implement. Use when the user says "tdd", "test-first", "red green refactor", or wants to execute a plan via TDD.
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Agent
  - Task
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---

# 10x TDD — Wykonywanie planu metodą Test-First

Prowadzisz zatwierdzony plan techniczny z `context/changes/<change-id>/plan.md` do ukończenia **po jednej fazie naraz, test-first**. Ta umiejętność ma zastosowanie tylko wtedy, gdy produkcyjna implementacja fazy nadal nie istnieje. Dla każdej kwalifikującej się fazy uruchamiasz klasyczną pętlę:

```
RED      →  napisz nieprzechodzący test, który ustala kolejne zachowanie
GREEN    →  napisz minimalny kod produkcyjny, aby test przeszedł
REFACTOR →  uporządkuj kod, zachowując zielony stan testu
```

Ta umiejętność jest **odpowiednikiem `/10x-implement` działającym test-first**. Czyta ten sam plan, modyfikuje tę samą kanoniczną sekcję `## Progress` i używa tego samego rytuału commita na końcu fazy oraz przekazań przez schowek. Jedyna różnica to kolejność: tutaj nieprzechodzący test jest pisany **przed** kodem produkcyjnym. Ponieważ ta kolejność jest kluczowa, nie używaj tej umiejętności do dodawania testów po tym, jak implementacja już istnieje. Ponieważ obie umiejętności współdzielą `## Progress`, możesz dowolnie je przeplatać — wykonać TDD fazy tutaj, przekazać następną fazę do `/10x-implement`, wrócić, a stan nigdy nie zostanie utracony.

Ścieżka planu: `$ARGUMENTS`

## Co ta umiejętność zakłada — i czego nie zrobi

- **Infrastruktura testowa już istnieje.** Zakłada się, że istnieje runner (Vitest / Playwright / Jest / pytest / …), sposób uruchomienia pojedynczego pliku oraz konwencje testowe projektu. Ta umiejętność je **odkrywa**; nie instaluje runnera, nie generuje konfiguracji, nie tworzy fixtures ani nie integruje CI. Jeśli żaden runner w ogóle nie istnieje, zatrzymaj się i powiedz użytkownikowi, aby najpierw go skonfigurował (wskaż `/10x-test-plan` dla etapowego wdrożenia testów albo `/10x-bootstrapper` dla scaffolding).
- **Implementacja produkcyjna jeszcze nie istnieje.** TDD działa tylko wtedy, gdy nieprzechodzący test może prowadzić implementację. Jeśli istotne dla fazy zachowanie, endpoint, komponent, migracja, integracja lub inna zmiana produkcyjna już istnieje, zatrzymaj się natychmiast; nie pisz testów retrospektywnie i nie kontynuuj fazy pod etykietą TDD. Powiedz użytkownikowi, aby użył `/10x-implement <change-id> phase N` w celu kontynuowania już rozpoczętej fazy.
- **Prowadzi implementację, a nie tylko scaffolding testów.** W przeciwieństwie do starego przepływu „napisz najpierw wszystkie testy”, ta umiejętność pisze mały nieprzechodzący test, a następnie natychmiast doprowadza go do zielonego stanu, faza po fazie. Nie ma osobnej partii osieroconych nieprzechodzących testów.
- **Sprawdza każdą fazę pod kątem faktycznego dopasowania test-first i braku implementacji.** Niektóre fazy (config, scaffolding, dopracowanie wizualne, integracja infra) nie mogą być sensownie prowadzone przez nieprzechodzący test. Już rozpoczętej implementacji także nie można przekształcić w prawdziwe TDD. Takie przypadki są przekierowywane lub zatrzymywane zgodnie z opisem poniżej.

## Przegląd faz

```
SETUP            →  Rozwiąż plan, przeczytaj go w całości, potwierdź istnienie infrastruktury testowej, utwórz zadania dla każdej fazy
Dla każdej fazy:
  ├─ GATE        →  Czy tę fazę można wykonać metodą TDD i czy implementacja nie istnieje? Jeśli nie → przekieruj lub zatrzymaj
  ├─ RED/GREEN/REFACTOR  →  Pętla dla każdego zachowania w fazie, aż jej kryteria sukcesu zostaną spełnione
  └─ PHASE END   →  Pełny zestaw zielony → bramka ręczna → rytuał commita → decyzja dotycząca następnej fazy (schowek)
Po wszystkich fazach →  Podsumowanie ukończenia + opcjonalne /10x-impl-review
```

Każda faza kończy się punktem kontrolnym dla użytkownika. Nigdy nie pomijaj fazy po cichu ani nie łącz dwóch faz w jeden commit.

---

## Setup

Gdy ta umiejętność jest wywoływana:

1. **Rozwiąż plan**:
   - `/10x-tdd <change-id> [phase N]` → `context/changes/<change-id>/plan.md`.
   - `@context/changes/<change-id>/plan.md` lub pełna ścieżka → zaakceptuj bez zmian.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wyświetl „This change is archived. Open a new change with `/10x-new` instead.” i ZATRZYMAJ się.
   - Jeśli nic nie podano, wyświetl poniższy komunikat oraz **ZATRZYMAJ się i czekaj**:

```
Poprowadzę zatwierdzony plan metodą test-first (red → green → refactor), faza po fazie. Podaj proszę:

1. Change-id (np. `/10x-tdd oauth-login phase 1`), albo
2. Pełną ścieżkę (np. `@context/changes/oauth-login/plan.md`).

Możesz wyświetlić aktywne zmiany za pomocą: `ls context/changes/`

Wskazówka: plan powinien być już zrecenzowany i zatwierdzony — ta umiejętność go implementuje, a nie pisze.
```

2. **Przeczytaj plan w całości** — każdą fazę, każdy blok Changes Required, każde kryterium Success Criteria. Nigdy nie używaj limit/offset; potrzebujesz pełnego kontekstu. Sekcja `## Progress` na dole jest **autorytatywna dla stanu wykonania** — checkboxy (`- [x]`) występują TYLKO tam (zobacz `references/progress-format.md`). Bloki faz zawierają zwykłe wypunktowania `- `, bez checkboxów.

3. **Przeczytaj `context/foundation/lessons.md`**, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane przez zespół powtarzające się reguły i muszą kształtować każdy wybór implementacyjny w tym uruchomieniu.

4. **Potwierdź istnienie infrastruktury testowej (lekka kontrola — nie badaj całego świata):**
   - Jeśli istnieje `context/foundation/test-stack.md`, przeczytaj go — zawiera runner, środowisko, konwencje i komendy uruchamiania. Użyj go i pomiń skanowanie. Jeśli wygląda na nieaktualny (odnosi się do narzędzi/configs, które już nie istnieją), zaznacz to użytkownikowi i przejdź do szybkiego skanowania.
   - W przeciwnym razie wykonaj **szybkie** skanowanie konwencji (to nie jest intensywna faza badania infra): znajdź konfigurację testów oraz 1–2 reprezentatywne istniejące pliki testowe, aby poznać styl importów, zagnieżdżanie describe/it, wzorce mocków i komendę uruchamiającą **pojedynczy** plik testowy. Wystarczy pojedynczy `Glob` dla `*.test.*` / `*.spec.*` oraz odczytanie jednego przykładu.
   - **Jeśli w ogóle nie ma runnera ani konfiguracji testów**, ZATRZYMAJ się:

```
Ten plan wymaga działającego runnera testów, zanim będę mógł prowadzić go metodą test-first — nie znalazłem żadnego
(brak konfiguracji vitest/jest/playwright/pytest, brak skryptów testowych, brak istniejących plików *.test.*).

Ta umiejętność zakłada, że infrastruktura testowa już istnieje; nie będzie jej konfigurować. Opcje:
  • Najpierw skonfiguruj runner, a potem uruchom ponownie /10x-tdd.
  • Użyj /10x-implement, aby zbudować plan bez test-first.
  • Użyj /10x-test-plan dla etapowej strategii wdrożenia testów.
```

5. **Zaktualizuj `change.md`**: ustaw `status: implementing` (tylko jeśli obecnie ma wartość `{planned, plan_reviewed}`) i `updated: <today>`.

6. **Utwórz jedno zadanie na fazę** (pojawiają się one na pasku stanu użytkownika): dla każdego nagłówka `## Phase N:` wywołaj `TaskCreate` z `subject: "Phase N: [Phase Name]"` oraz `activeForm: "TDD Phase N"`. Oznacz bieżącą fazę jako `in_progress` przed rozpoczęciem; oznacz ją jako `completed`, gdy jej kryteria sukcesu przejdą.

7. **Znajdź punkt początkowy**: przeskanuj `## Progress` — pierwsze `- [ ]` w kolejności dokumentu jest miejscem rozpoczęcia. Jeśli przekazano argument `phase N`, przejdź do pierwszego `- [ ]` pod `### Phase N:`.

> **Konwencja schowka.** Gdziekolwiek ta umiejętność mówi *skopiuj `X` do schowka*, prześlij dokładny string `X` do schowka platformy — spróbuj `pbcopy` (macOS), następnie `clip.exe` (Windows/WSL), potem `xclip -selection clipboard` (Linux), i dyskretnie zastosuj fallback, jeśli żadne z nich nie istnieje. Następnie wyświetl skopiowaną komendę w osobnej linii z sufiksem `(✓ copied)`.

---

## Bramka kwalifikacji TDD — uruchamiaj przed każdą fazą

Zanim napiszesz pojedynczy test dla fazy, rozstrzygnij w tej kolejności dwie rzeczy:

1. **Brak implementacji** — produkcyjna implementacja fazy nie jest jeszcze obecna.
2. **Możliwość TDD** — faza może być sensownie prowadzona przez nieprzechodzący test.

Faza kwalifikuje się do tej umiejętności tylko wtedy, gdy oba warunki są spełnione.

### Zatrzymanie z powodu istniejącej implementacji

Najpierw sprawdź `Changes Required`, `Success Criteria` i oczekujące wiersze `## Progress` fazy, a następnie wykonaj ukierunkowane wyszukiwanie kodu dla plików, symboli, endpointów, migracji, komend, powierzchni UI lub wpisów config, które faza ma dodać lub zmienić. To szybka kontrola rzeczywistości, nie szerokie badanie.

Jeśli podstawowa implementacja fazy już istnieje lub istnieje częściowo, ZATRZYMAJ się natychmiast. Nie dodawaj testów po fakcie, nie refaktoryzuj istniejącego kodu, nie oznaczaj wierszy Progress i nie proponuj kontynuowania inline. TDD nie działa dla już istniejącego kodu, ponieważ nieprzechodzący test nie prowadzi już implementacji.

Wyświetl ten blok, uzupełniając konkretne dowody:

```
Faza [N] ma już wdrożoną implementację, więc nie mogę prowadzić jej metodą TDD.

TDD nie działa dla już istniejącego kodu; nieprzechodzący test musi poprzedzać kod produkcyjny. Tutaj znalazłem istniejącą implementację:
- [dowód: plik/symbol/endpoint/etc.]

Użyj /10x-implement, aby kontynuować tę fazę:
→ /10x-implement <change-id> phase [N]
```

Skopiuj `/10x-implement <change-id> phase [N]` do schowka zgodnie z konwencją schowka, wyświetl go z `(✓ copied)` po powodzeniu i ZATRZYMAJ się. `/10x-implement` może kontynuować fazę na podstawie istniejącego kodu i stanu planu.

Jeśli implementacja nie istnieje, przejdź do kontroli możliwości TDD.

### Kontrola możliwości TDD

Po potwierdzeniu braku implementacji zdecyduj, czy faza może być **sensownie prowadzona przez nieprzechodzący test**. Fazę można wykonać metodą TDD, gdy istnieje **obserwowalny wynik, który możesz asertywnie sprawdzić, zanim kod powstanie**.

| Możliwe do TDD — prowadź tutaj | Niemożliwe do TDD — przekieruj do `/10x-implement` |
|---|---|
| Czyste funkcje, transformacje danych, parsery, walidatory | Czysty scaffolding: tworzenie dirów, plików config, edycje `package.json`/manifest |
| Maszyny stanów / reduktory / obliczanie flag | Integracja i infra: pliki CI, Dockerfiles, konfiguracja env, config wdrożenia |
| Kontrakty żądanie → odpowiedź API (status, shape, auth, gating) | Dopracowanie wizualne / stylowania bez ścieżki automatycznych asercji w stacku |
| Logika biznesowa z jasnymi wejściami/wyjściami | Eksploracyjne spike'i, w których kontrakt nie jest jeszcze znany |
| Przepływy integracyjne przez możliwe do mockowania granice (DB/KV/HTTP) | Dokumentacja, komentarze, edycje wyłącznie treści |
| Poprawki błędów (najpierw napisz nieprzechodzącą reprodukcję) | Cienki glue, gdzie test jedynie powtarzałby implementację (tautologiczny) |

**Jak stosować kontrolę możliwości TDD:**

- Jeśli implementacja nie istnieje, a faza jest **wyraźnie możliwa do TDD**, stwierdź to w jednej linii i przejdź do pętli red-green-refactor.
- Jeśli faza **wyraźnie nie jest możliwa do TDD**, wykonaj **przekierowanie** (poniżej).
- Jeśli jest **mieszana lub niejednoznaczna** (np. faza, która tworzy scaffolding config, *a także* dodaje walidator z prawdziwą logiką), użyj `AskUserQuestion`:

  - question: "Phase [N] is partly scaffolding, partly logic. How should I drive it?"
    header: "TDD gate"
    options:
    - label: "TDD the testable part (Recommended)"
      description: "I'll red-green-refactor the [logic] and implement the scaffolding inline as plain steps."
    - label: "Redirect whole phase to /10x-implement"
      description: "Hand the entire phase off — copy the resume command to the clipboard."
    - label: "TDD the whole phase anyway"
      description: "Force test-first even for the thin parts. May produce low-value tests."
    multiSelect: false

### Przekieruj fazę niemożliwą do TDD do `/10x-implement`

Wyjaśnij, *dlaczego* faza nie pasuje (jedno lub dwa zdania, oparte na powyższej tabeli), a następnie użyj `AskUserQuestion`:

- question: "Phase [N] isn't a good test-first fit. How do you want to handle it?"
  header: "Not TDD'able"
  options:
  - label: "Hand off to /10x-implement (Recommended)"
    description: "Copy `/10x-implement <change-id> phase N` to the clipboard. Clear context, run it, then resume TDD on the next phase."
  - label: "Implement inline here (no test-first)"
    description: "I'll build this phase directly from the plan and run its success criteria — then continue to the next phase's gate."
  - label: "Skip — already done"
    description: "Mark the phase's Progress rows and move to the next phase."
  multiSelect: false

**Przy „Hand off”:** skopiuj `/10x-implement <change-id> phase [N]` do schowka (zgodnie z konwencją schowka), wyświetl poniższy blok i ZATRZYMAJ się — `/10x-implement` zmieni wiersze Progress tej fazy i uruchomi własny rytuał commita. Powiedz użytkownikowi, aby później wznowił TDD.

```
Faza [N] nie jest materiałem do test-first — [jednoliniowy powód].

→ /10x-implement <change-id> phase [N] (✓ copied)

Wyczyść kontekst (`/clear`), uruchom to, a następnie wróć z:
→ /10x-tdd <change-id> phase [N+1]
```

**Przy „Implement inline”:** zbuduj fazę bezpośrednio z planu (zgodnie z `lessons.md` i istniejącymi konwencjami), uruchom jej automatyczne kryteria sukcesu, a następnie przejdź do rytuału końca fazy — ale pomiń ramy RED/GREEN w wiadomości commita (użyj zwykłego tematu `feat`/`chore`/`refactor`). Następnie przejdź do bramki kolejnej fazy.

**Przy „Skip”:** zmień wiersze Progress fazy z `[ ]` → `[x]` (bez SHA, ponieważ nic nie zostało zacommitowane) i przejdź do kolejnej fazy.

---

## Cykl Red-Green-Refactor

W obrębie fazy możliwej do TDD pracuj zachowanie po zachowaniu. Każdy krok `#### Automated` w Progress fazy (lub każde odrębne zachowanie w jej Changes Required) to jedno przejście przez pętlę. Utrzymuj krótką pętlę — mały test, mały kod, częste uruchamianie.

### Budżet testów na fazę

Napisz **skupiony** zestaw, a nie wyczerpujące pokrycie — zazwyczaj **2–5 testów na fazę**. Wybierz zachowania, które dowodzą, że faza działa, i wychwyciłyby rzeczywiste regresje. Ustanawiasz wzorzec; developer rozszerzy go później. Nie pisz testu dla każdego gettera ani stałej.

### RED — najpierw napisz nieprzechodzący test

1. Napisz **jeden** test (lub zwarty klaster) dla kolejnego zachowania, zgodnie z konwencjami odkrytymi w Setup — stylem importów, zagnieżdżaniem describe/it, istniejącymi helperami mocków. Nie wymyślaj nowych wzorców.
2. Nazwij go według **wyniku**, a nie mechanizmu. Dobrze: `"returns 429 when token exceeds 20 submissions per hour"`. Źle: `"calls rateLimiter.check()"`.
3. Testuj **wyniki, nie wnętrze implementacji** — asertywnie sprawdzaj wartości zwracane, renderowany output, odpowiedzi HTTP lub kształt stanu, nigdy prywatne wywołania metod lub kolejność wykonania.
4. **Uruchom tylko ten plik testowy** za pomocą odkrytego w Setup wywołania projektu dla pojedynczego pliku (np. forma runnera `run <path>`, output skrócony do końcówki) i potwierdź, że **nie przechodzi z właściwego powodu** — błąd asercji albo „module not found / not implemented” dla kodu, który zaraz napiszesz, **a nie** błąd składni ani uszkodzony import w samym teście. Krótko pokaż użytkownikowi czerwony wynik.

Nigdy nie używaj `it.skip()` / `xit()`, aby „przejść” fazę — pominięty test jest niewidoczny. Sednem jest czerwony stan.

### GREEN — minimalny kod, aby test przeszedł

5. Napisz **najmniejszy** kod produkcyjny, który powoduje przejście nieprzechodzącego testu. Nie twórz niczego na zapas przed testem — przyszłe zachowania dostają własny krok RED.
6. Uruchom test ponownie. Potwierdź **zielony stan**. Jeśli inne testy się zepsuły, zmieniłeś zachowanie — popraw kod (nie testy), aż zestaw znów będzie zielony.

### REFACTOR — uporządkuj, zachowaj zielony stan

7. Gdy test jest zielony, popraw nazwy, usuń duplikację, zaostrz typy — **bez zmiany zachowania**. Uruchamiaj ponownie po każdej istotnej zmianie; test musi pozostać zielony. Pomiń ten krok, jeśli nie ma czego porządkować.

8. **Oznacz krok jako wykonany.** Zmień dokładnie wiersz tego kroku w `## Progress`: `- [ ] N.M <title>` → `- [x] N.M <title>` (jeszcze bez SHA — SHA zostanie dodane na końcu fazy). Następnie wróć do RED dla kolejnego zachowania.

Powtarzaj RED→GREEN→REFACTOR, aż każdy krok `#### Automated` w fazie będzie oznaczony `[x]`, a kryteria sukcesu fazy będą spełnione.

---

## Ukończenie fazy

Gdy wszystkie wiersze `#### Automated` w `### Phase N:` mają status `[x]`, uruchom rytuał końca fazy (odzwierciedla on `/10x-implement` — jeden commit Conventional-Commits na fazę, a następnie zapisanie jego krótkiego SHA z powrotem w wierszach, które zostały zmienione).

> **Twardy niezmiennik — commit tylko na zielonym stanie.** Nigdy nie proponuj, nie stage'uj ani nie twórz commita, gdy jakikolwiek test w zakresie jest RED, pominięty dla pozorowanego przejścia albo w inny sposób zepsuty. Commit jest proponowany **dopiero po utrzymaniu stanu GREEN (lub REFACTOR) i przejściu pełnego zestawu**. Krok RED to przejściowy punkt kontrolny pokazywany użytkownikowi, nigdy granica commita. Jeśli zestaw jest czerwony na końcu fazy, popraw kod, aż będzie zielony — nie przechodź do kroku 1 rytuału z nieprzechodzącymi testami.

Utrzymuj **zbiór dotkniętych plików** przez całą fazę: każdy plik, który `Edit`/`Write` (testy *i* kod produkcyjny), trafia do niego, wraz z `context/changes/<change-id>/plan.md` (zawsze — edytujesz jego Progress). W **pierwszej fazie** zmiany dodaj także wszelkie nieśledzone/zmodyfikowane pliki wewnątrz `context/changes/<change-id>/` (`change.md`, `research.md` itd.). Zbiór **resetuje się na każdej granicy fazy**.

1. **Uruchom pełny zestaw** (nie tylko pojedyncze pliki) i potwierdź zielony stan. Napraw wszelkie problemy międzyfazowe przed commitem.

2. **Bramka ręcznego potwierdzenia.** Powiedz człowiekowi, że automatyczna weryfikacja przeszła, wymień ręczne elementy weryfikacji z planu dla tej fazy i zatrzymaj się. Nie kontynuuj, dopóki nie potwierdzi.

```
Faza [N] ukończona (test-first) — Gotowa do ręcznej weryfikacji

Automatyczna weryfikacja przeszła:
- [testy, które są teraz zielone: wymień kluczowe]
- [inne automatyczne kontrole: lint, types, pełny zestaw]

Wykonaj proszę ręczne kroki weryfikacji z planu:
- [ręczne elementy dla tej fazy]

Daj mi znać, gdy ręczne testowanie zostanie ukończone, abym mógł utworzyć commit.
```

   W **ostatniej fazie** zbierz także wszystkie wciąż oczekujące wiersze `#### Manual` z wcześniejszych faz (informacyjnie; bramka nadal tylko wstrzymuje, nie blokuje bezwzględnie).

3. **Wykryj niepowiązane brudne ścieżki.** Uruchom `git status --porcelain`; przetnij z ścieżkami **poza** zbiorem dotkniętych plików. Jeśli jakieś istnieją, przedstaw je i zapytaj przez `AskUserQuestion`, czy commitować tylko planowany zestaw (Recommended), stage'ować wszystko, czy przerwać. Jeśli żadnych nie ma, pomiń.

4. **Stage'uj jawnie według ścieżki** — `git add` każdy plik ze zbioru dotkniętych plików po nazwie. Nigdy `git add -A` / `git add .`.

5. **Kontrola pustego diff.** `git diff --cached --quiet`; jeśli kod wyjścia to 0, wyświetl informację, że faza nie miała diff (wiersze pozostają bez SHA), ustaw `SHA=""` i przejdź do kroku 8.

6. **Zaproponuj wiadomość Conventional-Commits** i zatwierdź ją przez `AskUserQuestion` (zaakceptuj zgodnie z propozycją / edytuj subject / nadpisz). Subject: `<type>(<change-id>): <phase title> (p<N>)`. Dla faz wykonanych metodą TDD preferuj `test`/`feat` i wspomnij o naturze test-first w body. Dołącz linię `Refs:`, jeśli rozmowa zawiera prawdziwe referencje Jira/Linear/GitHub (nigdy nie wymyślaj ich na podstawie change-id ani branch).

7. **Utwórz commit** za pomocą pojedynczego `git commit` z body heredoc, zgodnie z globalnym protokołem wiadomości commita: zatwierdzona linia subject, a następnie krótkie body wymieniające dodane testy + dotknięty kod produkcyjny (oraz linię `Refs:`, gdy ma zastosowanie). Nigdy nie przekazuj flag `--no-verify` / `--amend` / omijających podpisywanie. Jeśli hook pre-commit zawiedzie, napraw przyczynę i utwórz NOWY commit.

8. **Pobierz i zapisz z powrotem SHA.** `git rev-parse --short HEAD` → `SHA`. Dla każdego wiersza Progress zmienionego w tej fazie wykonaj Edit `- [x] N.M <title>` → `- [x] N.M <title> — <SHA>` (pomiń wiersze, które już zawierają SHA; jeśli `SHA=""`, pomiń — `/10x-archive` pokazuje wiersze bez SHA jako ostrzeżenia informacyjne).

9. **Zaktualizuj `change.md`**: `updated: <today>`; zachowaj `status: implementing` aż do ostatniej fazy.

10. **Zresetuj zbiór dotkniętych plików** przed kolejną fazą.

### Decyzja dotycząca następnej fazy

Użyj `AskUserQuestion`:

- question: "Phase [N] complete (test-first). How to proceed?"
  header: "Next phase"
  options:
  - label: "Continue to Phase [N+1]"
    description: "Stay in this context; run the TDD-ability gate for the next phase and proceed."
  - label: "Clear context first"
    description: "Copy the resume command to the clipboard. Start fresh for Phase [N+1]."
  - label: "Review this phase first"
    description: "Run /10x-impl-review to verify the implementation against the plan before continuing."
  multiSelect: false

**Continue:** przeczytaj kolejną fazę, ustaw jej zadanie jako `in_progress`, uruchom bramkę TDD, kontynuuj. Nie ma potrzeby ponownego czytania całego planu.

**Review:** uruchom `/10x-impl-review @<path-to-plan> phase [N]`, a następnie ponownie przedstaw decyzję continue/clear (bez opcji review).

**Clear:** skopiuj `/10x-tdd <change-id> phase [N+1]` do schowka (zgodnie z konwencją schowka) i wyświetl go jako `→ /10x-tdd <change-id> phase [N+1] (✓ copied)`.

Jeśli otrzymasz polecenie uruchomienia kolejno wielu faz, pomiń to pytanie między fazami. Nie odznaczaj wierszy **manual**, dopóki użytkownik nie potwierdzi.

---

## Śledzenie stanu

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy** — bez pliku stanu, bez znaczników komentarzy (zobacz `references/progress-format.md`). Ta umiejętność modyfikuje Progress dokładnie jak `/10x-implement`: zmienia `[ ]` → `[x]` dla każdego kroku po jego zakończeniu; dodaje SHA końcowego commita do każdego zmienionego wiersza, jednorazowo na końcu fazy. W trakcie fazy ukończone wiersze mają `[x]` bez SHA — jest to prawidłowy stan pośredni. Ponieważ obie umiejętności zapisują tę samą sekcję identycznie, zmiana może być prowadzona przez jedną lub obie, w dowolnej kolejności.

**„Gdzie jestem?” jest wyprowadzane, a nie przechowywane:** pierwsza linia `- [ ]` jest kolejnym krokiem; zawierająca ją sekcja `### Phase N:` jest bieżącą fazą; ukończenie to `count([x]) / count([ ] + [x])`.

---

## Po wszystkich fazach

Gdy każde `- [ ]` w całej sekcji `## Progress` ma status `[x]`:

1. **Defensywne skanowanie zaległości.** Przeskanuj ponownie pod kątem pozostałych `- [ ]`. W normalnym przepływie nie ma żadnych. Jeśli jakieś istnieją (pozostawiła je ręczna edycja lub pominięty trigger), wymień je pogrupowane według Automated/Manual i zapytaj przez `AskUserQuestion`, czy **Pause** (ZATRZYMAJ się, nie dotykaj `change.md`) czy **Proceed to epilogue**.

2. **Zaktualizuj `change.md`**: `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — od tego jest `/10x-archive`.)

3. **Commit epilogu.** Zapis SHA ostatniej fazy oraz zmiana statusu `change.md` pozostają brudne po końcowym rytuale. Stage'uj dokładnie `plan.md` + `change.md` (jawne ścieżki), sprawdź `git diff --cached --quiet` (pomiń, jeśli pusty), zaproponuj `chore(<change-id>): close out plan (epilogue)`, uzyskaj zatwierdzenie i utwórz commit przez heredoc. NIE zapisuj własnego SHA epilogu z powrotem.

4. **Podsumowanie ukończenia + opcjonalna recenzja:**

```
Wszystkie fazy zaimplementowane metodą test-first! 🎉

Podsumowanie:
- Ukończone fazy: [N]  ([k] wykonano metodą TDD, [j] przekierowano do /10x-implement)
- Dodane testy: [count] w [files]
- Zmienione pliki: [key files]
```

   Następnie `AskUserQuestion`: uruchomić `/10x-impl-review <change-id>` (recenzja całego planu) albo pominąć.

---

## Wytyczne TDD

### Co czyni tutaj dobry test

- Opisuje **co** robi system, a nie **jak** robi to wewnętrznie.
- Nie przechodzi z **właściwego powodu** — zachowanie jeszcze nie istnieje, a nie z powodu uszkodzonego testu.
- Jest **stabilny** — przetrwa refaktoryzację, psuje się tylko przy zmianie zachowania.
- Jest **minimalny** — najmniejsze istotne zachowanie, najprostsza konfiguracja.

### Czego unikać

- Testowania szczegółów implementacji (prywatny stan, wewnętrzna kolejność wywołań, sekwencjonowanie efektów ubocznych).
- Nadmiernego mockowania — jeśli wszystko jest mockowane, testujesz swoje mocki. Nie mockuj testowanej rzeczy; mockuj jej współpracowników (KV, DB, HTTP).
- Testów snapshot dla logiki biznesowej (snapshoty służą stabilności renderowania UI).
- Niemal zduplikowanych testów z nieznacznie różnymi nazwami; testów trywialnego kodu.
- Tworzenia kodu produkcyjnego przed nieprzechodzącym testem — każde zachowanie najpierw zasługuje na własny krok RED.

### Obsługa niejednoznaczności planu

Jeśli kryteria akceptacji fazy są niejasne („works as expected”), nie zgaduj. Sprawdź Desired End State oraz Changes Required fazy pod kątem konkretnych wejść/wyjść. Jeśli nadal nie jest jasne, zadaj użytkownikowi jedno skupione pytanie o to, jak wygląda „success”, przed napisaniem testu RED.

### Obsługa niezgodności plan ↔ rzeczywistość

Jeśli faza nie może być zaimplementowana zgodnie z opisem, ZATRZYMAJ się i przedstaw to jasno:

```
Problem w fazie [N]:
Oczekiwano: [co mówi plan]
Znaleziono: [faktyczna sytuacja]
Dlaczego to istotne: [wyjaśnienie]
```

Następnie `AskUserQuestion` — Adapt and continue / Skip this part / Stop and re-plan.

### Umieszczanie plików

Postępuj zgodnie z konwencją odkrytą w Setup. Wartości domyślne, jeśli żadna nie istnieje:

- **Testy jednostkowe** — obok pliku źródłowego (`src/[module]/thing.test.ts`).
- **Testy integracyjne / API** — w `tests/` (`tests/[feature]/thing.test.ts`).
- **Testy E2E** — w katalogu e2e projektu (`tests/e2e/[feature].spec.ts`).

### Jeśli utkniesz

Używaj podzadań oszczędnie — `Explore` do szybkiego wyszukiwania plików/wzorców, `general-purpose` do wieloetapowej analizy nieznanego obszaru. Najpierw upewnij się, że przeczytałeś odpowiedni kod; weź pod uwagę, że codebase mógł ewoluować od czasu napisania planu.