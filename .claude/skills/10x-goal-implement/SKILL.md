---
name: 10x-goal-implement
description: >
  Autonomously implement technical plans from
  context/changes/<change-id>/plan.md under Claude Code's
  /goal — no human interaction at any point. Sibling of /10x-implement for
  unattended runs, in an interactive /goal session or headless via claude -p.
  Delegates each phase's code changes to a subagent, flips the
  plan's Automated Progress rows, verifies each phase through an automatic
  quality-gate stack (plan success criteria, deliberate-break check, full suite),
  commits each phase on green with Conventional Commits, and
  surfaces pending Manual rows as a closing human checklist. Use when the user
  wants autonomous or unattended plan execution, pairs /goal with a plan, asks to
  "run the plan under /goal", or needs headless implementation.
argument-hint: <change-id> [phase N]
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - Edit
  - Bash
  - Agent
  - Task
  - TaskCreate
  - TaskUpdate
  - TaskList
  - TaskGet
---
# Autonomicznie wdrażaj plan (w ramach `/goal`)

Twoim zadaniem jest wdrożenie zatwierdzonego planu technicznego z `context/changes/<change-id>/plan.md` bez interakcji z człowiekiem. Plany zawierają fazy z konkretnymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem wykonania (zobacz `references/progress-format.md`). Ta umiejętność jest autonomicznym odpowiednikiem `/10x-implement`: współdzieli te same kontrakty planu — rozwiązywanie planu, `## Progress` jako jedyne źródło prawdy, śledzenie zmodyfikowanych plików, protokół Conventional Commits, cykl życia `change.md` — ale każda decyzja, którą podjąłby człowiek, zostaje zastąpiona jawną automatyczną polityką.

## Pozycjonowanie i wywołanie

Uruchamiaj tę umiejętność w ramach sesji `/goal`. Warunek celu jest testem zatrzymania na poziomie sesji; ta umiejętność jest polityką wykonania, która go spełnia.

- **Interaktywnie**: najpierw ustaw cel, następnie wywołaj umiejętność — `/goal <condition>`, a potem `/10x-goal-implement <change-id> [phase N]`.
- **Bez interakcji**: `claude -p "/goal <condition> /10x-goal-implement <change-id>" --allowedTools "Read,Glob,Grep,Write,Edit,Bash,Agent,Task,TaskCreate,TaskUpdate,TaskList,TaskGet" --permission-mode acceptEdits`.

Szablon warunku `/goal` do skopiowania i wklejenia (uzupełnij `<change-id>` oraz limit tur `<N>`, zwykle 20):

```
Use the 10x-goal-implement skill to implement all phases of
context/changes/<change-id>/plan.md. Done when: every row under
#### Automated in the plan's ## Progress section is checked, each
phase has its own Conventional-Commits commit, and the final output
lists any pending #### Manual rows. Constraints: do not modify or
weaken existing tests unless the plan says so; do not touch files
outside the plan's scope. Stop after <N> turns if not complete.
```

Ewaluator celu odczytuje **wyłącznie transkrypcję rozmowy** — nie może uruchamiać poleceń ani odczytywać plików. Wszystko, co testuje warunek, musi zatem zostać opisane w tekście odpowiedzi: werdykty bramek, SHA commitów, oczekujące wiersze Manual. Bramka, która przeszła bez komunikatu, jest nieodróżnialna od bramki, która nigdy nie została uruchomiona. Opisuj to.

## Polityka braku interakcji

Nikt nie obserwuje tego uruchomienia. Nigdy nie wywołuj interaktywnych narzędzi do zadawania pytań — nie ma nikogo, kto mógłby odpowiedzieć, a przy wywołaniu bez interakcji takie wywołanie kończy uruchomienie niepowodzeniem. Każda decyzja jest podejmowana według polityk zawartych w tym dokumencie. Gdy coś jest rzeczywiście niejednoznaczne i żadna z poniższych polityk tego nie rozstrzyga, wybierz konserwatywną interpretację, opisz wybór w tekście odpowiedzi i zapisz go w raporcie z uruchomienia. Konserwatywna oznacza: interpretację, która dotyka mniejszej liczby plików, zmienia mniej zachowań i pozostaje najbliżej dosłownego tekstu planu.

## Konfiguracja

Gdy to polecenie zostanie wywołane:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-goal-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaakceptuj ją.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wypisz „This change is archived. Open a new change with `/10x-new` instead.” i ZATRZYMAJ się.
   - Jeśli nie podano planu lub rozwiązany plik nie istnieje, wypisz jedną linię — `Cannot start: no plan resolved from "<input>". Provide a change-id or plan path.` — i ZATRZYMAJ się. Nie zgaduj `change-id`.

2. **Załaduj kontekst**:
   - Przeczytaj cały plan. Sekcja `## Progress` na dole jest autorytatywna dla stanu wykonania — znaczniki wyboru (`- [x]`) występują TYLKO tam. Bloki faz zawierają zwykłe wypunktowania `- ` (bez pól wyboru).
   - Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane przez zespół, powtarzające się reguły i muszą kształtować każdy wybór implementacyjny w tym uruchomieniu. Ponieważ implementacja jest delegowana (zobacz „Model wykonania dla każdej fazy”), przekaż każdy wpis lessons do dyspozycji każdej fazy — podagent nie widzi pliku, chyba że go przekażesz.
   - Przeczytaj wszystkie pliki wymienione w planie (powiązane badania, ramę, pliki źródłowe w tym samym folderze zmiany).
   - **Czytaj pliki w całości** — nigdy nie używaj parametrów limit/offset; potrzebujesz pełnego kontekstu.

3. **Wstępnie sprawdź bramki**: zbierz polecenia ze zautomatyzowanych kryteriów sukcesu każdej fazy i zweryfikuj, czy każde można uruchomić w tym środowisku (istnieje binarium lub skrypt pakietu — np. sprawdź skrypty `package.json`, `command -v`, cele `Makefile`). Kryterium, którego polecenia nie można uruchomić, jest strukturalnym niedopasowaniem fazy, która go potrzebuje: opisz brakujące polecenie teraz (`PREFLIGHT: <command> not runnable — Phase <N> will stop unless fixed`), a gdy wykonanie dotrze do tej fazy, wypisz blok STOP i zatrzymaj się. Nie pomijaj po cichu nieweryfikowalnego kryterium.

4. **Zaktualizuj `change.md`**: ustaw `status: implementing` (tylko jeśli aktualnie jest w `{planned, plan_reviewed}`) oraz `updated: <today>`. Następnie **zsynchronizuj roadmapę** (według najlepszych starań) — jeśli `context/foundation/roadmap.md` zawiera element, którego `Change ID` jest równe `<change-id>`, zmień go na `Status: in-progress`, otwarty odpowiednik zmiany na `done` wykonywanej przez `/10x-archive`. Zobacz „## Roadmap status sync” poniżej; opisz wynik, nigdy nie zatrzymuj się z jego powodu.

5. **Utwórz zadania faz**: policz łączną liczbę faz (na podstawie nagłówków `## Phase N:`) i utwórz po jednym wpisie TaskCreate dla każdej fazy (`subject: "Phase N: [Phase Name]"`, `activeForm: "Implementing Phase N"`). Ustaw bieżącą fazę jako `in_progress` przez TaskUpdate przed rozpoczęciem pracy; oznacz ją jako `completed`, gdy jej bramki przejdą i jej commit zostanie utworzony.

6. **Znajdź następny oczekujący krok**: przeskanuj sekcję `## Progress` pod kątem pierwszego wiersza `- [ ]` **pod podsekcją `#### Automated`** w kolejności dokumentu — od tego miejsca zaczynasz. Wiersze pod `#### Manual` są poza twoją jurysdykcją (zobacz „Manual rows” poniżej); pomiń je podczas ustalania punktu wznowienia. Jeśli przekazano argument `phase N`, przejdź do pierwszego zautomatyzowanego `- [ ]` wewnątrz `### Phase N:`.

## Taksonomia niedopasowań

Plany są starannie projektowane, ale rzeczywistość może być chaotyczna. Gdy baza kodu nie odpowiada temu, co opisuje plan, sklasyfikuj niedopasowanie i działaj — nigdy nie edytuj bloków faz, aby dopasować plan. W trakcie fazy podagent implementacyjny napotyka te niedopasowania bezpośrednio: dostosowuje **drobne** i je raportuje, a przy **strukturalnym** zatrzymuje się i przekazuje szczegóły do głównego kontekstu, który wypisuje blok STOP.

**Drobne** — przeniesiony plik, zmieniona nazwa symbolu, rozbieżność importu, trywialna różnica w API lub konfiguracji. Intencja planu pozostaje nienaruszona; zmieniła się tylko lokalizacja. Dostosuj implementację do rzeczywistości, opisz dostosowanie w jednej lub dwóch liniach (`ADAPT: plan says src/auth.ts, file is now src/auth/index.ts`) i uwzględnij je w raporcie z uruchomienia.

**Strukturalne** — brakująca zależność, architektura różniąca się od założeń planu, wskazany plik lub API, które nie istnieje, faza zależna od wyniku, którego poprzednia faza nigdy nie wytworzyła. Plan nie może zostać wykonany zgodnie z zapisem, a dostosowanie oznaczałoby jego przeprojektowanie. Wypisz blok STOP i zatrzymaj się.

W razie wątpliwości między tymi dwoma kategoriami traktuj problem jako strukturalny. Błędne przypuszczenie powodujące zatrzymanie kosztuje jedno wznowienie; błędne przypuszczenie powodujące dostosowanie może dostarczyć przeprojektowanie, którego nikt nie zatwierdził.

## Model wykonania dla każdej fazy

Każda faza przebiega w dwóch częściach z twardym podziałem obowiązków:

- **Implementacja jest delegowana.** Wyślij pojedynczego podagenta `Task`, aby zapisał zmiany w kodzie fazy. Obszerna praca — odczytywanie plików źródłowych, rozumowanie o zmianach, stosowanie edycji — odbywa się we własnym kontekście podagenta, dzięki czemu główna transkrypcja pozostaje zwięzła podczas długiego uruchomienia wielofazowego.
- **Wszystko, co musi zobaczyć ewaluator celu, pozostaje w głównym kontekście.** Wykonywanie bramek, linie werdyktów, staging, commity, SHA, zmiany Progress, bloki STOP i raport z uruchomienia są realizowane w głównym kontekście i opisywane w tekście odpowiedzi. Ewaluator celu odczytuje wyłącznie główną transkrypcję — wewnętrzna praca podagenta jest dla niego niewidoczna, więc nic, co testuje warunek celu, nie może pozostać wewnątrz podagenta.

### Wysyłanie podagenta implementacyjnego

Dla każdej fazy, przed stosem bramek, wyślij jedno wywołanie `Task` (`subagent_type: general-purpose`), którego prompt zawiera:

- Change-id oraz numer + tytuł fazy.
- Pełną sekcję planu fazy dosłownie — Overview, Changes Required, Success Criteria. (Success Criteria jest kontekstem, aby podagent znał cel; NIE uruchamia on bramek — robi to główny kontekst).
- **Dyscyplinę implementacyjną do stosowania.** Rozwiąż `references/implementation-discipline.md` (znajduje się obok tego `SKILL.md`) do **bezwzględnej ścieżki** i poleć podagentowi ją przeczytać oraz zastosować — uruchomiony agent `Task` nie ma pojęcia o katalogu tej umiejętności, więc ścieżka względna lub „przeczytaj referencję tej umiejętności” nie zostanie rozwiązana. Ten plik jest wspólną warstwą rzemiosła: czytaj wskazany kod w całości, dostosowuj do rzeczywistości bez przeprojektowywania, weryfikuj, że zmiana pasuje do otaczającej bazy kodu, stosuj lessons i wykonuj wyszukiwanie `Explore` przed edycją nieznanego obszaru. Zachowaj go jako jedyne źródło — wskaż go, nie przepisuj go wprost.
- Każdy wpis z `context/foundation/lessons.md`, jeśli istnieje (podagent nie może odczytać pliku, chyba że wkleisz wpisy).
- Obowiązującą taksonomię niedopasowań: dostosuj **drobne** niedopasowania bezpośrednio i zgłoś je; przy **strukturalnym** niedopasowaniu ZATRZYMAJ się i zgłoś je zamiast dostosowywać lub przeprojektowywać.
- Twarde granice: implementuj WYŁĄCZNIE zmiany w kodzie. Nie uruchamiaj stosu bramek, nie wykonuj stagingu, nie twórz commitów, nie dotykaj sekcji `## Progress` ani żadnego pola wyboru, nie edytuj bloków faz, nie wychodź poza zakres planu, nigdy nie wywołuj narzędzi interaktywnych.

Wymagaj ustrukturyzowanej końcowej wiadomości jako wartości zwracanej (nie notatki dla człowieka):

```
STATUS: completed | structural-mismatch
TOUCHED: <repo-relative path>, <path>, ...      # every file created or edited
ADAPTATIONS: <one line each, or none>
STRUCTURAL: <plan assumption vs. what exists — only when STATUS is structural-mismatch>
UNCERTAINTIES: <ambiguous decisions, or none>
```

Po powrocie:

- **`structural-mismatch`** → nie uruchamiaj bramek. Wypisz blok STOP, używając szczegółu `STRUCTURAL` podagenta, i zatrzymaj się.
- **`completed`** → zainicjuj zbiór zmodyfikowanych plików fazy na podstawie `TOUCHED` (zobacz „Tracking files touched during a phase”), przenieś `ADAPTATIONS` i `UNCERTAINTIES` do raportu z uruchomienia i przejdź do stosu bramek. Nigdy nie ufaj ślepo `TOUCHED` — uzgodnienie `git status --porcelain` podczas stagingu jest kontrolą krzyżową dla pliku, którego podagent dotknął, ale pominął.

## Stos bramek dla każdej fazy

Gdy podagent implementacyjny zwróci `completed` i zbiór zmodyfikowanych plików zostanie zainicjowany z jego listy `TOUCHED`, uruchom tę stałą sekwencję w głównym kontekście — jedyną kanoniczną kolejność dla wszystkiego między „kod zapisany” a „commit utworzony”. Bramki są uruchamiane od najtańszych; staging znajduje się tam, gdzie wymaga go break-check; rytuał commitu jest końcem. Po każdej bramce wypisz jednoliniowy werdykt w tekście odpowiedzi — `GATE <name>: PASS` lub `GATE <name>: FAIL (<summary>, attempt <k>/2)` — aby ewaluator celu go zobaczył.

1. **(a) Kryteria planu** — uruchom polecenia zautomatyzowanych kryteriów sukcesu `#### Automated` fazy z planu, w kolejności. Każde polecenie jest osobną bramką z własną linią werdyktu.

2. **Wykonaj staging zbioru zmodyfikowanych plików** — `git add` każdy plik według ścieżki (definicję zbioru i obsługę brudnych ścieżek zobacz w „Tracking files touched during a phase”). Staging _tutaj_, przed break-check, zapewnia dokładne odtworzenie przez break-check.

3. **(b) Celowy break-check** — tylko dla faz, które dodają lub zmieniają testy. Gdy pliki fazy są w stagingu, zweryfikuj, czy nowy lub zmieniony test rzeczywiście coś chroni:
   1. Odwróć lub osłab chronione zachowanie w kodzie produkcyjnym — edycja tylko w worktree, nigdy w stagingu.
   2. Uruchom odpowiedni test (uruchomienie ograniczone zakresem, np. pojedynczy plik testowy).
   3. Potwierdź, że kończy się niepowodzeniem. Czerwony wynik jest tutaj warunkiem przejścia: `GATE break-check: PASS (test went red on broken code)`.
   4. Odtwórz bezwarunkowo przez `git checkout -- <file>` — resetuje to worktree dokładnie do wersji w stagingu, więc uszkodzenie nigdy nie może trafić do commitu.
   5. Opisz sekwencję (co zostało uszkodzone, że test stał się czerwony, że plik został odtworzony).

   Jeśli test **pozostaje zielony** przy uszkodzonym kodzie, asercja niczego nie chroni — jest to niepowodzenie bramki. Napraw to, wzmacniając asercję, nigdy przez osłabienie kodu produkcyjnego lub pominięcie kontroli. Edycja powodująca uszkodzenie nigdy nie może zostać zacommitowana; odtworzenie w kroku 4 jest bezwarunkowe, także na ścieżce niepowodzenia.

4. **(c) Kontrole całego repozytorium** — pełny zestaw testów, lint, typecheck, wszędzie tam, gdzie definiuje je plan lub repozytorium (np. skrypt `ci:local`, `make check test`). Po jednej linii werdyktu dla każdej.

5. **(d) Commit** — niezmiennik commit-only-on-green: nigdy nie rozpoczynaj rytuału commitu, gdy którakolwiek powyższa bramka jest czerwona. Nie ma wyjątku. Jeśli samonaprawa bramki (b)/(c) zmieniła pliki, ponownie uruchom krok 2, aby je uwzględnić, a następnie przeprowadź autonomiczny rytuał commitu.

## Eskalacja samonaprawy

Nieudana bramka otrzymuje maksymalnie **2** próby samonaprawy. Numeruj je w liniach werdyktów (`attempt 1/2`, `attempt 2/2`). Jeśli ta sama bramka nie powiedzie się trzeci raz, problem jest głębszy niż mechaniczna rozbieżność — wypisz blok STOP i zatrzymaj się zamiast marnować tury.

Zastosuj poprawkę kodu tak samo, jak początkową implementację: wyślij skoncentrowanego podagenta `Task`, przekazując wynik nieudanej bramki oraz problematyczne pliki, i dodaj ścieżki z jego zwróconego `TOUCHED` do zbioru zmodyfikowanych plików fazy przed ponownym stagingiem i uruchomieniem bramki. Trywialne, mechaniczne poprawki (zbędny import, zmiana nazwy) mogą zostać zastosowane bezpośrednio w głównym kontekście. W obu przypadkach limit 2 prób pozostaje bez zmian, a edycja break-check tylko w worktree + bezwarunkowe odtworzenie zawsze pozostają w głównym kontekście — nigdy ich nie deleguj.

Granice dotyczące tego, co może zrobić poprawka:

- Nigdy nie osłabiaj asercji, nie usuwaj testu ani nie rozluźniaj reguły lint/typecheck, aby przejść bramkę, chyba że plan wyraźnie tak stanowi. Popraw kod, aby spełniał kontrolę, a nie kontrolę, aby spełniała kod.
- Gdy oczekiwana wartość testu jest niejednoznaczna — plan i implementacja są rozbieżne, a nie ma niezależnego źródła poprawnej odpowiedzi — nie zgaduj. Oznacz krok jako niepewny w raporcie z uruchomienia, pozostaw werdykt bramki zgodny z prawdą i pozwól, aby ścieżka STOP lub raport ujawniły to człowiekowi.

## Format bloku STOP

Blok STOP jest powierzchnią błędu dla człowieka oraz sygnałem, który ewaluator celu odczytuje jako „nie ukończono”. Wypisz go dokładnie w tym kształcie, a następnie zatrzymaj się — bez dalszych edycji, bez commitu:

```
STOPPED — <STRUCTURAL MISMATCH | GATE FAILURE> in Phase <N>
Expected: <what the plan says / what the gate requires>
Found:    <actual situation / failing output summary>
Why:      <why this blocks autonomous continuation>
Resume:   fix the above, then /10x-goal-implement <change-id> phase <N>
```

Przed zatrzymaniem pozostaw drzewo robocze zgodne z rzeczywistością: ukończone wiersze Progress pozostają przełączone, praca w toku pozostaje w worktree bez commitu, a każda celowa edycja powodująca uszkodzenie jest odtworzona. Wznowienie nie wymaga dodatkowego stanu — pierwszym punktem wejścia jest oczekujący wiersz Automated.

## Śledzenie plików zmodyfikowanych podczas fazy

Rytuał commitu wykonuje staging plików ze **zbioru zmodyfikowanych plików** utrzymywanego w pamięci roboczej przez całą fazę. Ten zbiór jest kanonicznym wejściem dla `git add` — nigdy nie wracaj do heurystyk `git status` przy decyzjach stagingu.

- **Zainicjuj zbiór z listy `TOUCHED` podagenta implementacyjnego**, gdy zwróci `completed`, i dodaj ścieżki zwrócone przez podagenta samonaprawy. Gdy edytujesz plik bezpośrednio w głównym kontekście — pola wyboru `## Progress` w `plan.md`, zmianę statusu `change.md` — również dodaj jego ścieżkę.
- Zbiór zawsze zawiera `context/changes/<change-id>/plan.md` — dodaj go przy wejściu do fazy, przed zmianą jakichkolwiek pól wyboru.
- **Bootstrap fazy 1**: w pierwszej fazie zmiany zainicjuj również zbiór wszystkimi nieśledzonymi lub zmodyfikowanymi plikami wewnątrz `context/changes/<change-id>/` (zwykle `change.md`, `research.md`, `plan.md`), aby pliki kontekstu zmiany trafiły do pierwszego commitu.
- Zbiór **resetuje się na każdej granicy fazy**, po zakończeniu commitu fazy.
- Zbiór ma pierwszeństwo przed `git status`. Plik brudny, ale nieobecny w zbiorze, jest niepowiązany — nigdy nie jest dodawany do stagingu.

**Staging zbioru (krok 2 stosu bramek):** dodaj do stagingu zbiór zmodyfikowanych plików ∪ `{context/changes/<change-id>/plan.md}` (faza 1: zbiór zainicjowany przez bootstrap). Uruchom `git status --porcelain`; żadna brudna ścieżka poza zbiorem stagingu **nigdy nie jest dodawana do stagingu** — wypisz ją jako `DIRTY (not staged): <paths>` w tekście odpowiedzi (aby pojawiła się w transkrypcji i raporcie z uruchomienia), a następnie kontynuuj tylko z zaplanowanym zbiorem. To uzgodnienie jest także zabezpieczeniem przed delegowanym podagentem, który dotknął pliku, ale nie umieścił go w `TOUCHED` — pominięcie ujawnia się jako DIRTY zamiast po cichu przejść przez granicę commitu. Dodawaj do stagingu według nazwy przez `git add` każdego pliku; nigdy `git add -A` ani `git add .`.

## Śledzenie odwołań do zgłoszeń/zadań dla commitów

Przed utworzeniem dowolnej wiadomości commitu fazy lub epilogu przeskanuj kontekst rozmowy pod kątem odwołań do systemów śledzenia powiązanych z tą pracą: kluczy Jira (`ABC-123`), identyfikatorów Linear (`ENG-123`), zgłoszeń/PR GitHub (`#123`, `GH-123`, pełne URL) lub jawnych linków do zadań. Jeśli występują, dodaj linię `Refs:` do treści commitu, zachowując dokładne identyfikatory; wiele odwołań oddziel przecinkami w jednej linii. Nigdy nie wymyślaj ani nie wnioskuj odwołań z change-id, nazwy gałęzi ani nazw plików — używaj wyłącznie tego, co jest widoczne w kontekście. Zastosuj tę samą linię `Refs:` do każdego commitu fazy i epilogu.

## Synchronizacja statusu roadmapy

`context/foundation/roadmap.md` (tworzony przez `/10x-roadmap`) indeksuje każdą Foundation/Slice za pomocą stabilnego **Change ID**. `/10x-archive` zmienia pasujący element na `Status: done`, gdy zmiana trafia do archiwum; ten krok obsługuje bliższy koniec — gdy autonomiczna implementacja *rozpoczyna się*, oznacz pasujący element jako **`in-progress`**, aby roadmapa pokazywała aktywną pracę.

Uruchom to **raz, przy wejściu** (bezpośrednio po oznaczeniu `change.md` → `implementing`), nie dla każdej fazy. Wyszukanie jest **obowiązkowe**; „według najlepszych starań” dotyczy wyłącznie *edycji* — brak roadmapy lub nieznaleziony cel są po cichu pomijane i nigdy nie zatrzymują uruchomienia, nie wywołują bloku STOP ani nie liczą się do limitu samonaprawy. Nie pomijaj sprawdzenia, zakładając, że roadmapy nie ma; opisz wynik (dopasowano + zmieniono, już przesunięte lub brak dopasowania) w tekście odpowiedzi w każdym przypadku, aby ewaluator celu go zobaczył.

1. `test -f context/foundation/roadmap.md`. Jeśli nie istnieje, opisz `ROADMAP: none — skipped.` i pomiń ten krok.
2. Przechwyć stan brudności: `ROADMAP_PREDIRTY=$(git status --porcelain context/foundation/roadmap.md 2>/dev/null)` (używany w kroku 5).
3. Przeczytaj plik. Znajdź `<change-id>` użyty jako `Change ID`:
   - w tabeli `## At a glance` — wiersz, którego komórka **Change ID** jest dokładnie równa `<change-id>`;
   - oraz w treściach `## Foundations` / `## Slices` — blok `### <ID>: …` zawierający linię `- **Change ID:** <change-id>`.

   `<ID>` jest lokalnym identyfikatorem roadmapy elementu (`F-NN` / `S-NN`). Dopasowanie jest wyłącznie dokładnym łańcuchem. **Brak dopasowania** → opisz `ROADMAP: no item with Change ID "<change-id>" — left untouched.` i pomiń resztę.
4. **Znaleziono dopasowanie** → jeśli `- **Status:**` elementu jest już `in-progress` lub `done`, pozostaw go (**tylko do przodu** — nigdy nie cofaj) i opisz `ROADMAP: <ID> already <status> — left untouched.`; przejdź do kroku 5. W przeciwnym razie ustaw komórkę **Status** w `## At a glance` oraz linię `- **Status:**` w treści elementu na `in-progress` (każda edycja jest niezależna i wykonywana według najlepszych starań — pomiń podedycję, której nie ma w miejscu przewidzianym przez szablon, i opisz pominięcie), zwiększ `updated:` frontmatter do `<today>` i opisz `ROADMAP: flipped <ID> → in-progress.`. Dotykaj wyłącznie pola `Status`.
5. Jeśli `git` jest dostępny **i** `ROADMAP_PREDIRTY` było puste, dodaj `context/foundation/roadmap.md` do zbioru zmodyfikowanych plików bieżącej fazy, aby zmiana została zacommitowana wraz z fazą. Jeśli `ROADMAP_PREDIRTY` nie było puste, NIE dodawaj go do zbioru zmodyfikowanych plików, pozostaw zmianę w worktree i opisz `DIRTY (not staged): context/foundation/roadmap.md had pre-existing edits — roadmap flip left in worktree.`

## Autonomiczny rytuał commitu

Uruchamiany wyłącznie jako krok (d) stosu bramek, po tym jak każda bramka jest zielona, a zbiór zmodyfikowanych plików znajduje się w stagingu (krok 2 stosu bramek). Utwórz jeden commit Conventional Commits i zapisz końcowy krótki SHA w każdym wierszu Progress przełączonym podczas fazy. Żaden krok nie zatrzymuje się w oczekiwaniu na zatwierdzenie.

1. **Sprawdź pusty diff**: `git diff --cached --quiet`. Kod wyjścia 0 oznacza brak zmian do zacommitowania — wypisz `Phase <N> had no diff to commit; rows remain SHA-less; archive warn-only will surface them.`, ustaw `SHA=""` i przejdź do kroku 5.

2. **Utwórz wiadomość**: temat `<type>(<change-id>): <phase title> (p<N>)`, gdzie `<type>` ∈ `feat / fix / chore / refactor / docs`, wybrane zgodnie z charakterem fazy. Treść: krótka lista zmodyfikowanych plików oraz linia `Refs:`, gdy ma zastosowanie. Wypisz pełną wiadomość w tekście odpowiedzi przed commitem — jest to zapis w transkrypcji tego, co zacommitowano i dlaczego.

3. **Wykonaj commit przez heredoc**:

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<change-id>): <phase title> (p<N>)

   <short body listing touched files>
   <Refs: issue/task references, if applicable>
   EOF
   )"
   ```

   Nigdy nie przekazuj flag `--no-verify`, `--amend` ani flag omijających podpisywanie. Jeśli hook pre-commit zakończy się niepowodzeniem, commit NIE nastąpił — traktuj niepowodzenie hooka jako niepowodzenie bramki (otrzymuje ten sam limit 2 prób), napraw przyczynę i utwórz NOWY commit.

4. **Przechwyć krótki SHA**: `git rev-parse --short HEAD` (pomiń, jeśli `SHA=""`). Opisz go: `COMMIT p<N>: <sha>`.

5. **Zapisz SHA z powrotem w Progress**: dla każdego wiersza przełączonego podczas tej fazy wykonaj Edit `- [x] N.M <title>` → `- [x] N.M <title> — <SHA>`. Pomiń wiersze, które już zawierają przyrostek SHA (bezpieczeństwo wznowienia — nigdy nie dodawaj dwukrotnie). Jeśli `SHA=""`, pozostaw wiersze bez SHA; `/10x-archive` ujawnia je jako ostrzeżenia informacyjne.

6. **Zaktualizuj `change.md`**: ustaw `updated: <today>`; zachowaj `status: implementing` aż do ostatniej fazy (zobacz „After all phases”).

7. **Zresetuj zbiór zmodyfikowanych plików** i przejdź bezpośrednio do następnej fazy — bez pauzy, bez punktu decyzyjnego. Przeczytaj sekcję planu następnej fazy, ustaw jej zadanie jako `in_progress` i kontynuuj.

## Wiersze Manual

Wiersze pod `#### Manual` należą do człowieka, nigdy do ciebie. Polityka:

- **Nigdy ich nie przełączaj.** Pozostają jako `- [ ]` niezależnie od tego, jak bardzo jesteś pewny, że zachowanie działa.
- **Nigdy nie blokuj się na nich.** Faza jest zacommitowana, gdy jej bramki Automated są zielone; jej wiersze Manual nie blokują commitu ani następnej fazy.
- **Zawsze je ujawniaj.** Podsumowanie bramek każdej fazy zawiera dosłownie oczekujące wiersze Manual tej fazy, a raport z uruchomienia kończy się pełną listą ze wszystkich faz — ta lista jest listą kontrolną człowieka po uruchomieniu.

## Progress i stan

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy.** Bez pliku stanu, bez znaczników komentarzy, bez plików pomocniczych. Modyfikuj TYLKO sekcję `## Progress` — bloki faz (Overview, Changes Required, Success Criteria) są tylko do odczytu.

- **Po każdym kroku**: edytuj dokładnie jedną linię, `- [ ] N.M <title>` → `- [x] N.M <title>`. Bez przyrostka SHA w środku fazy — SHA trafia na końcu fazy przez rytuał. Ukończone wiersze z `[x]` bez SHA w środku fazy są poprawnym stanem pośrednim.
- **Gdzie jestem** jest wyprowadzane, nie przechowywane: pierwszy oczekujący zautomatyzowany `- [ ]` jest następnym krokiem; nagłówek fazy nad nim jest bieżącą fazą; ukończenie to `count([x]) / count([ ] + [x])`.
- **Wznowienie po STOP** nie wymaga dodatkowego stanu: ponowne wywołanie `/10x-goal-implement <change-id> [phase N]` znajduje pierwszy oczekujący zautomatyzowany wiersz i kontynuuje. Ufaj istniejącym oznaczeniom `[x]`; weryfikuj poprzednią pracę tylko, jeśli coś wydaje się nie tak.

### Po wszystkich fazach

Gdy każdy wiersz Automated w całej sekcji `## Progress` ma `- [x]`:

1. Zaktualizuj `change.md`: ustaw `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — należy to do `/10x-archive`.) Oczekujące wiersze Manual nie blokują tej zmiany; są zamiast tego ujawniane w raporcie z uruchomienia.
2. **Uruchom commit epilogu** — commit ostatniej fazy nie może zawierać własnego SHA, więc zapis SHA oraz zmiana statusu `change.md` pozostają brudne po rytuale ostatniej fazy:
   1. Dodaj do stagingu dokładnie `context/changes/<change-id>/plan.md` i `context/changes/<change-id>/change.md`.
   2. `git diff --cached --quiet` — jeśli pusty, pomiń epilog.
   3. Wykonaj commit przez heredoc z tematem `chore(<change-id>): close out plan (epilogue)`, treścią odnotowującą końcowy zapis SHA + change.md → implemented oraz linią `Refs:`, gdy ma zastosowanie.
   4. NIE zapisuj własnego SHA epilogu z powrotem w planie.
3. Wypisz raport z uruchomienia.

## Raport z uruchomienia

Zakończ każde uruchomienie — pomyślne lub zatrzymane — raportem z uruchomienia w tekście odpowiedzi. To czytają ewaluator celu i wracający człowiek:

```
RUN REPORT — <change-id>

Phases: <completed>/<total>
- Phase 1: <title> — <sha> (gates: <names>: PASS)
- Phase 2: <title> — STOPPED (<reason>)

Adaptations:
- <minor mismatches adapted, one line each — or "none">

Uncertainties:
- <steps marked uncertain and why — or "none">

Pending manual verification (human checklist):
- <phase>.<index> <title>
- ...

Suggested follow-up: /10x-impl-review <change-id>
```

Wypisz oczekujące wiersze Manual dosłownie z Progress. Jeśli uruchomienie zatrzymało się wcześniej, blok STOP poprzedza raport, a raport uczciwie odzwierciedla skrócony stan.

## Zalecane środowisko

Hooki wykonywane po każdej edycji czynią tę pętlę krótszą: hook PostToolUse uruchamiający lint, typecheck lub testy ograniczone zakresem (`vitest related "$FILE" --run`) przy każdym Edit/Write wychwytuje rozbieżności sekundy po ich wystąpieniu zamiast na końcu fazy, a nieudany hook automatycznie wprowadza błąd z powrotem do kontekstu. Konfiguracja hooków należy do `.claude/settings.json` użytkownika — ta umiejętność działa bez żadnych hooków; niezależnie od tego uruchamia bramki na poziomie faz. Jeśli zauważysz, że takie hooki uruchamiają się podczas działania, traktuj ich niepowodzenia jak każde inne niepowodzenie bramki (ten sam limit 2 prób).