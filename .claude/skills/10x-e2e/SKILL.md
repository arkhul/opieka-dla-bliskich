---
name: 10x-e2e
description: Drive an approved plan's browser-level (E2E) phases against the running app, one risk at a time — plan → generate → review → verify. The E2E sibling of /10x-implement and /10x-tdd, sharing the same plan and Progress. Only drives risks that genuinely need a browser and whose feature is already built; redirects the rest to /10x-tdd or /10x-implement. Use when the user says "e2e", "write/generate a Playwright test", "browser test this risk", or "drive the plan's E2E phases".
argument-hint: "<change-id> [phase N] | @context/changes/<change-id>/plan.md | <risk-id>"
---
# 10x E2E — Wykonywanie planu E2E opartego na ryzyku

Realizujesz zatwierdzony plan techniczny z `context/changes/<change-id>/plan.md` aż do **pokrycia na poziomie przeglądarki**, po jednej fazie i jednym ryzyku naraz. Agent może wygenerować *przechodzący* test E2E w kilka sekund; trudne jest sprawienie, by **chronił rzeczywiste ryzyko** i **przetrwał jutrzejszy refaktoring**. Ta umiejętność prowadzi tylko te fazy, do których należy taka praca — ryzyko przekraczające kilka granic systemu (auth, routing, API, DB) lub istniejące wyłącznie w wyrenderowanym UI — a dla każdej z nich uruchamia pętlę:

```
PLAN     →  wybierz ryzyko, zbadaj działającą aplikację, zmapuj przepływ (lub wypełnij szablon promptu)
GENERATE →  przekształć przepływ w test na podstawie wzorcowego testu + zasad E2E
REVIEW   →  sprawdź go pod kątem pięciu antywzorców agentowych E2E; ponów prompt, podając nazwę
VERIFY   →  uruchom go na zielono, a następnie potwierdź, że nie przechodzi, gdy ryzyko rzeczywiście się materializuje
```

Ta umiejętność jest **odpowiednikiem E2E dla `/10x-implement` i `/10x-tdd`**. Czyta ten sam plan, modyfikuje tę samą kanoniczną sekcję `## Progress` i stosuje ten sam rytuał commitu na końcu fazy oraz przekazania przez schowek. Różnica polega na wewnętrznej pętli: zamiast pisać kod produkcyjny (`/10x-implement`) albo najpierw nieprzechodzący test jednostkowy (`/10x-tdd`), generujesz i utwardzasz test na poziomie przeglądarki względem **działającej aplikacji**. Ponieważ wszystkie trzy umiejętności współdzielą `## Progress`, możesz dowolnie je przeplatać — budować funkcję za pomocą `/10x-implement`, testować jednostkowo następną fazę za pomocą `/10x-tdd`, a następnie wrócić tutaj, aby dodać warstwę E2E dla ryzyka przekraczającego granice systemu — a stan nigdy nie zostanie utracony.

Poza tą ścieżką sterowaną planem `/10x-e2e` działa również **samodzielnie** dla pojedynczego ryzyka: `/10x-e2e <risk-id>` (lub bez argumentu, gdy istnieje `context/foundation/test-plan.md`: wtedy wybiera najwyższe niepokryte ryzyko na poziomie przeglądarki; zobacz krok 1 konfiguracji) i tworzy **jeden** zrecenzowany test zweryfikowany przez celowe uszkodzenie, a następnie kończy działanie — bez folderu zmiany, bez `## Progress`, bez rytuału commitu. Użyj tego do szybkiego jednorazowego zadania poza śledzoną zmianą. Wszystko poniżej dotyczące **Konfiguracji**, **Ukończenia fazy** i **Śledzenia stanu** dotyczy wyłącznie ścieżki sterowanej planem; samodzielne uruchomienie rozwiązuje swoje ryzyko (krok 1 konfiguracji), potwierdza infrastrukturę E2E i odczytuje dźwignie jakości (kroki 3–6 konfiguracji), przechodzi do bramki, wykonuje jednokrotnie pętlę PLAN→GENERATE→REVIEW→VERIFY i raportuje test.

Podstawowa dyscyplina: **nie generuj testów E2E od zera.** Zacznij od ryzyka nazwanego przez fazę i nadzoruj wynik agenta za pomocą dwóch dźwigni jakości — **wzorcowego testu** i **zasad E2E**. Prompt dostarcza tylko tego, czego tych dwoje nie może zakodować: konkretnego ryzyka, przepływu oraz granic rzeczywistych względem mockowanych.

```
context/foundation/test-plan.md  (ryzyka, do których odwołują się fazy planu)
        │
        ▼
   seed.spec.ts  +  zasady E2E  →  kształtują każdy wygenerowany test
        │                          (getByRole, izolacja, wait-for-state, rzeczywiste vs mockowane)
        ▼
   PLAN → GENERATE → REVIEW → VERIFY  →  jeden zrecenzowany test na ryzyko  →  CI
```

Agenci widzą **drzewo dostępności** (role, nazwy, stany w migawce YAML z referencjami elementów), a nie piksele — więc naturalnie tworzą testy oparte na `getByRole`, a nie na selektorach CSS.

Ścieżka planu: `$ARGUMENTS`

## Co zakłada ta umiejętność — i czego nie zrobi

- **Korzysta z infrastruktury E2E utworzonej przez `/10x-e2e-setup`.** Zakłada się, że istnieją konfiguracja Playwright (z `webServer`, projektem `setup` i `storageState`), przechodzący wzorcowy test oraz sekcja `## E2E` w `context/foundation/test-stack.md`, a aplikację można uruchomić. Ta umiejętność **odkrywa** je; **nie** instaluje Playwright, nie tworzy szkieletu konfiguracji, nie pisze wzorca ani nie podłącza CI. Jeśli brakuje dowolnego elementu, przekierowuje do `/10x-e2e-setup` i kończy działanie. Jeden wąski wyjątek: mockowanie zewnętrznego API, które aplikacja wywołuje **po stronie serwera**, może wymagać wpisu `webServer` serwera mocków (w formie tablicy) oraz hooka kierującego wpis aplikacji na ten serwer (`references/mocking-external-apis.md`). Sam wpis aplikacji (ten obsługujący bazowy URL) i każde pole zapisane przez `test-stack.md` należą do `/10x-e2e-setup`, więc pozostaw je bez zmian.
- **Testowana funkcja już istnieje.** E2E działa na rzeczywistej, uruchomionej aplikacji — dlatego, w przeciwieństwie do `/10x-tdd`, implementacja musi być **obecna**, a nie nieobecna. Jeśli funkcja z fazy nie jest jeszcze zbudowana, przeglądarka nie ma czym sterować; zatrzymaj się i przekieruj do `/10x-implement` (lub `/10x-tdd`), aby najpierw ją zbudować, a potem wróć.
- **Używa dwóch dźwigni jakości; nie tworzy ich.** Wzorcowy test jest pisany raz na projekt przez `/10x-e2e-setup`; zasady E2E są dostarczane z tą umiejętnością (`references/e2e-quality-rules.md`), a nie w pliku zasad twojego agenta. Ta umiejętność modeluje każdy wygenerowany test na ich podstawie i sprawdza względem nich, ale nigdy nie przepisuje wzorca. Można dodać małe pomocnicze funkcje testowe potrzebne specyfikacji (np. oczekiwanie na hydration w `tests/e2e/`).
- **Tworzy jeden zrecenzowany test na ryzyko, a nie szeroki przegląd.** W przeciwieństwie do „wygeneruj testy dla każdej strony” ta umiejętność pisze mały zestaw powiązany z ryzykiem i utwardza każdy test poprzez recenzję oraz kontrolę celowego uszkodzenia. E2E to najdroższa i najbardziej podatna na flaky warstwa — liczba pokryć nigdy nie jest celem; jest nim chronione ryzyko.
- **Bramkuje każdą fazę na podstawie tego, czy E2E rzeczywiście pasuje i czy aplikacja jest gotowa.** Niektóre fazy (czysta logika, konfiguracja, scaffolding) nigdy nie powinny otrzymać testu E2E. Funkcji, które nie są zbudowane, nie można sterować w przeglądarce. Te przypadki są przekierowywane lub zatrzymywane zgodnie z opisem poniżej.

## Przegląd faz

```
SETUP            →  Rozwiąż plan, przeczytaj w całości, potwierdź infrastrukturę /10x-e2e-setup (przekieruj, jeśli brakuje) + możliwość uruchomienia aplikacji, przeczytaj seed + zasady, rozpocznij checklistę postępu
Dla każdej fazy:
  ├─ GATE        →  Czy to ryzyko jest na poziomie przeglądarki ORAZ czy funkcja jest zbudowana ORAZ czy test E2E nie istnieje? Jeśli nie → przekieruj lub zatrzymaj
  ├─ PLAN/GENERATE/REVIEW/VERIFY  →  Powtarzaj dla każdego ryzyka w fazie, aż jego kryteria sukcesu będą spełnione
  └─ PHASE END   →  Istotne E2E na zielono → bramka manualna → rytuał commitu → decyzja o następnej fazie (schowek)
Po wszystkich fazach →  Podsumowanie ukończenia + opcjonalne /10x-impl-review
```

Każda faza kończy się punktem kontrolnym użytkownika. Nigdy po cichu nie pomijaj fazy ani nie łącz dwóch faz w jeden commit.

---

## Konfiguracja

> Samodzielne uruchomienia (sterowane ryzykiem) pomijają kroki planu (2, 7, 8, 9): krok 1 rozwiązuje ryzyko, następnie wykonaj kroki 3–6 i przejdź bezpośrednio do bramki.

Gdy wywołana jest ta umiejętność:

1. **Rozwiąż argument**:
   - `/10x-e2e <change-id> [phase N]` gdy istnieje `context/changes/<change-id>/` → `context/changes/<change-id>/plan.md`.
   - `@context/changes/<change-id>/plan.md` lub pełna ścieżka → zaakceptuj bez zmian.
   - **Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/`** — wyświetl „This change is archived. Open a new change with `/10x-new` instead.” i ZATRZYMAJ się.
   - Argument bez folderu `context/changes/<arg>/` jest **risk-id** (tak jak zapisuje go plan testów, np. `#2` albo slug) → uruchomienie samodzielne. Rozwiąż go w `context/foundation/test-plan.md` (jego mapie ryzyk). Jeśli nie ma planu testów, dopasuj go do wiersza `seed` w `test-stack.md` (`## E2E`); dopasowanie oznacza ryzyko wzorca, więc szukaj niepokrytego aspektu przy bramce. Jeśli żadne z nich go nie rozwiązuje, poproś użytkownika o ryzyko oraz obserwowalny rezultat, który je potwierdza.
   - Brak argumentu i istnieje `test-plan.md` → uruchomienie samodzielne dla najwyższego **niepokrytego ryzyka na poziomie przeglądarki**: ryzyka o najwyższym priorytecie, które tabela reakcji na ryzyko planu testów (najtańsza warstwa) albo faza wdrożenia E2E kieruje do e2e, które nie jest ryzykiem wzorca i nie ma jeszcze specyfikacji. Ryzyko wymienione przez fazę wdrożenia **nie** jest na poziomie przeglądarki, gdy jego własny wiersz kieruje z dala od e2e (oba warunki zachodzą: najtańsza warstwa to unit/integration **oraz** kolumna antywzorców ostrzega przed e2e; cicha kolumna antywzorców go nie wyklucza) — pomiń je. Nazwij wybrane ryzyko przed bramką.
   - Brak argumentu i brak `test-plan.md` → wyświetl poniższy komunikat oraz **ZATRZYMAJ się i czekaj**:

```
I'll drive an approved plan's browser-level (E2E) phases — plan → generate → review → verify, one risk at a time. Please provide:

1. A change-id (e.g., `/10x-e2e save-session phase 6`),
2. A full path (e.g., `@context/changes/save-session/plan.md`), or
3. One browser-level risk and the observable outcome that proves it (a standalone run).

You can list active changes with: `ls context/changes/`

Tip: the plan should already be reviewed and approved — this skill executes its E2E phases, it doesn't write the plan.
```

2. **Przeczytaj cały plan** — każdą fazę, każdy blok Changes Required, każdy element Success Criteria. Nigdy nie używaj limit/offset; potrzebujesz pełnego kontekstu. Sekcja `## Progress` na dole jest **autorytatywna dla stanu wykonania** — pola wyboru (`- [x]`) znajdują się TYLKO tam. Bloki faz zawierają zwykłe wypunktowania `- `, bez pól wyboru. Zwróć uwagę, które fazy odnoszą się do ryzyka z `context/foundation/test-plan.md`, wymagającego pokrycia na poziomie przeglądarki; to właśnie nimi steruje ta umiejętność.

3. **Przeczytaj `context/foundation/test-plan.md`**, jeśli istnieje — zawiera mapę ryzyk chronionych przez każdą fazę E2E (wpływ, prawdopodobieństwo, zachowanie potwierdzające ochronę). Jednostką pracy jest tutaj ryzyko, a nie plik.

4. **Przeczytaj `context/foundation/lessons.md`**, jeśli istnieje, i przyswój każdy wpis przed rozpoczęciem dowolnej fazy — to zaakceptowane przez zespół powtarzające się zasady i muszą kształtować każdy wybór testu w tym uruchomieniu.

5. **Potwierdź infrastrukturę E2E z `/10x-e2e-setup` oraz możliwość uruchomienia aplikacji (lekka kontrola — nie badaj całego świata):**
   - Jeśli istnieje `context/foundation/test-stack.md`, przeczytaj jego sekcję `## E2E` — zapisuje ona runner i wersję, ścieżkę konfiguracji, polecenia dla pojedynczej specyfikacji i pełnego zestawu, bazowy URL i port, polecenie serwera webowego, projekt konfiguracji auth i ścieżkę `storageState` oraz ścieżkę wzorca. Użyj jej i pomiń skanowanie. Port faktycznie używany przez uruchomienie to `E2E_PORT` z pliku env, gdy jest ustawiony. Wpisy serwera mocków w `webServer` w formie tablicowej nie są tam zapisywane; przeczytaj je w konfiguracji. Jeśli wygląda na nieaktualną (odwołuje się do plików lub konfiguracji, które już nie istnieją), zaznacz to użytkownikowi i wróć do szybkiego skanowania.
   - W przeciwnym razie wykonaj **szybkie** skanowanie: jedno wyszukiwanie plików `playwright.config.*` / `*.spec.ts`, a następnie przeczytaj konfigurację i jedną specyfikację, aby poznać polecenie uruchomienia **pojedynczej** specyfikacji, konfigurację auth (`storageState` / projekt `setup`) oraz sposób uruchamiania aplikacji (blok `webServer` albo polecenie dev-server).
   - **Jeśli nie ma konfiguracji Playwright lub wzorcowego testu**, przekieruj i ZATRZYMAJ się. Nigdy nie twórz samodzielnie szkieletu żadnego z nich — `/10x-e2e-setup` jest właścicielem obu. Skopiuj `/10x-e2e-setup` do schowka (zgodnie z konwencją schowka poniżej) i wyświetl:

```
This E2E run needs the Playwright infrastructure that /10x-e2e-setup creates — it's incomplete here:
- [missing: playwright.config.* | seed test]

Run the one-time setup first:
→ /10x-e2e-setup (✓ copied)

Then come back with:
→ /10x-e2e [the same arguments]

(Non-browser coverage doesn't need any of this — use /10x-tdd or /10x-implement.)
```

   - **Wynik konfiguracji nie jest jeszcze zatwierdzony?** Jeśli `git status` pokazuje niezatwierdzone pliki `/10x-e2e-setup` (konfigurację, wzorzec, `test-stack.md`), zaproponuj ich zatwierdzenie teraz, zanim to uruchomienie zmodyfikuje którykolwiek z nich (`chore: set up Playwright E2E`, staged by path; Recommended). Później konfiguracja będzie zawierała także wpis mocka tego uruchomienia, a rozdzielenie tego wymaga częściowego stage'owania.

6. **Przeczytaj dwie dźwignie jakości.** Wykonują ciężką pracę — prompt pozostaje zwięzły. Ta umiejętność je czyta i nigdy ich nie przepisuje.
   - **Wzorcowy test** (`seed.spec.ts`, ścieżka z `test-stack.md` lub skanowania): przykład, na którym modelowany jest każdy wygenerowany test. *To, co pokażesz, to otrzymasz* — jeśli wzorzec używa `getByRole`, wygenerowane testy też; jeśli zawiera `waitForTimeout`, każdy wygenerowany test go odziedziczy. `references/seed-test-pattern.md` wyjaśnia cztery wzorce zawarte w dobrym wzorcu; zobacz także `references/browser-driven-generation.md`.
   - **Zasady E2E**: przeczytaj `references/e2e-quality-rules.md` — zasady, których przestrzega każdy wygenerowany test, wraz z ich uzasadnieniem. Znajdują się przy tej umiejętności, a nie w pliku zasad twojego agenta. Jeśli starsza konfiguracja pozostawiła tam blok zasad E2E, ta referencja ma pierwszeństwo tam, gdzie oba się różnią.

7. **Zaktualizuj `change.md`**: ustaw `status: implementing` (tylko jeśli obecnie znajduje się w `{planned, plan_reviewed}`) oraz `updated: <today>`.

8. **Rozpocznij checklistę postępu w rozmowie**: jedna linia na każde `## Phase N:`, które zamierzasz prowadzić (`- [ ] Phase N: [Phase Name]`). Oznacz bieżącą fazę jako w toku przed jej rozpoczęciem i odhacz ją, gdy przejdą jej kryteria sukcesu. Checklista jest tylko widokiem dla użytkownika — `## Progress` w `plan.md` pozostaje źródłem prawdy.

9. **Znajdź punkt początkowy**: przeskanuj `## Progress` — pierwsze `- [ ]` w kolejności dokumentu wskazuje miejsce rozpoczęcia. Jeśli przekazano argument `phase N`, przejdź do pierwszego `- [ ]` pod `### Phase N:`.

> **Konwencja schowka.** Wszędzie, gdzie ta umiejętność mówi *skopiuj `X` do schowka*, prześlij dokładny ciąg `X` do schowka platformy — spróbuj `pbcopy` (macOS), następnie `clip.exe` (Windows/WSL), następnie `xclip -selection clipboard` (Linux) lub `Set-Clipboard` w PowerShell, i po cichu zastosuj fallback, jeśli żadne nie istnieje. Następnie wyświetl skopiowane polecenie w osobnej linii z sufiksem `(✓ copied)`.

> **Pytanie użytkownika — niezależne od hosta.** Wszędzie, gdzie ta umiejętność mówi *zapytaj użytkownika*, użyj dowolnego narzędzia interaktywnych pytań udostępnianego przez twojego agenta; nie koduj na sztywno nazwy jednego narzędzia. Przed pierwszym pytaniem przeskanuj dostępne narzędzia w poszukiwaniu takiego, które zadaje użytkownikowi ustrukturyzowane pytanie (parametr `question` oraz pole `options`/`choices`) i użyj pierwszego dopasowania. Jeśli go nie ma, zapytaj zwykłą wiadomością konwersacyjną z listą oznaczonych opcji i czekaj na odpowiedź — nigdy nie blokuj procedury. Za pierwszym razem, gdy pytasz, powiedz, którego narzędzia użyłeś (albo że zastosowałeś fallback do zwykłego czatu). Poniższe bloki opcji podają pytanie, etykiety i ich opisy; odwzoruj je na schemat narzędzia bez zmiany ich znaczenia.

---

## Bramka kwalifikacji E2E — uruchom przed każdą fazą (sterowaną planem) / raz (samodzielnie)

Przed zaplanowaniem pojedynczego testu dla fazy zdecyduj o trzech rzeczach w następującej kolejności:

1. **Dopasowanie do poziomu przeglądarki** — ryzyko fazy rzeczywiście wymaga pokrycia end-to-end.
2. **Obecność funkcji** — testowana funkcja jest już zbudowana, a aplikację można uruchomić.
3. **Brak testu** — przechodzący test E2E dla tego ryzyka jeszcze nie istnieje.

Faza kwalifikuje się do tej umiejętności tylko wtedy, gdy wszystkie trzy warunki są spełnione.

### Kontrola dopasowania do poziomu przeglądarki

Ryzyko wymaga E2E, gdy **przekracza kilka granic systemu** (auth, routing, API, DB) lub **istnieje tylko w wyrenderowanym UI**. Jeśli ryzyko może potwierdzić izolowana funkcja, kontrakt endpointu albo test integracyjny, E2E jest niewłaściwym (wolnym, kruchym) narzędziem — prowadź je za pomocą `/10x-tdd` lub `/10x-implement`.

| Warte E2E — prowadź tutaj | Niewarte E2E — przekieruj do /10x-tdd lub /10x-implement |
|---|---|
| Pełne przepływy użytkownika przez auth → routing → API → DB | Czyste funkcje, parsery, walidatory, obliczanie flag |
| Dane przetrwają rzeczywiste przeładowanie strony SSR / nawigację | Kontrakt statusu/kształtu/auth/bramkowania pojedynczego endpointu |
| Stan istniejący tylko w wyrenderowanym, interaktywnym UI | Logika biznesowa z jasnymi wejściami/wyjściami |
| Wieloetapowe ścieżki, których test jednostkowy nie potrafi odtworzyć | Wszystko, co może potwierdzić izolowana funkcja lub test integracyjny |
| Ryzyka pojawiające się wyłącznie przy integracji rzeczywistych granic | Konfiguracja, scaffolding, podłączenie infrastruktury, dokumentacja |

### Kontrola obecności funkcji (odwrotność /10x-tdd)

E2E steruje **działającą aplikacją**, więc funkcja musi już istnieć. Sprawdź `Changes Required` fazy i wykonaj ukierunkowane wyszukiwanie tras, stron, komponentów oraz endpointów, których dotyka przepływ, a następnie potwierdź, że aplikacja rzeczywiście się uruchamia.

Jeśli testowana funkcja **nie jest jeszcze zbudowana**, ZATRZYMAJ się — przeglądarka nie ma czym sterować. Wyświetl ten blok, uzupełniając konkretne dowody:

```
Phase [N]'s E2E risk needs a running feature, but the feature isn't built yet.

E2E runs against the real app; the implementation has to exist before the browser can drive it. Here I found it missing:
- [route/page/component/endpoint evidence]

Build it first, then come back for the E2E layer:
→ /10x-implement <change-id> phase [N]
```

Skopiuj `/10x-implement <change-id> phase [N]` do schowka, wyświetl je z `(✓ copied)` i ZATRZYMAJ się.

### Kontrola braku testu

Wykonaj szybkie wyszukiwanie istniejącej specyfikacji pokrywającej to ryzyko. Jeśli **przechodzący** test E2E dla ryzyka już istnieje, nie generuj go ponownie: uruchom go na zielono i uruchom każde celowe uszkodzenie, które deklaruje wiersz Progress tej fazy. Zmień tylko wiersze, których twierdzenie właśnie potwierdziłeś, podając po jednej linii dowodu dla każdego (specyfikacja + wynik). Wiersz, którego twierdzenie jest fałszywe — wskazuje specyfikację, która nie powinna istnieć, albo uszkodzenie, którego przeglądarka nie może wykryć (np. guard na poziomie strony duplikuje kontrolę middleware) — pozostaje `[ ]`: wyjaśnij dlaczego i zaproponuj użytkownikowi poprawkę planu; nigdy nie przepisuj planu ani nie zmieniaj go tylko po to, by przejść dalej. Taka faza nie może zostać ukończona: nie otrzymuje commitu, a ty przechodzisz do decyzji o następnej fazie z fazą oznaczoną **blocked on the plan fix**; podsumowanie ukończenia ją wymienia. Test pokrywający tylko **część** ryzyka (zazwyczaj wzorzec) go nie dyskwalifikuje. Jeśli **zbudowany** aspekt ryzyka nie ma testu, prowadź ten aspekt i nazwij go w tytule testu oraz nagłówku pochodzenia, np. `// risk: auth-gate-roundtrip — facet: a signed-in session reaches /dashboard; the signed-out redirect is covered by seed.spec.ts`. Jeśli pozostały tylko niezbudowane aspekty, zastosuj powyższe przekierowanie kontroli obecności funkcji. Jeśli test istnieje, ale **nie przechodzi**, to zadanie debugowania, a nie generowania — skieruj użytkownika do procesu debugowania od nieprzechodzącego testu do przyczyny źródłowej, zamiast pozwalać narzędziu auto-fix po cichu przepisać asercję. (Zobacz granicę auto-heal w wytycznych E2E.)

### Jak stosować bramkę

- Jeśli wszystkie trzy warunki są spełnione, stwierdź to w jednej linii i przejdź do pętli plan → generate → review → verify.
- Jeśli ryzyko **wyraźnie nie jest na poziomie przeglądarki**, uruchom **przekierowanie** (poniżej).
- Jeśli jest **mieszane**, ale aspekt nieprzeglądarkowy **ma już test** (unit/integration), nazwij ten aspekt i jego test w jednej linii, a następnie kontynuuj z częścią na poziomie przeglądarki — bez pytania.
- Jeśli jest **mieszane lub niejednoznaczne** (np. faza będąca częściowo kontraktem endpointu, a częściowo przepływem wyrenderowanego UI), zapytaj użytkownika:

  - question: "Phase [N] mixes an isolated-function risk and a browser-level flow. How should I drive it?"
    header: "E2E gate"
    options:
    - label: "E2E the browser-level part (Recommended)"
      description: "I'll plan→generate→review→verify the cross-boundary flow and redirect the isolated-function part to /10x-tdd."
    - label: "Redirect whole phase to /10x-tdd"
      description: "Hand the entire phase off — copy the resume command to the clipboard."
    - label: "E2E the whole phase anyway"
      description: "Force browser-level coverage even for the parts a unit test would prove. Slower, more brittle."
    multiSelect: false

### Przekieruj fazę nie-E2E

Wyjaśnij, *dlaczego* faza nie pasuje do poziomu przeglądarki (jedno lub dwa zdania, oparte na powyższej tabeli), a następnie zapytaj użytkownika:

- question: "Phase [N] isn't a good E2E fit. How do you want to handle it?"
  header: "Not E2E-worthy"
  options:
  - label: "Hand off to /10x-tdd"
    description: "Copy `/10x-tdd <change-id> phase N` to the clipboard. Start a fresh session, run it, then resume E2E on the next phase."
  - label: "Hand off to /10x-implement"
    description: "Copy `/10x-implement <change-id> phase N` to the clipboard if test-first doesn't fit either."

  Oznacz jako **(Recommended)** `/10x-tdd`, gdy faza dodaje testowalną logikę, oraz `/10x-implement`, gdy dotyczy dokumentacji, konfiguracji lub scaffolding.
  - label: "E2E inline here anyway"
    description: "I'll generate a browser-level test despite the cost — then continue to the next phase's gate."
  - label: "Skip — already done"
    description: "Mark the phase's Progress rows and move to the next phase."
  multiSelect: false

**Przy „Hand off”:** skopiuj wybrane polecenie wznowienia do schowka, wyświetl poniższy blok i ZATRZYMAJ się — druga umiejętność zmieni wiersze Progress tej fazy i wykona własny rytuał commitu. Powiedz użytkownikowi, aby potem wznowił E2E.

```
Phase [N] isn't browser-level material — [one-line reason].

→ /10x-<tdd|implement> <change-id> phase [N] (✓ copied)

Start a fresh session, run that, then come back with:
→ /10x-e2e <change-id> phase [next E2E phase]
```

Wyświetl wybraną umiejętność, nie zawsze `/10x-tdd`. Wyświetl ostatnie dwie linie („Start a fresh session…” i polecenie `/10x-e2e`) tylko wtedy, gdy pozostaje późniejsza faza; gdy była to ostatnia faza, zakończ podsumowaniem ukończenia.

**Przy „Skip”:** zmień wiersze `#### Automated` fazy z `[ ]` → `[x]` (bez SHA, ponieważ nic nie zostało zatwierdzone) — tylko wiersze, których twierdzenie jest prawdziwe (zobacz powyższą zasadę pokrytego ryzyka). Wiersze `#### Manual` pozostają dla użytkownika. Następnie przejdź do kolejnej fazy. Edycja Progress nie ma własnego commitu: `plan.md` zawsze znajduje się w zbiorze zmodyfikowanych plików, więc jedzie z commitem następnej fazy; jeśli żadna późniejsza faza nie wykonuje commitu, na końcu zaproponuj commit `chore(<change-id>): progress` zawierający wyłącznie `plan.md`.

---

## Cykl Plan → Generate → Review → Verify

Wewnątrz kwalifikującej się fazy pracuj ryzyko po ryzyku. Każdy krok `#### Automated` w Progress fazy (lub każde odrębne ryzyko na poziomie przeglądarki w Changes Required) to jeden obieg pętli. Utrzymuj pętlę krótką — jedno ryzyko, jeden zrecenzowany test, zweryfikowany przed przejściem dalej.

### Budżet testów na fazę

E2E jest kosztowne i podatne na flaky, dlatego budżet jest **ścisły** — zazwyczaj **jeden test na ryzyko**, rzadko więcej niż **1–3 na fazę**. Wybierz przepływ, który potwierdza ryzyko i wykryłby rzeczywistą regresję. Chronisz nazwane ryzyko, a nie gonisz za pokryciem. Nie generuj testu na stronę ani na przycisk.

### PLAN — wybierz ryzyko i zmapuj przepływ

1. Określ kontrakt w jednym zdaniu: **wejście** = jedno ryzyko na poziomie przeglądarki; **wyjście** = zrecenzowany test E2E, który *nie przechodzi, gdy to ryzyko się materializuje*. Jeśli ryzyko fazy nie jest konkretne, przed planowaniem wyciągnij obserwowalny wynik biznesowy z `test-plan.md` lub Success Criteria fazy. W samodzielnym uruchomieniu, którego ryzyka lub obserwowalnego wyniku nie rozwiązał krok 1 konfiguracji, najpierw zapytaj o nie użytkownika.
2. Wybierz ścieżkę — ten sam kontrakt w obu przypadkach:
   - **Sterowana przeglądarką** (domyślna): aplikacja musi być najpierw uruchomiona. Uruchom build, a następnie uruchom podgląd na porcie rozwiązywanym przez konfigurację (`E2E_PORT` z pliku env, w przeciwnym razie port `test-stack.md`) **w tle**, używając tych samych poleceń co wpis `webServer` aplikacji. Jeśli przepływ wywołuje zewnętrzne API, które mockujesz, uruchom najpierw mock i skieruj na niego build (`references/mocking-external-apis.md`, kroki 4–5), inaczej eksploracja wydaje prawdziwe pieniądze. Zatrzymaj wszystko przed VERIFY (krok 8). Następnie samodzielnie eksploruj działającą aplikację za pomocą `playwright-cli` z shella (`open`, `snapshot`, `click <ref>`, `fill`, `press`; migawki to pliki YAML na dysku, które odczytujesz ponownie), po czym zaplanuj i wygeneruj specyfikację na podstawie tego, co zobaczyłeś. Jeśli twoje narzędzie nie ma shella, ale ma serwer Playwright MCP, te same kroki obowiązują przez jego narzędzia przeglądarkowe. Eksploruj **migawkę dostępności** (nie zrzuty ekranu) i zmapuj przepływ dla tego ryzyka — szczęśliwą ścieżkę oraz wynikający z ryzyka przypadek brzegowy/błędu. Modeluj plan na `seed.spec.ts` — **jakość wzorca jest jakością testu.** Zobacz `references/browser-driven-generation.md`, aby poznać polecenia i pełną dyscyplinę (najpierw przygotuj stronę, migawka zamiast zrzutów ekranu, scenariusze niezależne i w dowolnej kolejności).
   - **Szablon promptu** (bez aktywnej przeglądarki, najprostsza): wypełnij `references/e2e-prompt-template.md` ryzykiem, kotwicą badawczą, scenariuszem biznesowym i granicami rzeczywiste vs mockowane, a następnie napisz specyfikację na podstawie odczytu aplikacji. Pozostaw plik szablonu nietknięty; napisz *nowy* plik promptu dla tego konkretnego ryzyka. Użyj tego, gdy nie jest dostępne ani CLI, ani MCP, albo przepływ jest prosty i dobrze zrozumiany.
3. Z góry oddziel granice **rzeczywiste** od **mockowanych**. **E2E ≠ zero mockowania.** Granice wewnętrzne (auth, routing, DB) pozostają rzeczywiste — tam ukrywa się ryzyko integracji. Mockuj kosztowne lub niedeterministyczne zewnętrzne API na warstwie sieciowej. Dla API wywoływanego przez aplikację **po stronie serwera** `page.route()` na poziomie przeglądarki go nie przechwyci. Zamiast tego użyj lokalnego serwera mocków, zgodnie z `references/mocking-external-apis.md`; wymaga to zmiany produkcyjnej, którą użytkownik musi zatwierdzić.

### GENERATE — utwórz test na podstawie dźwigni

4. Wygeneruj test zgodnie z konwencjami już zakodowanymi przez wzorzec i zasady — nie powtarzaj ich w prompcie. Na ścieżce sterowanej przeglądarką **wykonaj każdy krok na żywo** i napisz specyfikację na podstawie tego, co rzeczywiście ujawniło uruchomienie (odporne lokalizatory, rzeczywiste oczekiwania), a nie przypuszczeń. Zasadniczo wynik musi używać **lokalizatorów opartych na rolach**, być **uruchamialny niezależnie** (własne przygotowanie/działanie/asercja/cleanup), **czekać na stan**, a nie czas, **uwierzytelniać bez UI**, używać **unikalnych danych testowych** i mieć nazwę, która **wiąże go z ryzykiem** (nie `test('test 1', ...)`). Plik zasad (`references/e2e-quality-rules.md`) zawiera składnię specyficzną dla narzędzia.
5. **Jeden test na plik**, umieszczony zgodnie z konwencją projektu (domyślnie: katalog e2e na poziomie projektu, np. `tests/e2e/<feature>.spec.ts`). Nazwa pliku to przyjazna fs nazwa scenariusza; `describe` odpowiada elementowi planu/ryzyka najwyższego poziomu; umieść tekst każdego kroku planu jako komentarz przed akcjami go implementującymi i zachowaj nagłówek pochodzenia łączący specyfikację z jej ryzykiem i wzorcem.

### REVIEW — pięć antywzorców, ponów prompt po nazwie

6. Nigdy nie ufaj wygenerowanemu testowi E2E na pierwszy rzut oka. Zrecenzuj go względem pięciu antywzorców agentowych E2E w `references/e2e-anti-patterns.md`: Naive assertion, Brittle selector, Shared state, Hardcoded wait, No cleanup. „No cleanup” obejmuje cleanup, który istnieje, ale może po cichu zawieść: każde wywołanie cleanup musi asertywnie sprawdzać swój wynik, a wywołania API z `page.request` muszą przejść kontrolę origin/CSRF aplikacji (zobacz antywzorzec).
7. Dla każdego znalezionego antywzorca **ponów prompt, podając nazwę** — nigdy „napraw ten test”. Nazwij konkretny antywzorzec, wyjaśnij, *dlaczego* nie chroni ryzyka (albo dlaczego tworzy fałszywe błędy), i podaj **wzorzec docelowy**. Trzy elementy każdego ponowienia promptu: co jest nie tak, dlaczego nie chroni ryzyka, co je zastępuje. Zobacz dyscyplinę ponowienia promptu w `references/e2e-anti-patterns.md`.

### VERIFY — zielony, następnie powiązany z ryzykiem

8. **Zatrzymaj serwery, następnie uruchom tylko tę specyfikację.** Zatrzymaj każdy serwer uruchomiony do eksploracji oraz każdy demon podglądu, który pozostawił. Potwierdź, że port jest wolny (`lsof -nP -iTCP:<port> -sTCP:LISTEN` lub `netstat -ano | findstr :<port>` nie wypisuje niczego), aby `webServer` konfiguracji zbudował i uruchomił bieżący kod. Przy `reuseExistingServer` nadal działający serwer jest po cichu używany ponownie: jego build poprzedza twoje celowe uszkodzenie, więc uszkodzenie nigdy nie trafia do aplikacji, a test pozostaje **fałszywie zielony**. Uruchom specyfikację za pomocą wywołania pojedynczej specyfikacji projektu i potwierdź, że przechodzi. Krótko pokaż użytkownikowi zielony wynik.
9. **Pytanie kontrolne:** *czy ten test nie przeszedłby, gdyby zmaterializowało się ryzyko z `test-plan.md`?* Jeśli nie, asercja jest dekoracyjna — wróć do GENERATE/REVIEW. Aby to skonkretyzować, wykonaj **celowe uszkodzenie**: tymczasowo odwróć lub osłab zachowanie produkcyjne, na które celuje ryzyko (albo cel kluczowej asercji testu), uruchom ponownie, gdy port nadal jest wolny (aby `webServer` przebudował z uszkodzeniem), i potwierdź, że test staje się czerwony na asercji ryzyka (czerwony wynik z timeoutu, loginu albo wyścigu hydration niczego nie dowodzi — uruchom ponownie). Preferuj uszkodzenie, które pozostawia nienaruszoną ścieżkę obsługiwaną przez cleanup; niezależnie od tego poniższa kontrola pozostałości działa również po tym czerwonym uruchomieniu. Jeśli test pozostaje zielony po uszkodzeniu rzeczy, którą ma chronić, asercja niczego nie chroni — napraw ją przed przejściem dalej. **Natychmiast cofnij celowe uszkodzenie**; nigdy go nie zatwierdzaj.
   Następnie sprawdź cleanup w ten sam sposób — po zielonym uruchomieniu **i** po uruchomieniu z celowym uszkodzeniem (czerwone uruchomienie często zatrzymuje się w środku przepływu i pozostawia pośrednie rekordy, np. szkice niezapisanej sesji): wyszukaj własne dane testu w każdej tabeli, do której zapisuje przepływ (sesje logowania tworzone przez projekt konfiguracji przy każdym uruchomieniu są oczekiwane, nie są pozostałością) (to samo wyszukiwanie, którego używa cleanup, UI aplikacji albo baza danych) i potwierdź, że **nic nie zostało**. Unikalne identyfikatory ukrywają zepsuty cleanup — następne uruchomienie nie koliduje, dane po prostu się gromadzą. Jeśli cokolwiek pozostanie, cleanup jest uszkodzony: napraw go (REVIEW, „No cleanup”) i uruchom ponownie. Aby odnaleźć dane, test potrzebuje odnajdywalnego tokenu: zapisz go w teście (`test.info().annotations.push({ type: 'test-data', description: token })` pokazuje go w raporcie), zamiast przeszukiwać logi serwera.
10. **Oznacz krok jako zakończony.** Zmień dokładnie wiersz tego kroku w `## Progress`: `- [ ] N.M <title>` → `- [x] N.M <title>` (bez SHA jeszcze — SHA trafia na koniec fazy). Następnie wróć do PLAN dla kolejnego ryzyka.

Nigdy nie używaj `test.skip()` / `test.fixme()` do „zaliczenia” fazy — pominięty test jest niewidoczny. Test, którego nie da się doprowadzić do przejścia względem rzeczywistej aplikacji, jest sygnałem do zbadania (funkcji, przepływu lub flaky), a nie do wyciszenia.

Powtarzaj PLAN→GENERATE→REVIEW→VERIFY, aż każdy krok `#### Automated` w fazie będzie `[x]` i kryteria sukcesu fazy będą spełnione.

W uruchomieniu **samodzielnym** nie ma fazy ani `## Progress`: po potwierdzeniu przez VERIFY zielonego wyniku i celowego uszkodzenia uruchom lint/format projektu dla każdego zmodyfikowanego pliku (serwery mocków i helpery wyzwalają zasady, których specyfikacje nie wyzwalają), a następnie **zatrzymaj się** — zaraportuj plik specyfikacji i ryzyko, które chroni, wymień każdy plik zmieniony poza katalogiem testów (zmiany produkcyjne, konfiguracja) do sprawdzenia przez użytkownika i zaproponuj commit (`test: <risk> e2e`, staged by path), nie wykonując go bez pytania. Pomiń poniższy rytuał ukończenia fazy.

---

## Ukończenie fazy (tylko sterowane planem)

Gdy wszystkie wiersze `#### Automated` w `### Phase N:` mają status `[x]`, uruchom rytuał końca fazy (odzwierciedla `/10x-implement` i `/10x-tdd` — jeden commit Conventional Commits na fazę, następnie wpisz jego krótkie SHA z powrotem do wierszy, które zostały zmienione).

> **Twardy niezmiennik — commituj tylko na zielono.** Nigdy nie proponuj, nie stage'uj ani nie twórz commitu, gdy dowolny test w zakresie jest czerwony, pominięty, aby udawać przejście, lub gdy celowe uszkodzenie nadal znajduje się w drzewie. Commit jest proponowany **dopiero po przejściu nowych testów E2E względem działającej aplikacji** i cofnięciu wszelkich edycji celowego uszkodzenia. Czerwony wynik celowego uszkodzenia jest przejściowym punktem kontrolnym, który pokazujesz użytkownikowi, nigdy granicą commitu.

Utrzymuj **zbiór zmodyfikowanych plików** przez całą fazę: każdy utworzony lub edytowany plik (specyfikacje i plik promptu) do niego trafia, plus `context/changes/<change-id>/plan.md` (zawsze — edytujesz jego Progress). W **pierwszej fazie** zmiany zainicjuj go także wszelkimi nieśledzonymi/zmodyfikowanymi plikami wewnątrz `context/changes/<change-id>/` (`change.md`, `research.md` itd.). Zbiór **resetuje się na każdej granicy fazy**.

1. **Uruchom specyfikacje E2E fazy** względem działającej aplikacji i potwierdź zielony wynik. (Pełne uruchomienie E2E działa w CI, nie przy każdej edycji — lokalnie potwierdzasz specyfikacje dodane przez tę fazę. Napraw każde uszkodzenie przed commitem.) Uruchom również lint/format projektu na zmodyfikowanych plikach — serwer mocków lub helper często wyzwala zasady, których specyfikacje nie wyzwalają (globalne Node w `.mjs`), a hook pre-commit odrzuciłby commit.

2. **Bramka ręcznego potwierdzenia.** Powiedz człowiekowi, że automatyczna weryfikacja przeszła, wymień elementy ręcznej weryfikacji z planu dla tej fazy (w tym wykonaną kontrolę celowego uszkodzenia) i wstrzymaj działanie. Nie przechodź dalej, dopóki nie potwierdzi.

```
Phase [N] Complete (E2E) — Ready for Manual Verification

Automated verification passed:
- [E2E specs now green: list them]
- [deliberate-break check: which behavior you inverted and confirmed the test caught]

Please perform the manual verification steps from the plan:
- [manual items for this phase]

Let me know when manual testing is complete so I can commit.
```

   W **ostatniej fazie** uwzględnij także wszystkie nadal oczekujące wiersze `#### Manual` z wcześniejszych faz (informacyjnie; bramka nadal tylko wstrzymuje, nie blokuje twardo).

3. **Wykryj niepowiązane brudne ścieżki.** Uruchom `git status --porcelain`; wykonaj część wspólną ze ścieżkami **poza** zbiorem zmodyfikowanych plików. Jeśli jakieś istnieją, przedstaw je i zapytaj użytkownika, czy zatwierdzić tylko planowany zestaw (Recommended), stage'ować wszystkie, czy przerwać. Jeśli żadnych nie ma, pomiń.

4. **Stage'uj jawnie według ścieżki** — `git add` każdy plik ze zbioru zmodyfikowanych plików po nazwie. Nigdy `git add -A` / `git add .`.

5. **Kontrola pustego diffu.** `git diff --cached --quiet`; jeśli kod wyjścia to 0, wyświetl, że faza nie miała diffu (wiersze pozostają bez SHA), ustaw `SHA=""` i przejdź do kroku 8.

6. **Zaproponuj komunikat Conventional Commits** i poproś użytkownika o zatwierdzenie go (approve as proposed (Recommended) / edit subject / override). Temat: `test(<change-id>): <phase title> (p<N>)`. Zachowaj temat w granicy 72 znaków — skróć tytuł fazy, jeśli trzeba. W treści wspomnij charakter E2E/na poziomie przeglądarki i chronione ryzyko. Dołącz wiersz `Refs:`, jeśli rozmowa zawiera rzeczywiste referencje Jira/Linear/GitHub (nigdy nie wymyślaj ich z change-id ani brancha).

7. **Commituj** jednym `git commit` z treścią heredoc, zgodnie z globalnym protokołem komunikatów commitów: zatwierdzona linia tematu, następnie krótka treść wymieniająca dodane specyfikacje + ryzyko chronione przez każdą z nich (oraz wiersz `Refs:`, gdy ma zastosowanie). Nigdy nie przekazuj flag `--no-verify` / `--amend` / omijających podpisywanie. Jeśli hook pre-commit zawiedzie, napraw przyczynę i utwórz NOWY commit.

8. **Pobierz i wpisz z powrotem SHA.** `git rev-parse --short HEAD` → `SHA`. Dla każdego wiersza Progress zmienionego w tej fazie edytuj `- [x] N.M <title>` → `- [x] N.M <title> — <SHA>` (pomiń wiersze, które już zawierają SHA; jeśli `SHA=""`, pomiń — `/10x-archive` pokazuje wiersze bez SHA jako ostrzeżenia informacyjne).

9. **Zaktualizuj `change.md`**: `updated: <today>`; zachowaj `status: implementing` aż do końcowej fazy.

10. **Zresetuj zbiór zmodyfikowanych plików** przed następną fazą.

### Decyzja o następnej fazie

Zapytaj użytkownika:

- question: "Phase [N] [complete | blocked on a plan fix] (E2E). How to proceed?"
  header: "Next phase"
  options:
  - label: "Continue to Phase [N+1] (Recommended)"
    description: "Stay in this context; run the E2E gate for the next phase and proceed."
  - label: "Start a fresh session first"
    description: "Copy the resume command to the clipboard. Start a fresh session for Phase [N+1]."
  - label: "Review this phase first"
    description: "Run /10x-impl-review to verify the implementation against the plan before continuing."
  multiSelect: false

**Continue:** przeczytaj następną fazę, oznacz ją jako w toku na checkliście, uruchom bramkę E2E, kontynuuj. Nie trzeba ponownie czytać całego planu.

**Review:** uruchom `/10x-impl-review @<path-to-plan> phase [N]`, a następnie ponownie przedstaw decyzję kontynuacja/świeża sesja (bez opcji review).

Gdy Phase [N] była ostatnią fazą, pomiń to pytanie i przejdź do podsumowania ukończenia. Jeśli wiersze nadal są otwarte (faza zablokowana poprawką planu, faza przekazana), zamiast celebracji wyświetl poniższe częściowe podsumowanie.

**Fresh session:** skopiuj `/10x-e2e <change-id> phase [N+1]` do schowka (zgodnie z konwencją schowka) i wyświetl jako `→ /10x-e2e <change-id> phase [N+1] (✓ copied)`.

Jeśli otrzymasz polecenie uruchomienia wielu faz kolejno, pomiń to pytanie pomiędzy fazami. Zmień **ręczny** wiersz (i nadaj mu SHA fazy) dopiero po potwierdzeniu tego elementu przez użytkownika; w przeciwnym razie pozostaw go dla niego.

---

## Śledzenie stanu (tylko sterowane planem)

**Sekcja `## Progress` w `plan.md` jest jedynym źródłem prawdy** — bez pliku stanu, bez znaczników komentarzy. Ta umiejętność modyfikuje Progress dokładnie tak jak `/10x-implement` i `/10x-tdd`: zmienia `[ ]` → `[x]` dla każdego kroku w miarę jego realizacji; dodaje SHA końcowego commitu do każdego zmienionego wiersza, jednorazowo na końcu fazy. W trakcie fazy ukończone wiersze mają status `[x]` bez SHA — to prawidłowy stan pośredni. Ponieważ wszystkie trzy umiejętności zapisują tę samą sekcję identycznie, zmiana może być prowadzona przez dowolną z nich, w dowolnej kolejności.

**„Gdzie jestem?” jest wyliczane, a nie przechowywane:** pierwsza linia `- [ ]` jest następnym krokiem; obejmująca ją sekcja `### Phase N:` jest bieżącą fazą; ukończenie to `count([x]) / count([ ] + [x])`.

---

## Po wszystkich fazach (tylko sterowane planem)

Gdy każde `- [ ]` w całej sekcji `## Progress` ma status `[x]`:

1. **Defensywne skanowanie pozostałości.** Przeskanuj ponownie pod kątem pozostałych `- [ ]`. W normalnym przepływie ich nie ma. Jeśli jakiekolwiek istnieją (ręczna edycja lub pominięty trigger je pozostawiły), wypisz je pogrupowane według Automated/Manual i zapytaj użytkownika, czy **Pause** (STOP, nie dotykaj `change.md`) czy **Proceed to epilogue**.

2. **Zaktualizuj `change.md`**: `status: implemented`, `updated: <today>`. (NIE ustawiaj `archived_at` — to należy do `/10x-archive`.)

3. **Commit epilogu.** Wpisanie SHA końcowej fazy oraz zmiana statusu `change.md` pozostają brudne po końcowym rytuale. Stage'uj dokładnie `plan.md` + `change.md` (jawne ścieżki), sprawdź `git diff --cached --quiet` (pomiń, jeśli puste), zaproponuj `chore(<change-id>): close out plan (epilogue)`, zatwierdź i wykonaj commit przez heredoc. NIE wpisuj z powrotem własnego SHA epilogu.

4. **Podsumowanie ukończenia + opcjonalny review:**

```
All E2E phases done! 🎉

Summary:
- Phases completed: [N]  ([k] E2E'd, [j] redirected to /10x-tdd or /10x-implement)
- E2E tests added: [count] across [files], each tied to a test-plan.md risk
- Levers in place: seed.spec.ts + E2E rules
```

   Następnie zapytaj użytkownika: uruchomić `/10x-impl-review <change-id>` (review pełnego planu) czy pominąć.

**Częściowe podsumowanie** — gdy osiągnięto ostatnią fazę, ale wiersze nadal są otwarte, pomiń kroki 1–3 (`change.md` pozostaje `implementing`, bez epilogu) i wyświetl:

```
E2E pass over <change-id> finished — [k] of [N] phases complete (handed-off and blocked phases don't count).

- E2E'd: phase [a], [b] ([count] test(s))
- Handed off: phase [c] → /10x-<tdd|implement> (✓ copied)
- Blocked on a plan fix: phase [d] — [one line: the proposed fix]
```

Niezatwierdzone edycje `plan.md` (wpisanie SHA, zmienione wiersze) w przeciwnym razie czekałyby na commit przekazanej fazy, który może nigdy nie nastąpić: zaproponuj commit `chore(<change-id>): progress` zawierający wyłącznie `plan.md` (Recommended) albo pozostaw je dla tego commitu.

---

## Wytyczne E2E

Zasady rządzące każdym testem tutaj — referencje zawierają składnię i pełne uzasadnienie:

- **Obserwowalny wynik użytkownika** przekraczający rzeczywiste granice, a nie wewnętrzne wywołanie — oraz **nie przechodzi, gdy jego ryzyko się materializuje**, co jest potwierdzone przez kontrolę celowego uszkodzenia, a nie zakładane.
- **Lokalizatory oparte na rolach**, **samowystarczalne i izolowane** (własne przygotowanie/działanie/asercja/cleanup, unikalne dane, auth bez UI, bezpieczne przy równoległych uruchomieniach w losowej kolejności) oraz **oczekiwanie na stan, nigdy na czas**. Pięć sposobów, w jakie agenci to naruszają, znajduje się w `references/e2e-anti-patterns.md`.
- **Chroń nazwane ryzyko, nie powierzchnię** — bez testu na stronę/przycisk, bez nadmiernego mockowania granic wewnętrznych (mock auth + DB i test nie sprawdza niczego, co może się zepsuć w integracji), bez asercji pikselowych dla ryzyk funkcjonalnych (dla nich używaj deterministycznych narzędzi wizualnych).

**Rzeczywiste vs mockowane** jest podstawową wartością testu: granice wewnętrzne (auth, routing, DB) pozostają rzeczywiste — tam ukrywa się ryzyko integracji; mockuj tylko kosztowne lub niedeterministyczne zewnętrzne API na warstwie sieciowej.

**Vision** (zrzuty ekranu) jest uzupełnieniem dla ryzyk wyłącznie wizualnych (layout, z-index, animacja, canvas), a nie domyślną metodą — migawki DOM weryfikują funkcję. **Narzędzia auto-healing** pomagają przy dryfie selektorów/timingu (kieruj ich wynik przez review PR, nigdy nie commituj automatycznie), ale nigdy nie mogą „naprawiać” *zmienionego zachowania biznesowego* — maskuje to regresję, którą test ma wykryć. Oba zagadnienia opisuje `references/browser-driven-generation.md`; nieprzechodzący test E2E to zadanie debugowania, a nie generowania ani healingu.

### Umieszczanie plików

Postępuj zgodnie z konwencją wykrytą w Setup. Domyślnie, jeśli żadna nie istnieje: katalog e2e na poziomie projektu, `tests/e2e/<feature>.spec.ts`, jeden test na plik.

### Jeśli utkniesz

Używaj sub-agentów oszczędnie: w celu szybkiego wyszukiwania plików/wzorców albo wieloetapowej analizy nieznanego obszaru deleguj do sub-agenta, jeśli twoje narzędzie go posiada, w przeciwnym razie zrób to inline. Najpierw upewnij się, że przeczytałeś odpowiedni kod oraz rzeczywiste drzewo dostępności działającej aplikacji; codebase mógł ewoluować od czasu napisania planu.

## Inne stosy

Wzorzec, zasady i szablon promptu są dostrojone do Playwright, a ścieżka sterowana przeglądarką zakłada `playwright-cli` (albo, bez shella, serwer Playwright MCP). W Cypress, WebdriverIO lub Selenium zakoduj idiomy swojego narzędzia (jego odpowiednik `getByRole`, mechanizm wait-for-state, izolację danych) we własnym wariancie tych dźwigni i uruchamiaj jego własny runner. Zasady są przenośne; składnia nie. Tabela mapowania w `references/e2e-quality-rules.md` (Other stacks) zawiera idiom Cypress oraz WebdriverIO / Selenium dla każdej zasady.

## Referencje

- `references/e2e-quality-rules.md` — zasady E2E + zasady nadrzędne + mapowanie dla narzędzi innych niż Playwright.
- `references/e2e-anti-patterns.md` — pięć antywzorców + dyscyplina ponowienia promptu.
- `references/seed-test-pattern.md` — przykład `seed.spec.ts` + cztery wzorce (sam wzorzec jest pisany przez `/10x-e2e-setup`).
- `references/e2e-prompt-template.md` — gotowy do wklejenia prompt generowania + działający przykład.
- `references/mocking-external-apis.md` — mockowanie zewnętrznego API, które aplikacja wywołuje po stronie serwera: bazowy URL nadpisywalny przez env, lokalny serwer mocków jako dodatkowy wpis `webServer`, uwagi dotyczące stosu.
- `references/browser-driven-generation.md` — eksplorowanie aplikacji za pomocą `playwright-cli` w celu zaplanowania i wygenerowania jednej specyfikacji na ryzyko (przepływ pracy z drzewem dostępności, migawka zamiast zrzutów ekranu, jeden test na plik, pisanie na podstawie rzeczywistego wykonania, granica auto-heal).