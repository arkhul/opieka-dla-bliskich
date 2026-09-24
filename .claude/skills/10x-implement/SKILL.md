---
name: 10x-implement
description: Implement technical plans from context/changes/<change-id>/plan.md with verification
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
# Wdróż plan

Twoim zadaniem jest wdrożenie zatwierdzonego planu technicznego z `context/changes/<change-id>/plan.md`. Plany te zawierają fazy z konkretnymi zmianami oraz kanoniczną sekcję `## Progress` na dole, która steruje stanem realizacji (zobacz `references/progress-format.md`).

## Konfiguracja początkowa

Gdy ta komenda zostanie wywołana:

1. **Rozwiąż plan**:
   - Jeśli wywołano jako `/10x-implement <change-id> [phase N]`, rozwiąż do `context/changes/<change-id>/plan.md`.
   - Jeśli wywołano z `@context/changes/<change-id>/plan.md` lub pełną ścieżką, zaakceptuj ją.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wyświetl „This change is archived. Open a new change with `/10x-new` instead.” i ZATRZYMAJ się.
   - Jeśli nic nie podano, odpowiedz poniższą wiadomością i **ZATRZYMAJ się oraz czekaj**:

```
I'll help you implement an approved technical plan. Please provide:

1. A change-id (e.g., `/10x-implement oauth-login phase 1`), or
2. A full path (e.g., `@context/changes/oauth-login/plan.md`).

You can list active changes with: `ls context/changes/`

Tip: Make sure the plan has been reviewed and approved before implementation.
```

## Rozpoczęcie pracy

Po otrzymaniu ścieżki planu:

- Przeczytaj plan w całości. Sekcja `## Progress` na dole jest autorytatywna dla stanu realizacji — znaczniki wyboru (`- [x]`) występują TYLKO tam. Bloki faz zawierają zwykłe wypunktowania `- ` (bez pól wyboru).
- Przeczytaj `context/foundation/lessons.md`, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem jakiejkolwiek fazy — są to zaakceptowane przez zespół powtarzalne zasady i muszą kształtować każdą decyzję implementacyjną podjętą w tym przebiegu.
- Przeczytaj wszystkie pliki wspomniane w planie (przywołane badania, ramy, pliki źródłowe w tym samym folderze zmiany).
- **Czytaj pliki w całości** — nigdy nie używaj parametrów limit/offset, potrzebujesz pełnego kontekstu.
- Dogłębnie przemyśl, jak elementy do siebie pasują.
- **Wstępnie sprawdź bramki**: zbierz polecenia z kryteriów sukcesu Automated każdej fazy i sprawdź, czy każde można tutaj uruchomić — binarny plik lub skrypt pakietu istnieje (`package.json` scripts, `command -v`, `Makefile` targets). Kryterium, którego polecenia nie można uruchomić, jest niezgodnością dla fazy, która go potrzebuje, a wskazanie tego teraz jest znacznie tańsze niż odkrycie po napisaniu kodu. Zgłoś każde niewykonywalne polecenie przy wejściu (`PREFLIGHT: <command> not runnable — Phase <N> will need this`). Nigdy po cichu nie pomijaj nieweryfikowalnego kryterium.
- **Zaktualizuj `change.md`**: przy wejściu ustaw `status: implementing` (tylko jeśli obecnie należy do `{planned, plan_reviewed}`) oraz `updated: <today>`.
- **Zsynchronizuj roadmapę** (najlepszy możliwy wysiłek, raz przy wejściu): jeśli `context/foundation/roadmap.md` zawiera element, którego `Change ID` równa się `<change-id>`, zmień stan tego elementu na `Status: in-progress`. Zobacz „## Roadmap status sync” poniżej. Jest to odpowiednik otwartej pracy dla zmiany na `done` wykonywanej przez `/10x-archive`; nigdy nie blokuje, a większość zmian nie będzie powiązana z roadmapą.
- Policz łączną liczbę faz (z nagłówków `## Phase N:`) i utwórz jeden wpis TaskCreate na fazę (pojawiają się one na pasku stanu użytkownika):
  - Dla każdej fazy utwórz zadanie z `subject: "Phase N: [Phase Name]"` oraz `activeForm: "Implementing Phase N"`.
  - Ustaw bieżącą fazę na `in_progress` przez TaskUpdate przed rozpoczęciem pracy.
  - Oznacz każdą fazę jako `completed` przez TaskUpdate, gdy jej kryteria sukcesu przejdą.
- **Znajdź następny oczekujący krok**, skanując sekcję `## Progress`: pierwsza linia `- [ ]` w kolejności dokumentu to miejsce rozpoczęcia. Jeśli przekazano argument `phase N`, przejdź do pierwszej pozycji `- [ ]` wewnątrz `### Phase N:` zamiast tego.
- Zacznij wdrażanie, jeśli rozumiesz, co należy zrobić.

## Tryb wykonywania dla fazy

Pisanie kodu fazy jest kosztowną częścią tej sesji: pełne czytanie plików źródłowych, rozumowanie nad zmianami, stosowanie edycji. Uruchom to w subagencie, aby główny kontekst pozostał zwięzły podczas długiego planu; uruchom to tutaj, aby użytkownik mógł obserwować i przerywać w trakcie fazy. Obie opcje są prawidłowe — użytkownik wybiera dla każdej fazy.

**Zapytaj przed pierwszą fazą przebiegu** (pierwszą oczekującą fazą lub tą wskazaną przez argument `phase N`):

AskUserQuestion:
- question: "Phase [N] — how should I implement it?"
  header: "Exec mode"
  options:
  - label: "Delegate to a subagent (Recommended)"
    description: "A subagent writes the code; I keep the gates, staging, commit and Progress here. Keeps this context lean across a long plan — you see the touched files, adaptations and gate verdicts when it returns."
  - label: "Implement in this context"
    description: "I write the code here so you can watch the edits land and redirect me mid-phase. Costs context — a long plan may need a clear between phases."
  multiSelect: false

Dla każdej późniejszej fazy wybór jest przenoszony wraz z monitem „Next phase decision” na końcu rytuału commitu — bez osobnego pytania. Jeśli użytkownik poprosił o kilka kolejnych faz (więc ten monit jest pomijany), zachowaj ostatnio wybrany tryb.

Niezależnie od obowiązującego trybu, **wszystko, co użytkownik musi zdecydować lub przejrzeć, pozostaje tutaj**: wykonywanie bramek i linie werdyktów, staging, rytuał commitu, zmiany w `## Progress`, pytania o niezgodności. Delegacja przenosi wpisywanie, nigdy decyzję.

### Wysyłanie subagenta implementacyjnego

Gdy faza jest delegowana, wykonaj jedno wywołanie `Task` (`subagent_type: general-purpose`) przed stosem bramek, którego prompt zawiera:

- Change-id oraz numer + tytuł fazy.
- Pełną sekcję planu fazy dosłownie — Overview, Changes Required, Success Criteria. (Success Criteria to kontekst, aby subagent znał cel; NIE uruchamia on bramek — robisz to ty).
- **Dyscyplinę implementacyjną do stosowania.** Rozwiąż `references/implementation-discipline.md` (znajduje się obok tego `SKILL.md`) do **ścieżki absolutnej** i poleć subagentowi, aby ją przeczytał i zastosował. Agent uruchomiony przez `Task` nie ma pojęcia o katalogu tego skilla, więc ścieżka względna lub „przeczytaj referencję tego skilla” nie zostaną rozwiązane. Wskaż plik; nie powtarzaj go w treści promptu.
- Każdy wpis z `context/foundation/lessons.md`, jeśli istnieje — subagent nie może przeczytać pliku, chyba że wkleisz wpisy.
- Taksonomię niezgodności z „Implementation Philosophy”: bezpośrednio dostosuj i zgłoś **Minor** niezgodności; w przypadku **Structural** niezgodności zatrzymaj się i zgłoś ją zamiast dostosowywać lub przeprojektowywać.
- Twarde granice: wdrażaj WYŁĄCZNIE zmiany w kodzie. Nie uruchamiaj stosu bramek, nie wykonuj stage, nie commituj, nie dotykaj sekcji `## Progress` ani żadnego checkboxa, nie edytuj bloków Phase, nie wychodź poza zakres planu. Nie wywołuj `AskUserQuestion` — użytkownik rozmawia z tobą, nie z subagentem; otwarte pytanie wraca w wiadomości zwrotnej.

Wymagaj tej ustrukturyzowanej wiadomości końcowej jako wartości zwracanej, nie notatki dla człowieka:

```
STATUS: completed | structural-mismatch
TOUCHED: <repo-relative path>, <path>, ...      # every file created or edited
ADAPTATIONS: <one line each, or none>
STRUCTURAL: <plan assumption vs. what exists — only when STATUS is structural-mismatch>
UNCERTAINTIES: <ambiguous decisions, or none>
```

Po powrocie:

- **`completed`** → zainicjuj zbiór dotkniętych plików fazy z `TOUCHED` (zobacz „Tracking files touched during a phase”), przekaż użytkownikowi `ADAPTATIONS` i `UNCERTAINTIES` własnymi słowami — cicha adaptacja to ta, która później boli — i przejdź do stosu bramek. Nigdy ślepo nie ufaj `TOUCHED`; uzgodnienie `git status --porcelain` podczas stagingu jest kontrolą krzyżową dla pliku, którego subagent dotknął, ale nie umieścił na liście.
- **`structural-mismatch`** → nie uruchamiaj bramek. Przedstaw blok problemu z „Implementation Philosophy”, używając szczegółu `STRUCTURAL` subagenta, i zadaj pytanie o niezgodność. Następnie:
  - **Adapt and continue** → subagent, który posiadał kontekst fazy, już nie istnieje, więc wyślij nowego dla pozostałej części, przekazując decyzję użytkownika, szczegół `STRUCTURAL` oraz częściową listę `TOUCHED`. Ponownie czyta, czego potrzebuje; to ponowne czytanie jest uczciwą ceną tej ścieżki i występuje tylko przy strukturalnych niezgodnościach. Jeśli faza była prawie ukończona, po prostu dokończ ją tutaj.
  - **Skip this part** / **Stop and re-plan** → zgodnie z opisem w „Implementation Philosophy”. Pozostaw częściową pracę w worktree; nie wykonuj stage ani commitu.

Naprawa bramki może zostać delegowana w ten sam sposób — wyślij ukierunkowanego subagenta z wynikiem nieudanej bramki i problematycznymi plikami oraz połącz zwrócone przez niego `TOUCHED` ze zbiorem fazy przed ponownym stagingiem. Trywialne mechaniczne poprawki (osierocony import, zmiana nazwy) szybciej zastosować tutaj. W obu przypadkach limit dwóch prób pozostaje niezmieniony, a **celowy test zepsucia zawsze uruchamia się tutaj** — jego edycja wyłącznie w worktree oraz bezwarunkowe przywrócenie nigdy nie są delegowane.

## Filozofia implementacji

Plany są starannie projektowane, ale rzeczywistość może być chaotyczna. Twoim zadaniem jest:

- Podążać za intencją planu, dostosowując się do tego, co znajdziesz.
- W pełni wdrożyć każdą fazę przed przejściem do następnej.
- Zweryfikować, że twoja praca ma sens w szerszym kontekście bazy kodu.
- Aktualizować checkboxy w planie po ukończeniu sekcji.

[references/implementation-discipline.md](references/implementation-discipline.md) jest warstwą rzemiosła dla samej edycji — czytaj przywołany kod w całości, dostosowuj bez przeprojektowywania, dopasowuj zmianę do jej sąsiadów, respektuj zaakceptowane przez zespół zasady, wyszukuj przed edycją nieznanego obszaru. Przeczytaj go przed pierwszą fazą wdrażaną tutaj; gdy faza jest delegowana, subagent czyta go zamiast ciebie (po ścieżce absolutnej — zobacz „Dispatching the implementation subagent”). Ta sekcja obejmuje tylko to, co robić, gdy plan i rzeczywistość się nie zgadzają.

Gdy rzeczy nie odpowiadają dokładnie planowi, zastanów się dlaczego i komunikuj jasno. Plan jest twoim przewodnikiem, ale twój osąd również ma znaczenie.

**Sklasyfikuj niezgodność, zanim przerwiesz.** Nie każda luka zasługuje na pytanie:

- **Minor** — przeniesiony plik, zmieniona nazwa symbolu, dryf importów, trywialna różnica API lub konfiguracji. Intencja planu pozostaje nienaruszona; zmieniła się tylko współrzędna. Dostosuj implementację do rzeczywistości, powiedz o tym w jednej linii (`ADAPT: plan says src/auth.ts, file is now src/auth/index.ts`) i kontynuuj. Nie zatrzymuj się przez takie kwestie; pytanie o każdą ścieżkę importu zasłania te, które są ważne.
- **Structural** — brakująca zależność, architektura różniąca się od założonej przez plan, przywołany plik lub API, które nie istnieje, faza zależna od wyniku, którego poprzednia faza nigdy nie wytworzyła. Plan nie może zostać wykonany zgodnie z zapisem, a dostosowanie oznaczałoby jego przeprojektowanie. Zatrzymaj się i podążaj ścieżką strukturalną poniżej.

W razie wątpliwości między tymi dwiema kategoriami, traktuj przypadek jako strukturalny. Błędne „pytanie” kosztuje jedną wymianę; błędne „dostosowanie” może dostarczyć przeprojektowanie, którego nikt nie zatwierdził.

Przy strukturalnej niezgodności:

- ZATRZYMAJ się i głęboko przemyśl, dlaczego plan nie może zostać wykonany.
- Przedstaw problem wyraźnie jako tekst:

  ```
  Issue in Phase [N]:
  Expected: [what the plan says]
  Found: [actual situation]
  Why this matters: [explanation]
  ```

- Następnie użyj `AskUserQuestion`, aby uzyskać ustrukturyzowaną decyzję:

  AskUserQuestion:
  - question: "How should I handle this mismatch?"
    header: "Mismatch"
    options:
    - label: "Adapt and continue"
      description: "Adjust the implementation to match reality. I'll explain the adaptation."
    - label: "Skip this part"
      description: "Move on to the next section/phase. This change isn't needed."
    - label: "Stop and re-plan"
      description: "This mismatch is too significant. We need to update the plan first."
      multiSelect: false

## Śledzenie plików dotkniętych podczas fazy

Rytuał commitu na końcu fazy (zobacz „Verification Approach” poniżej) wykonuje stage plików ze **zbioru dotkniętych plików**, który utrzymujesz w pamięci roboczej przez całą fazę. Ten zbiór jest kanonicznym wejściem dla `git add` — nigdy nie wracaj do heurystyk `git status` przy decyzjach o stagingu.

**Dyscyplina**:

- Za każdym razem, gdy wywołasz `Edit` lub `Write` na pliku podczas bieżącej fazy, dodaj jego ścieżkę względną względem repozytorium do zbioru dotkniętych plików.
- Gdy faza jest delegowana, zainicjuj zbiór listą `TOUCHED` zwróconą przez subagenta i połącz z nim każdą ścieżkę zwróconą przez delegowaną naprawę bramki. Pliki edytowane tutaj bezpośrednio — checkboxy `## Progress`, zmiana `change.md` — dodawaj jak zwykle.
- Zbiór zawsze zawiera `context/changes/<change-id>/plan.md`, ponieważ każda faza generuje co najmniej jedną edycję jego sekcji `## Progress`. Dodaj go przy wejściu do fazy, jeszcze zanim jakiekolwiek checkboxy zostaną zmienione.
- **Bootstrap fazy 1**: przy pierwszej fazie zmiany zainicjuj także zbiór dotkniętych plików wszystkimi nieśledzonymi lub zmodyfikowanymi plikami wewnątrz `context/changes/<change-id>/` — zazwyczaj `change.md`, `research.md`, `plan.md` oraz wszelkie inne pliki kontekstowe utworzone podczas planowania. Te pliki są częścią zmiany i powinny trafić do pierwszego commitu zamiast pozostać jako nieśledzone resztki.
- Zbiór **resetuje się na każdej granicy fazy**. Po ukończeniu commitu na końcu fazy wyczyść go przed rozpoczęciem następnej fazy.
- Ta lista ma pierwszeństwo przed każdą heurystyką z `git status`. Jeśli zbiór dotkniętych plików to `{a.md, b.md, plan.md}`, ale `git status --porcelain` zgłasza również brudny `c.md`, `c.md` jest niezwiązany — obsłuż go przez monit o brudne ścieżki w rytuale, nigdy po cichu nie dołączaj go do commitu.

## Śledzenie odniesień do issue/task dla commitów

Przed zaproponowaniem wiadomości commitu na końcu fazy lub epilogu przeskanuj kontekst rozmowy pod kątem odniesień do issue lub task systemu śledzenia związanych z tą pracą implementacyjną, w tym kluczy Jira (na przykład `ABC-123`), identyfikatorów issue Linear (na przykład `ENG-123`), odniesień do issue/PR GitHub (na przykład `#123`, `GH-123` lub pełnych URL-i issue/PR GitHub), czy jawnych linków do zadań z Jira, Linear lub GitHub.

- Jeśli występuje jedno lub więcej odniesień, umieść je w treści wiadomości commitu w linii `Refs:`, zachowując dokładne identyfikatory/URL-e podane przez użytkownika, gdzie to możliwe.
- Jeśli dotyczy wiele odniesień, wypisz je rozdzielone przecinkami w jednej linii `Refs:`.
- Nie wymyślaj ani nie wnioskuj odniesień do systemu śledzenia z change-id, nazwy brancha ani nazw plików. Używaj wyłącznie odniesień widocznych w bieżącym kontekście rozmowy lub jawnie podanych przez użytkownika.
- Zastosuj tę samą linię `Refs:` do każdego commitu na końcu fazy i commitu epilogu, chyba że użytkownik ograniczy odniesienie do konkretnej fazy.

## Synchronizacja statusu roadmapy

`context/foundation/roadmap.md` (tworzony przez `/10x-roadmap`) indeksuje każdy Foundation/Slice za pomocą stabilnego **Change ID**. `/10x-archive` już zamyka pętlę po dalekiej stronie — gdy zmiana jest archiwizowana, zmienia pasujący element roadmapy na `Status: done`. Ten krok łączy bliższy koniec: gdy implementacja *zaczyna się*, oznacz pasujący element jako **`in-progress`**, aby roadmapa pokazywała bieżącą pracę zamiast przechodzić bezpośrednio z `ready` do `done`.

Uruchom to **raz, przy wejściu** do zmiany (tuż po oznaczeniu `change.md` → `implementing`) — nie dla każdej fazy. Wyszukanie jest **obowiązkowe**; „best effort” ogranicza wyłącznie *edycje* — brakująca roadmapa lub nieznaleziony cel są po cichu pomijane i nigdy nie blokują, nie pytają, nie wycofują ani nie przerywają przebiegu. Nie pomijaj sprawdzenia, zakładając, że nie ma roadmapy.

1. `test -f context/foundation/roadmap.md`. Jeśli nie istnieje, pomiń ten krok po cichu.
2. Zapisz, czy plik jest już brudny: `ROADMAP_PREDIRTY=$(git status --porcelain context/foundation/roadmap.md 2>/dev/null)` — używane w kroku 5 do podjęcia decyzji o stagingu.
3. Przeczytaj plik. Szukaj użycia `<change-id>` jako `Change ID`:
   - w tabeli `## At a glance` — wiersz, którego komórka kolumny **Change ID** równa się dokładnie `<change-id>`;
   - oraz w treści `## Foundations` / `## Slices` — blok `### <ID>: …`, który zawiera linię `- **Change ID:** <change-id>`.

   `<ID>` to lokalny identyfikator roadmapy tego elementu (`F-NN` lub `S-NN`). Dopasowanie jest wyłącznie dokładnym ciągiem — slice może tworzyć kilka zmian, więc podobne dopasowanie celowo *nie* jest dotykane. **Brak dopasowania** → wyświetl `ℹ context/foundation/roadmap.md has no item with Change ID "<change-id>" — roadmap left untouched.` i pomiń resztę tego kroku.
4. **Znaleziono dopasowanie** → odczytaj bieżące `- **Status:**` elementu. Jeśli jest już `in-progress` lub `done`, pozostaw je nietknięte (**tylko naprzód**: nigdy nie cofaj bardziej zaawansowanego statusu) i przejdź do kroku 5. W przeciwnym razie zastosuj obie edycje narzędziem Edit — każdą niezależnie i w trybie best effort; jeśli cel nie jest tam, gdzie umieszcza go szablon `/10x-roadmap` (ręcznie edytowana lub roadmapa w starszym formacie), pomiń tę podedycję, kontynuuj i zanotuj, co pominięto. Dotykaj tylko pola `Status`; pozostaw `Outcome`, `Prerequisites`, `Change ID` itd. bez zmian.
   1. **`## At a glance`** — w dopasowanym wierszu ustaw komórkę kolumny **Status** na `in-progress`.
   2. **Treść elementu** — przepisz linię `- **Status:**` elementu na `- **Status:** in-progress`.

   Następnie podnieś roadmapowe frontmatter `updated:` do `<today>` (pozostaw wszystkie inne klucze bez zmian; pomiń to, jeśli plik nie ma frontmatter).
5. **Włącz zmianę do historii tej zmiany.** Jeśli `git` jest dostępny **oraz** `ROADMAP_PREDIRTY` (krok 2) było puste, dodaj `context/foundation/roadmap.md` do zbioru dotkniętych plików bieżącej fazy, aby zmiana statusu trafiła do commitu fazy zamiast pozostawać brudna. Jeśli `ROADMAP_PREDIRTY` nie było puste, plik już miał niezatwierdzone edycje: pozostaw zmianę w worktree, zachowaj `context/foundation/roadmap.md` POZA zbiorem dotkniętych plików i wyświetl `⚠ context/foundation/roadmap.md had pre-existing uncommitted changes — flipped roadmap item <ID> to in-progress in the working tree but did NOT stage it. Commit it yourself.` Jeśli `git` jest niedostępny, edycja po prostu pozostaje w worktree.

## Podejście do weryfikacji

Po wdrożeniu fazy uruchom tę stałą sekwencję — kanoniczną kolejność dla wszystkiego pomiędzy „kod napisany” a „commit utworzony”. Bramki uruchamiają się od najtańszych, staging znajduje się tam, gdzie potrzebuje go test zepsucia, a rytuał commitu jest zakończeniem. Wypisz jednoliniowy werdykt po każdej bramce — `GATE <name>: PASS` albo `GATE <name>: FAIL (<summary>, attempt <k>/2)` — aby użytkownik mógł zobaczyć, co faktycznie uruchomiono, bez ponownego czytania przewiniętej historii.

1. **(a) Kryteria planu** — uruchom polecenia kryteriów sukcesu `#### Automated` fazy z planu, w kolejności. Każde polecenie jest osobną bramką z własną linią werdyktu.

2. **Wykonaj stage zbioru dotkniętych plików** — uruchom kroki 2–4 poniższego rytuału commitu („Compute the staging set”, „Detect unrelated dirty paths”, „Stage explicitly by path”) *tutaj*, nie w chwili commitu. Staging przed testem zepsucia sprawia, że jego przywrócenie jest dokładne: `git checkout -- <file>` resetuje worktree do wersji w stagingu, więc celowe zepsucie nigdy nie może przedostać się do commitu.

3. **(b) Celowy test zepsucia** — tylko dla faz, które dodają lub zmieniają testy. Gdy pliki fazy są w stagingu, zweryfikuj, że nowy lub zmieniony test faktycznie coś chroni:

   1. Odwróć lub osłab chronione zachowanie w kodzie produkcyjnym — edycja tylko w worktree, nigdy nie w stagingu.
   2. Uruchom odpowiedni test (uruchomienie ograniczone zakresem, np. pojedynczy plik testowy).
   3. Potwierdź, że nie przechodzi. Czerwony wynik jest tu warunkiem zaliczenia: `GATE break-check: PASS (test went red on broken code)`.
   4. Przywróć bezwarunkowo przez `git checkout -- <file>` — resetuje to worktree dokładnie do wersji w stagingu, więc zepsucie nigdy nie może przedostać się do commitu.
   5. Zgłoś sekwencję (co zostało zepsute, że test stał się czerwony, że plik przywrócono).

   Jeśli test **pozostaje zielony** na zepsutym kodzie, asercja niczego nie chroni — to niepowodzenie bramki. Napraw je przez wzmocnienie asercji, nigdy przez osłabienie kodu produkcyjnego ani pominięcie sprawdzenia. Edycja zepsucia nigdy nie może być commitowana; przywrócenie w kroku 4 jest bezwarunkowe, także na ścieżce błędu.

4. **(c) Kontrole dla całego repozytorium** — pełny zestaw testów, lint, typecheck, wszędzie, gdzie definiuje je plan lub repozytorium (np. skrypt `ci:local`, `make check test`). Po jednej linii werdyktu dla każdej.

5. **(d) Commit** — niezmiennik commitowania tylko na zielono: nigdy nie rozpoczynaj rytuału commitu, gdy którakolwiek z powyższych bramek jest czerwona. Nie ma wyjątku, a „naprawię to w następnej fazie” nim nie jest. Jeśli naprawa bramki (b) lub (c) zmieniła pliki, uruchom ponownie krok 2, aby je uwzględnić, a następnie uruchom poniższy rytuał commitu na końcu fazy — jego kroki stagingu są no-op, gdy nic nie zmieniło się od tego czasu.

**Gdy bramka nie przejdzie**, samodzielnie napraw ją maksymalnie dwa razy; numeruj próby w liniach werdyktów (`attempt 1/2`, `attempt 2/2`). Jeśli ta sama bramka nie przejdzie trzeci raz, przestań naprawiać i przekaż ją użytkownikowi wraz z nieudanym wynikiem — problem jest głębszy niż mechaniczny dryf, a trzecia ślepa próba zwykle pogarsza diff. Nigdy nie osłabiaj asercji, nie usuwaj testu ani nie łagodź reguły lint lub typecheck, aby bramka przeszła, chyba że plan wyraźnie tak mówi: napraw kod, aby spełniał kontrolę, nie kontrolę, aby spełniała kod. Gdy oczekiwana wartość testu jest rzeczywiście niejednoznaczna — plan i implementacja są sprzeczne, a nie ma niezależnego źródła prawidłowej odpowiedzi — nie zgaduj; pozostaw werdykt uczciwy i zapytaj.

Równolegle z sekwencją:

- Aktualizuj postęp w swoich todos oraz w sekcji `## Progress` planu.
- **Modyfikuj WYŁĄCZNIE sekcję `## Progress`.** Bloki faz (Overview, Changes Required, Success Criteria) są tylko do odczytu. Użyj Edit, aby zmienić `- [ ] N.M <title>` → `- [x] N.M <title>` w Progress po ukończeniu każdego kroku. NIE edytuj wypunktowań bloków Phase, NIE dodawaj znaczników postępu HTML comment na dole planu ani NIE zapisuj sidecara pliku stanu.
- **Uruchom rytuał commitu na końcu fazy**: bramka (d) powyżej. Gdy każda bramka jest zielona, przejdź przez ten sekwencjonowany rytuał, aby utworzyć jeden commit Conventional-Commits i zapisać końcowy krótki SHA z powrotem w każdym wierszu Progress zmienionym podczas fazy.

  1. **Bramka ręcznego potwierdzenia.** Poinformuj człowieka, że automatyczna weryfikacja przeszła, i wypisz elementy ręcznej weryfikacji z planu. Zatrzymaj się tutaj. Nie kontynuuj, dopóki człowiek nie potwierdzi powodzenia ręcznego testowania. Użyj tego formatu:

     ```
     Phase [N] Complete - Ready for Manual Verification

     Automated verification passed:
     - [List automated checks that passed]

     Please perform the manual verification steps listed in the plan:
     - [List manual verification items from the plan]

     Let me know when manual testing is complete so I can proceed to the commit step.
     ```

     **Zbiorcze ręczne kontrole międzyfazowe (tylko ostatnia faza).** Przed wyświetleniem wiadomości bramki ustal, czy bieżąca faza jest ostatnią fazą: przeskanuj sekcję `## Progress` w poszukiwaniu nagłówków `### Phase M:` i uznaj bieżącą fazę za ostatnią wtedy i tylko wtedy, gdy w kolejności dokumentu nie ma nagłówka z `M > N`. Jeśli bieżąca faza **nie** jest ostatnia, wiadomość bramki ma dokładnie powyższy format — bez zbiorczego podsumowania. Jeśli bieżąca faza **jest** ostatnia, po bloku „Please perform the manual verification steps listed in the plan:” przeskanuj całą sekcję Progress pod kątem wierszy `- [ ]`, które znajdują się pod podsekcją `#### Manual` w dowolnej fazie **innej niż bieżąca**. Jeśli takie wiersze istnieją, dołącz następujący blok do wiadomości bramki (w kolejności dokumentu, jeden wiersz na linię, sformatowany jako `<phase>.<index> <title>` — usuń prefiks `- [ ]` oraz końcowy sufiks ` — <sha>`):

     ```
     Pending manual checks from earlier phases:
     - [phase.index title]
     ```

     Jeśli nie ma oczekujących ręcznych wierszy z wcześniejszych faz, całkowicie pomiń blok zbiorczy. Bramka nadal czeka na potwierdzenie człowieka; jest to informacja, nie twarda blokada. Fazy pośrednie (każda faza, która nie jest ostatnia) zachowują oryginalny format bramki bez podsumowania.

  2. **Oblicz zestaw stagingu.** Kroki 2–4 zostały już uruchomione raz jako krok 2 stosu bramek; uruchom je ponownie tutaj, aby uwzględnić wszystko, czego dotknęła naprawa bramki. Gdy nic się nie zmieniło, są no-op. Weź zbiór dotkniętych plików utrzymywany podczas fazy (zobacz „Tracking files touched during a phase” powyżej) i połącz go z `{context/changes/<change-id>/plan.md}`. Plik planu zawsze trafia do stagingu, ponieważ każda faza powoduje co najmniej jedną edycję jego sekcji `## Progress`.

  3. **Wykryj niezwiązane brudne ścieżki.** Uruchom `git status --porcelain` i znajdź część wspólną ze ścieżkami *poza* zestawem stagingu. Jeśli zbiór brudnych, ale niedotkniętych plików nie jest pusty, przedstaw problematyczne ścieżki i użyj `AskUserQuestion`:

     - question: "<N> unrelated path(s) are dirty. How should I handle them?"
       header: "Dirty paths"
       options:
       - label: "Continue — stage only the planned set (Recommended)"
         description: "Commit only files this phase touched. Leave the unrelated paths dirty for you to handle separately."
       - label: "Stage all"
         description: "Add the unrelated paths to this commit. You take responsibility for the broader scope."
       - label: "Abort"
         description: "Stop the phase commit. Resolve the dirty paths first, then re-run the ritual."
       multiSelect: false

     Jeśli zbiór brudnych, ale niedotkniętych plików jest pusty, pomiń ten krok.

  4. **Wykonaj stage jawnie według ścieżki.** Uruchom `git add` dla każdego pliku w wybranym zestawie według nazwy. NIE używaj `git add -A` ani `git add .` — tylko jawne ścieżki.

  5. **Sprawdź pusty diff.** Uruchom `git diff --cached --quiet`. Kod wyjścia 0 oznacza brak diffu w stagingu. Jeśli jest pusty, wyświetl:

     ```
     Phase [N] had no diff to commit; rows remain SHA-less; archive warn-only will surface them.
     ```

     Ustaw `SHA=""` i przejdź do kroku 8.

  6. **Zaproponuj wiadomość Conventional-Commits.** Zbuduj linię tematu w formie `<type>(<change-id>): <phase title> (p<N>)`, gdzie `<type>` jest jednym z `feat / fix / chore / refactor / docs`, wybranym na podstawie charakteru fazy (np. `feat` dla nowego zachowania widocznego dla użytkownika, `chore` dla edycji promptów/dokumentacji, `refactor` dla restrukturyzacji bez zmiany zachowania). Tytuł fazy jest znaczącą częścią i prowadzi; sufiks `(p<N>)` zawiera indeks fazy. Zbuduj krótką treść z listą dotkniętych plików oraz linią `Refs:` z „Tracking issue/task references for commits”, jeśli ma zastosowanie. Użyj `AskUserQuestion`:

     - question: "Approve commit message?"
       header: "Commit msg"
       options:
       - label: "Approve as proposed (Recommended)"
         description: "Use the message as drafted."
       - label: "Edit subject line"
         description: "Override the subject; keep the body."
       - label: "Override entirely"
         description: "Replace both subject and body."
       multiSelect: false

  7. **Wykonaj commit przez heredoc.** Uruchom `git commit` zgodnie z globalnym protokołem wiadomości commitu:

     ```bash
     git commit -m "$(cat <<'EOF'
     <type>(<change-id>): <phase title> (p<N>)

     <short body listing touched files>
     <Refs: issue/task references, if applicable>
     EOF
     )"
     ```

     Nigdy nie przekazuj flag `--no-verify`, `--amend` ani flag omijających podpisywanie. Jeśli hook pre-commit nie przejdzie, napraw podstawowy problem i utwórz NOWY commit — pierwotny commit NIE nastąpił, więc amend dotknąłby commitu poprzedniej fazy.

  8. **Pobierz krótki SHA.** Uruchom `git rev-parse --short HEAD` i zapisz jako `SHA`. Pomiń ten krok, jeśli `SHA=""` zostało ustawione przez krok 5.

  9. **Zapisz SHA z powrotem w Progress.** Dla każdego wiersza Progress zmienionego podczas tej fazy uruchom celowaną edycję:

     - Znajdź: `- [x] N.M <title>` (bez istniejącego sufiksu ` — <sha>` na końcu linii)
     - Zamień na: `- [x] N.M <title> — <SHA>`

     Pomiń wiersze, które już mają sufiks SHA (bezpieczeństwo wznowienia: jeśli rytuał zostanie ponownie uruchomiony po częściowym przebiegu, nie dodawaj sufiksu podwójnie). Jeśli `SHA=""`, całkowicie pomiń dopisanie — wiersze pozostają bez SHA, a `/10x-archive` pokaże je jako informacyjne ostrzeżenia w ramach kontroli miękkiego ostrzeżenia o brakującym SHA.

  10. **Zaktualizuj `change.md`.** Ustaw `updated: <today>`; zachowaj `status: implementing` (idempotentnie aż do ostatniej fazy). W ostatniej fazie ustaw `status: implemented` po zapisaniu SHA (zobacz „After all phases” poniżej).

  11. **Zresetuj zbiór dotkniętych plików.** Wyczyść go przed rozpoczęciem następnej fazy. Rytuał jest samowystarczalny dla każdej fazy.

- **Decyzja o następnej fazie**: jeśli istnieje następna faza, pomóż użytkownikowi zdecydować, czy kontynuować, czy rozpocząć od nowa.

  Użyj `AskUserQuestion`, aby przedstawić decyzję:

  AskUserQuestion:
  - question: "Phase [N] complete. How to proceed?"
    header: "Next phase"
    options:
    - label: "Continue to Phase [N+1] — delegate"
      description: "Proceed to the next phase with a subagent writing the code. Keeps this context lean; you see the touched files, adaptations and gate verdicts when it returns."
    - label: "Continue to Phase [N+1] — in context"
      description: "Proceed to the next phase and write the code here, where you can watch the edits land and redirect mid-phase."
    - label: "Clear context first"
      description: "Copy resume command to clipboard. Start fresh for Phase [N+1]."
    - label: "Review this phase first"
      description: "Run /10x-impl-review to verify implementation against the plan before proceeding."
      multiSelect: false

  **Jeśli użytkownik wybierze review**: Uruchom `/10x-impl-review @[path-to-plan] phase [N]`, aby przejrzeć właśnie ukończoną fazę. Po ukończeniu przeglądu ponownie przedstaw decyzję kontynuacji/wyczyszczenia (tym razem bez opcji review).

  **Jeśli użytkownik wybierze którąkolwiek opcję continue**: Przejdź bezpośrednio do następnej fazy — przeczytaj sekcję planu dla następnej fazy, ustaw zadanie na `in_progress` i wdrażaj w wybranym trybie wykonania (zobacz „Per-phase execution mode”). Nie trzeba ponownie czytać całego planu ani już załadowanych plików; delegowana faza nadal otrzymuje własną sekcję planu dosłownie w prompcie delegowania.

  **Jeśli użytkownik wybierze clear**: Skopiuj polecenie wznowienia do schowka i wyświetl je:
  1. Skopiuj:
     ```bash
     echo -n "/10x-implement <change-id> phase [next-phase-number]" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase [next-phase-number]" | xclip -selection clipboard 2>/dev/null || true
     ```

     ```powershell
     # PowerShell (Windows)
     Set-Clipboard "/10x-implement <change-id> phase [next-phase-number]"
     ```
  2. Wyświetl:
     ```
     → /10x-implement <change-id> phase [next-phase-number] (✓ copied)
     ```

Jeśli otrzymasz polecenie wykonania kilku kolejnych faz, pomiń AskUserQuestion między fazami i zachowaj ostatnio wybrany tryb wykonania.

nie odznaczaj pozycji kroków ręcznego testowania, dopóki użytkownik ich nie potwierdzi.

## Śledzenie stanu

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy.** Żadnego pliku stanu. Żadnych znaczników komentarzy. Zobacz `references/progress-format.md` dla kontraktu formatu.

### Po każdym kroku

Użyj Edit, aby zmienić dokładnie jedną linię Progress naraz:

- Znajdź: `- [ ] N.M <title>`
- Zamień na: `- [x] N.M <title>`

Nie dopisuj sufiksu SHA podczas edycji pojedynczego kroku — SHA jest zapisywane na końcu fazy przez rytuał commitu (zobacz „Verification Approach” powyżej), a tylko SHA zamykającego commitu trafia do każdego wiersza zmienionego podczas fazy. W trakcie fazy ukończone wiersze mają `[x]` bez sufiksu SHA; jest to prawidłowy stan pośredni.

### Po każdej fazie

Gdy wszystkie pozycje `- [ ]` wewnątrz `### Phase N:` są teraz `- [x]`:

1. Uruchom rytuał commitu na końcu fazy (zobacz „Verification Approach” powyżej): ręczne potwierdzenie → staging → monit o brudne ścieżki → commit → zapis SHA.
2. `change.md.updated` jest podbijane jako część kroku 10 rytuału.

Fazy z pustym diffem (tylko ręczna weryfikacja lub fazy no-op po adaptacji) nie commitują niczego i pozostawiają swoje wiersze bez SHA; `/10x-archive` pokaże je jako informacyjne ostrzeżenia w ramach kontroli miękkiego ostrzeżenia o brakującym SHA. Jest to zamierzone — nie każda faza produkuje kod.

### Po wszystkich fazach

Gdy każde `- [ ]` w całej sekcji `## Progress` jest teraz `- [x]`:

1. **Defensywne ujawnienie oczekujących pozycji.** Ponownie przeskanuj całą sekcję `## Progress` po raz ostatni pod kątem dowolnych wierszy `- [ ]`. W normalnym przebiegu jest to no-op — warunek uruchomienia „After all phases” to już „każde `- [ ]` jest `- [x]`”, więc mechanizm nie powinien nic znaleźć. Istnieje po to, aby wszelkie nieoczekiwane pozostałości były jawne zamiast po cichu zagubione (np. jeśli częściowy przebieg, ręczna edycja lub ścieżka wznowienia ominęły warunek uruchamiający). Jeśli liczba jest niezerowa, wypisz każdy wiersz jako `<phase>.<index> <title>`, pogrupowany według podsekcji Automated versus Manual w kolejności dokumentu, a następnie zapytaj przez `AskUserQuestion`:

   - question: "<N> Progress item(s) still pending. How to proceed?"
     header: "Stragglers"
     options:
     - label: "Pause (Recommended)"
       description: "STOP without flipping change.md.status. Address the stragglers manually, then re-enter the epilogue path."
     - label: "Proceed to epilogue"
       description: "Flip status: implemented and run the epilogue commit anyway. Stragglers will surface as warnings under /10x-archive."
     multiSelect: false

   Przy „Pause”: ZATRZYMAJ się natychmiast. NIE aktualizuj `change.md`, NIE uruchamiaj commitu epilogu. Przy „Proceed to epilogue”: kontynuuj krokami 2–4 poniżej. Jeśli liczba wynosi zero, pomiń ten krok i kontynuuj.

2. Zaktualizuj `change.md`: ustaw `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — należy to do `/10x-archive`).
3. NIE zapisuj żadnego znacznika postępu HTML comment na dole planu.
4. **Uruchom commit epilogu.** Commit ostatniej fazy nie może zawierać własnego SHA (problem kury i jajka), więc zapis SHA z powrotem do wierszy Progress ostatniej fazy oraz zmiana statusu `change.md` pozostają brudne w worktree po zakończeniu rytuału ostatniej fazy. Utwórz jeden zamykający commit, aby je zapisać — w przeciwnym razie twarda bramka odmowy `/10x-archive` (niezatwierdzone ścieżki wewnątrz folderu zmiany) zablokuje. Kroki:
   1. Wykonaj stage dokładnie dla `context/changes/<change-id>/plan.md` oraz `context/changes/<change-id>/change.md` (jawne ścieżki, bez `git add -A`).
   2. Uruchom `git diff --cached --quiet`; jeśli kod wyjścia to 0, pomiń epilog (nic końcowego do commitowania) i zatrzymaj się tutaj.
   3. Zaproponuj temat `chore(<change-id>): close out plan (epilogue)` z krótką treścią informującą o końcowym zapisie SHA planu + change.md → implemented oraz linią `Refs:` z „Tracking issue/task references for commits”, jeśli ma zastosowanie. Użyj AskUserQuestion, aby zatwierdzić propozycję / edytować temat / zastąpić całość (te same opcje co w rytuale fazy).
   4. Wykonaj commit przez heredoc zgodnie z globalnym protokołem (nigdy `--no-verify` / `--amend`).
   5. NIE zapisuj własnego SHA epilogu z powrotem w planie — jego jedynym zadaniem jest czyste zapisanie końcowych edycji.

### „Gdzie jestem?” — wyprowadzane, nie przechowywane

Sparsuj sekcję `## Progress`. Pierwsza linia `- [ ]` to następny krok. Bieżąca faza to nagłówek `### Phase N:` bezpośrednio nad nią. Ukończenie to `count([x]) / count([ ] + [x])`. Żadnego JSON, znaczników ani sidecara — tylko sekcja Progress.

## Ukończenie planu

Gdy WSZYSTKIE fazy są wdrożone i zweryfikowane (każdy checkbox Progress ma `[x]`):

1. Potwierdź, że `change.md.status` ma teraz wartość `implemented`.
2. Przedstaw podsumowanie ukończenia, a następnie zaoferuj końcowy przegląd:

```
All phases implemented! 🎉

Summary:
- Phases completed: [N]
- Files changed: [list key files]
```

Użyj AskUserQuestion:

```
question: "Plan complete. Would you like a final implementation review?"
header: "Plan Complete"
options:
  - label: "Run full review (/10x-impl-review)"
    description: "Comprehensive review of all phases against the plan. Catches cross-phase issues."
  - label: "Skip review — I'm satisfied"
    description: "No review needed. Mark the plan as done."
multiSelect: false
```

Jeśli użytkownik wybierze review → uruchom `/10x-impl-review <change-id>` (brak numeru fazy = pełny przegląd planu).

## Jeśli utkniesz

Gdy coś nie działa zgodnie z oczekiwaniami:

- Najpierw upewnij się, że przeczytałeś i zrozumiałeś cały istotny kod.
- Rozważ, czy baza kodu nie ewoluowała od czasu napisania planu.
- Przedstaw niezgodność jasno i poproś o wskazówki.

Zobacz „When you're stuck or in unfamiliar territory” w [references/implementation-discipline.md](references/implementation-discipline.md), aby poznać sekwencję wyszukiwania, a następnie rozumowania oraz co robić, gdy właściwa wartość jest rzeczywiście niejednoznaczna.

Poza delegowaną fazą (zobacz „Per-phase execution mode”), sięgaj po sub-task, gdy to się opłaca — do ukierunkowanego debugowania lub eksploracji nieznanego obszaru:

- **Explore** (`subagent_type: "Explore"`) — szybkie wyszukiwanie plików, wzorców, podobnego kodu.
- **general-purpose** (`subagent_type: "general-purpose"`) — dogłębna analiza wymagająca wieloetapowego rozumowania.

## Wznawianie pracy

Jeśli sekcja `## Progress` planu ma istniejące oznaczenia `[x]`:

- Zaufaj, że ukończona praca jest wykonana.
- Podejmij pracę od pierwszej linii `- [ ]`.
- Weryfikuj poprzednią pracę tylko wtedy, gdy coś wydaje się nie tak.

Pamiętaj: wdrażasz rozwiązanie, a nie tylko odhaczasz pola. Miej na uwadze cel końcowy i utrzymuj rozpęd naprzód.