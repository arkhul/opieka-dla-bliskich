---
name: 10x-roadmap
description: >
  Milestone-driven roadmap manager: open an outcome-scoped milestone from
  source materials (primary: the PRD), decompose it into vertical end-to-end
  slices in context/foundation/roadmap.md, track the milestone as connected
  slices complete, close it when every slice is done, and loop into the next
  milestone. Use AFTER /10x-prd (and after the tech-stack selection /
  bootstrap step, when applicable). Trigger phrases: "write the roadmap",
  "generate roadmap", "create the roadmap from PRD", "stwórz roadmapę",
  "open a milestone", "close the milestone", "milestone status", "what
  should I build first", "what's next on the roadmap". Do NOT use for
  per-change planning — that's /10x-plan's job.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Agent
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Mapa drogowa: Mapa drogowa oparta na kamieniach milowych dla context/foundation/roadmap.md

Ta umiejętność jest pomostem między **produktem** (PRD lub innymi materiałami źródłowymi) a **planowaniem pojedynczych zmian** (`/10x-plan`) i działa jako **menedżer projektu na poziomie kamieni milowych**. Praca jest grupowana w **kamienie milowe**: partie powiązanych pionowych wycinków ograniczone wynikiem, przy czym dokładnie jeden może być otwarty naraz i jest śledzony w samym `roadmap.md`. Każde wywołanie najpierw rozdziela działanie według stanu kamienia milowego (Krok 0): jeśli żaden kamień milowy nie jest otwarty, umiejętność prosi o materiały źródłowe i otwiera go; jeśli kamień milowy jest aktywny, raportuje stan i rekomenduje kolejny ruch; jeśli każdy wycinek jest ukończony, zamyka kamień milowy i przechodzi do otwarcia następnego — na podstawie zaktualizowanych materiałów źródłowych lub własnego opisu użytkownika.

W ramach otwartego kamienia milowego zadanie dekompozycji pozostaje niezmienione: przeczytaj materiały źródłowe, automatycznie zbadaj stan bazowy kodu, **wywnioskuj zdecydowaną propozycję sekwencjonowania** (główny cel, wycinek gwiazdy przewodniej, obszary inwestycji, główna blokada), pokaż wyłącznie rzeczywistą niepewność, której artefakty nie potrafią rozstrzygnąć, i wygeneruj `context/foundation/roadmap.md`, który wymienia pionowe, widoczne dla użytkownika wycinki w kolejności zależności — gotowe do przekazania do `/10x-plan <change-id>`.

## Warstwa kamieni milowych — maszyna stanów znajduje się w pliku referencyjnym

Cykl życia kamienia milowego (stany, reguły wykrywania, przejścia, niezmienniki) jest określony w **`references/milestone-state.md`**, celowo utrzymywanym poza tym plikiem. **Czytaj go tylko wtedy, gdy wywołanie działa na poziomie kamienia milowego** — przy pierwszym uruchomieniu, wznowieniu/sprawdzeniu statusu, zamknięciu kamienia milowego lub otwieraniu następnego. Czysta ponowna dekompozycja już otwartego kamienia milowego go nie wymaga.

Dwa fakty potrzebne przed podjęciem decyzji, czy go załadować:

- Stan jest **wyprowadzany wyłącznie z `roadmap.md`** (frontmatter `milestone_id` / `milestone_status` + statusy elementów). Nie ma pomocniczego pliku stanu.
- Identyfikatory kamieni milowych to `M-<seq>` z `milestone_id` w kebab-case; kamienie milowe są **ograniczone wynikiem, nigdy czasem** — kamień milowy zamyka się, gdy jego wycinki są `done`, a nie gdy mija data. To nie jest sprint.

**Postawa: zdecydowany rekomendujący, zwięzły wywiad.** Umiejętność działa jak starszy lider techniczny, który przeczytał PRD, zbadał kod i przychodzi z rekomendacją — ale nadal pyta człowieka o 2–3 decyzje nośne przed zatwierdzeniem. Reguły wywiadu (limit 3 pytań, mocne rekomendacje, bez chochołów, wyjątek dla niestandardowego MVP) są określone raz, w Kroku 5.

Jest to umiejętność **dekompozycji + sekwencjonowania**, a nie planista niskiego poziomu. NIGDY nie wybiera frameworków, ścieżek plików, schematów, bibliotek ani szczegółów implementacyjnych — należą one do `/10x-plan`. NIGDY nie przypisuje estymacji czasu, rozmiarów koszulkowych, punktów ani dat z kalendarza ludzi — wykonanie przez agentów jest nieliniowe, a estymacje oparte na budżecie czasu byłyby kłamstwem. To, co ROBI, to: nazywa wycinki, sekwencjonuje je według zależności i zdefiniowanego celu, ujawnia blokady oraz kieruje otwarte pytania tam, gdzie mogą zostać rozstrzygnięte.

Umiejętność jest **natywna dla AI** na cztery konkretne sposoby: (1) wyraża kolejność jako graf zależności, nie kalendarz; (2) oznacza wycinki, które mogą być wykonywane równolegle przez osobne uruchomienia agentów; (3) przekazuje „blokujące niewiadome” wyżej, gdzie człowiek może je rozstrzygnąć, zamiast pozwolić im po cichu przedostać się do implementacji; (4) inwentaryzuje istniejący kod za pomocą subagentów zamiast pytać użytkownika, co już jest na miejscu.

## Kiedy używać, kiedy pominąć

**Użyj, gdy**: użytkownik chce otworzyć kamień milowy i go zdekomponować (typowym pierwszym źródłem jest nietrywialny `context/foundation/prd.md` z wypełnionymi FR i historyjkami użytkownika), sprawdzić status kamienia milowego/mapy drogowej albo zamknąć ukończony kamień milowy i otworzyć następny. Typowe wyzwalacze: właśnie ukończono `/10x-prd`, właśnie ukończono bootstrap, powrót do projektu i pytanie „co dalej” albo zarchiwizowano wszystkie wycinki mapy drogowej.

**Pomiń, gdy**: PRD jest pusty w środku (duże `## Open Questions`, `# TODO: domain rule`) — najpierw wskaż `/10x-prd` (lub nadrzędne `/10x-shape`); mapa drogowa z pustego PRD odziedziczy tę pustkę. Pomiń też, gdy użytkownik chce szczegółowo zaplanować *pojedynczą* zmianę — do tego służy `/10x-plan`. Mapa drogowa jest mnoga; plan jest pojedynczy.

## Relacja z innymi umiejętnościami

- `/10x-shape` i `/10x-prd` — tworzą nadrzędny PRD konsumowany przez tę umiejętność. Jeśli `shape-notes.md` zawiera blok `## Forward: technical-roadmap` (gdzie kształtowanie odkłada treści związane z mapą drogową), ta umiejętność je podnosi.
- `10x-tech-stack-selector` — działa między `/10x-prd` a tą umiejętnością w łańcuchu bootstrapu. Jeśli istnieje `context/foundation/tech-stack.md`, ta umiejętność czyta go jako dane wejściowe do wyprowadzenia `## Foundations` (szkielet uwierzytelniania, szkielet wdrożenia, obserwowalność — wszystko, co wynikało z kroku wyboru stosu technologicznego) oraz do skrócenia sond bazowych dla warstw już zadeklarowanych.
- `/10x-plan` — konsument downstream. Użytkownik wybiera element mapy drogowej i wywołuje `/10x-plan <change-id>`; ta umiejętność tworzy folder zmiany, przygotowuje szczegółowy plan i przełącza `Status` pasującego elementu mapy drogowej na `planning`. Mapa drogowa NIE tworzy wcześniej folderów zmian; jeden wycinek może wygenerować wiele zmian, gdy `/10x-plan` odkryje, że element nadal jest zbyt szeroki (tylko pierwsza przesuwa status współdzielonego elementu).
- `/10x-implement` (oraz jego autonomiczny odpowiednik `/10x-goal-implement`) — dalej downstream. Gdy implementacja *zaczyna się* dla zmiany, której `Change ID` pasuje do elementu mapy drogowej, przełącza `Status` tego elementu na `in-progress` — otwarty odpowiednik przełączenia na `done` przez `/10x-archive`. Ta umiejętność nadal generuje wyłącznie `proposed` / `ready` / `blocked`; pośrednie stany cyklu życia (`planning`, `in-progress`) są teraz zapisywane downstream, gdy zmiana przechodzi przez plan → implementację. Każde przełączenie downstream dopasowuje według `Change ID`, jest realizowane w trybie best-effort (brak dopasowania jest cichym pominięciem) i działa wyłącznie do przodu (nigdy nie cofa bardziej zaawansowanego statusu).
- `/10x-archive` — zamyka pętlę na końcu. Gdy zmiana, której `Change ID` pasuje do elementu mapy drogowej, zostanie zarchiwizowana, `/10x-archive` przełącza `Status` tego elementu na `done` (w `## At a glance` i w bloku treści elementu) oraz dopisuje wpis do `## Done`. Ta umiejętność nigdy nie wypełnia wcześniej `## Done`; `/10x-archive` jest jego jedynym zapisującym.
- `/10x-frame`, `/10x-research` — ortogonalne. Działają na pojedynczej zmianie, nie na mapie drogowej.

## Odpowiedź początkowa — Krok 0: rozdzielenie według stanu kamienia milowego

Gdy ta umiejętność zostanie wywołana, wykonaj rozdzielenie PRZED rozpoczęciem jakiejkolwiek pracy dekompozycyjnej:

1. **Zbadaj stan kamienia milowego** (tanio, plik referencyjny nie jest jeszcze potrzebny):

   ```bash
   test -f context/foundation/roadmap.md && head -20 context/foundation/roadmap.md
   ```

   - Brak pliku lub plik obecny bez klucza frontmatter `milestone_id` → **brak otwartego kamienia milowego** (pierwsze uruchomienie lub starsza mapa drogowa).
   - `milestone_status: open` → kamień milowy aktywny lub gotowy do zamknięcia (zależy od statusów elementów — przeczytaj cały plik, aby stwierdzić).
   - `milestone_status: done` → poprzedni kamień milowy zamknięty, następny jeszcze nieotwarty.

2. **O ile kamień milowy nie jest otwarty z nieukończonymi elementami, a użytkownik wyraźnie nie poprosił o świeżą dekompozycję** — tj. przy pierwszym uruchomieniu, adopcji starszej wersji, sprawdzeniu statusu/kolejnego ruchu, zamknięciu lub otwieraniu kolejnego kamienia milowego — **przeczytaj teraz `references/milestone-state.md`** i wykonaj odpowiadające przejście. Przejścia delegują z powrotem do Kroków 1–10 poniżej, gdy potrzebna jest dekompozycja.

3. **Jeśli kamień milowy jest otwarty, a użytkownik poprosił o ponowne wygenerowanie dekompozycji** (lub przekazał argument ścieżki źródłowej, np. `/10x-roadmap @path/to/prd.md`), pomiń plik referencyjny: przechwyć ścieżkę (usuń wiodące `@`), w przeciwnym razie domyślnie użyj `context/foundation/prd.md` i przejdź od razu do Kroku 1. Ponowne generowanie zachowuje frontmatter kamienia milowego oraz `## Milestone History` dosłownie i przenosi statusy elementów według `Change ID` (wyłącznie do przodu).

## Interaktywne pytania — niezależne od hosta

Ilekroć procedura mówi *„zapytaj użytkownika”*, użyj dowolnego narzędzia strukturalnych pytań interaktywnych udostępnianego przez agenta hosta (Claude Code → `AskUserQuestion`; na innych hostach dowolne narzędzie, które zadaje użytkownikowi pytanie z opisanymi opcjami). Jeśli żadne nie jest dostępne, użyj zwykłej wiadomości konwersacyjnej z listą opisanych opcji — nie blokuj procedury. Gdy pytasz po raz pierwszy, podaj, które narzędzie wybrałeś (lub że wróciłeś do zwykłego czatu), aby użytkownik mógł cię poprawić.

Bloki pytań występują w Krokach 1, 3, 4, 5 i 9 oraz w przejściach kamieni milowych w `references/milestone-state.md` — są to krótkie strukturalne wybory. Krok 5 zadaje każdą kotwicę jako osobne pytanie strukturalne; jego podsumowanie syntezy to zwykły markdown (bez dodatkowego pytania).

## Równoległe badanie stanu bazowego — niezależne od hosta

Ilekroć procedura mówi o użyciu subagentów lub uruchamianiu równoległych sond, użyj dowolnego narzędzia badań w tle / tworzenia zadań udostępnianego przez hosta (Claude Code → `Agent` z typem subagenta Explore/general-purpose; na innych hostach dowolne narzędzie, które uruchamia izolowanego agenta i zwraca podsumowanie), rozsyłając sondy w jednym wsadowym wywołaniu. Jeśli żadne nie istnieje, uruchom te same sondy sekwencyjnie w głównym kontekście. Każda ścieżka musi zwrócić ten sam kształt podsumowania stanu bazowego z dowodami plikowymi.

## Proces

### Krok 1: Pozyskaj i przeczytaj materiały źródłowe

**Podczas otwierania kamienia milowego** (pierwsze uruchomienie lub przejście do następnego kamienia milowego z `references/milestone-state.md`) zapytaj, na czym kamień milowy ma być zbudowany — nie zakładaj, ale rekomenduj PRD:

Pytanie interaktywne:
- question: "Jakie są materiały źródłowe dla tego kamienia milowego?"
  header: "Źródła"
  options:
  - label: "PRD w context/foundation/prd.md (Recommended)"
    description: "Standardowa ścieżka: zakres kamienia milowego wynika z FR i historyjek użytkownika PRD. Najpierw uruchom /10x-prd, jeśli jeszcze nie istnieje."
  - label: "Inne dokumenty — podam ścieżki"
    description: "Specyfikacje, briefy, dokumenty badawcze. Wycinki będą śledzić ich treść, zapisaną jako kotwice zakresu w karcie kamienia milowego."
  - label: "Sam opiszę kamień milowy"
    description: "Opis swobodny, bez dokumentu. Wydestyluję go do kotwic zakresu MS-NN, które będą śledzone przez wycinki."
  - label: "Cancel"
    description: "Zakończ bez zmian."
  multiSelect: false

Dla kolejnych kamieni milowych `references/milestone-state.md` doprecyzowuje te opcje (zaktualizowany PRD vs kolejna transza tego samego PRD). Gdy wywołanie zawierało jawny argument ścieżki, pomiń pytanie i użyj tej ścieżki.

Rozwiąż i zweryfikuj ścieżki wejściowe:

```bash
test -f "<resolved-path>"
```

Jeśli plik istnieje, **przeczytaj go W CAŁOŚCI** (bez `limit`/`offset`). Jeśli użytkownik wybrał własny opis, przechwyć zamiast tego jego opis dosłownie — staje się on kartą `## Milestone` z numerowanymi kotwicami zakresu `MS-NN`, a sprawdzenie gotowości PRD z Kroku 3 zostaje zastąpione sprawdzeniem kotwic (< 2 możliwe do wydestylowania kotwice `MS-NN` → poproś użytkownika o doprecyzowanie opisu, a następnie ZATRZYMAJ, jeśli nie może).

Jeśli wskazany plik nie istnieje, zapytaj za pomocą wybranego narzędzia interaktywnych pytań:

Pytanie interaktywne:
- question: "Nie znaleziono źródła pod `<resolved-path>`. Jak chcesz kontynuować?"
  header: "Dane wejściowe?"
  options:
  - label: "Najpierw uruchom /10x-prd (Recommended)"
    description: "Zatrzymaj się tutaj. Uruchom /10x-prd, aby utworzyć prd.md, a następnie ponownie wywołaj /10x-roadmap."
  - label: "Podaj inną ścieżkę"
    description: "Poczekam, aż podasz ścieżkę."
  - label: "Cancel"
    description: "Zakończ bez zmian."
  multiSelect: false

Po wybraniu „Najpierw uruchom /10x-prd”: wyświetl komunikat przekierowania i ZATRZYMAJ.

### Krok 2: Przeczytaj dodatkowe dane wejściowe (best effort)

Przeczytaj je, jeśli istnieją; w przeciwnym razie odnotuj ich brak i kontynuuj:

- `context/foundation/shape-notes.md` — poszukaj sekcji `## Forward: technical-roadmap`. Jeśli istnieje, podnieś jej wypunktowania dosłownie jako kandydatów na dane wejściowe mapy drogowej (użytkownik już odłożył je tam podczas kształtowania).
- `context/foundation/tech-stack.md` — zasila sekcję `## Foundations` ORAZ skraca sondy stanu bazowego (warstwa już zadeklarowana tutaj jest zgłaszana jako „per tech-stack.md” bez ponownego badania).
- `context/foundation/roadmap.md` — jeśli już istnieje, zachowaj go dla Kroku 9 (obsługa kolizji). NIE modyfikuj go jeszcze.
- `context/foundation/lessons.md` — jeśli istnieje, przeskanuj pod kątem reguł dotyczących kolejności lub gotowości (np. „zawsze najpierw dostarczaj najbardziej ryzykowny wycinek”). Traktuj jako założenia wstępne, nie dogmat.

### Krok 3: Sprawdzenie gotowości PRD

Przed wygenerowaniem oceń PRD według heurystyki gotowości 0–4. Każdy sygnał daje 1 punkt:

1. **Vision & Problem Statement jest nietrywialne** — sekcja istnieje, zawiera ≥ 2 zdania, NIE zawiera `# TODO`.
2. **Co najmniej jedna wypełniona historyjka użytkownika** — istnieje nagłówek `### US-NN:` z blokiem Given/When/Then pod nim (nie `# TODO`).
3. **Co najmniej jeden FR `must-have`** — istnieje linia pasująca do `^- FR-\d{3}: .* (P|p)riority: must-have$`.
4. **Business Logic jest wypełnione** — pierwsza niepusta linia sekcji `## Business Logic` jest zdaniem deklaratywnym (nie `# TODO: domain rule`).

Udokumentuj heurystykę wyraźnie w rozmowie:

```
PRD readiness check (heuristic, 4 signals, 1 point each):
  [✓|✗] Vision & Problem Statement non-trivial
  [✓|✗] ≥ 1 populated user story
  [✓|✗] ≥ 1 must-have FR
  [✓|✗] Business Logic populated

  Score: <N>/4
  Open Questions in PRD: <count>
```

**Wynik ≥ 3**: PRD jest gotowy do mapy drogowej; przejdź do Kroku 4.

**Wynik < 3**: ostrzeż wyraźnie. Wymień, czego brakuje i dlaczego ma to znaczenie dla mapy drogowej (NIE ogólne „twoje PRD jest zbyt cienkie”):

```
This PRD scored <N>/4 on the roadmap-readiness heuristic. Missing signals:

  - <signal name>: <one-line consequence for the roadmap>
  - ...

A roadmap generated from a hollow PRD will have many slices marked Status:
blocked with their first Unknown being a PRD gap. That's a valid intermediate
state — the roadmap surfaces what's blocking — but if you have time to firm
up the PRD first, the resulting roadmap will be substantially more actionable.
```

Następnie zapytaj za pomocą wybranego narzędzia interaktywnych pytań:

Pytanie interaktywne:
- question: "Jak chcesz kontynuować?"
  header: "Cienki PRD"
  options:
  - label: "Najpierw dopracuj PRD (Recommended)"
    description: "Zatrzymaj się tutaj. Rozwiąż Open Questions / TODOs PRD, a następnie ponownie wywołaj /10x-roadmap."
  - label: "Kontynuuj mimo to"
    description: "Wygeneruj na podstawie dostępnych danych. Puste obszary pojawią się jako zablokowane wycinki z luką PRD jako ich Unknown."
  - label: "Cancel"
    description: "Zakończ bez zmian."
  multiSelect: false

Po „Najpierw dopracuj PRD”: wyświetl przekierowanie i ZATRZYMAJ. Po „Kontynuuj mimo to”: kontynuuj z zapisanym wynikiem, aby Krok 6 mógł oznaczyć cienkie obszary.

### Krok 4: Automatyczne badanie stanu bazowego

Ocena „co już jest na miejscu” nie powinna spadać na użytkownika — kod jest źródłem prawdy. Użyj wybranego narzędzia badań w tle / tworzenia zadań, jeśli jest dostępne, aby równolegle zinwentaryzować każdą warstwę. Jeśli takie narzędzie nie istnieje, uruchom te same sondy sekwencyjnie w głównym kontekście. Każda sonda zwraca jednoakapitowy werdykt: **present** (z dowodami plikowymi), **absent** lub **partial** (szkielet istnieje, ale nie jest podłączony). Następnie pokaż inwentaryzację użytkownikowi do potwierdzenia, zanim zasili Foundations.

**Warstwy do zbadania** (pomiń warstwę, jeśli `tech-stack.md` już podaje wybór tej warstwy — zgłoś „per tech-stack.md: <choice>” zamiast badać):

| Warstwa | Czego szuka sonda |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| Frontend | Framework UI, narzędzia budowania, routing, biblioteki komponentów — zależności `package.json`, pliki konfiguracji frameworka |
| Backend / API | Framework serwera, trasy API, handlery żądań — entrypointy, pliki tras, kontrolery |
| Data | Sterownik DB, ORM/query builder, narzędzia schematów/migracji, dane seedowane — pliki schematów, katalogi migracji |
| Auth | Integracja dostawcy auth, obsługa sesji/tokenów, middleware auth — konfiguracja auth, pliki middleware |
| Deploy / infra | Cel hostingu, konfiguracja kontenera, workflowy CI/CD, infra-as-code — `Dockerfile`, `.github/workflows`, deploy YAML |
| Observability | Biblioteka logowania, śledzenie błędów, metryki, dashboardy — importy sentry/datadog/otel, middleware logów |

**Uruchom wszystkie sondy w jednej delegacji wsadowej, gdy host to obsługuje.** Każdy prompt jest krótki i samowystarczalny; delegowani agenci zwracają tylko po jednym akapicie, więc główny kontekst pozostaje mały. Przykład dla Auth:

> Zinwentaryzuj warstwę auth/tożsamości tego kodu. Raportuj w mniej niż 100 słowach: (1) czy istnieje integracja z dostawcą auth? Podaj nazwę. (2) Czy istnieją ścieżki kodu wystawiające lub weryfikujące sesje/tokeny? Przytocz plik:linię. (3) Czy istnieje middleware auth na poziomie tras? Przytocz. Jeśli warstwa nie istnieje, powiedz „absent” — nie spekuluj. Nie proponuj zmian. Nie zapisuj ani nie edytuj plików.

Dostosuj ten sam szablon do każdej warstwy. Zawsze wymagaj: werdyktu present/absent/partial, ≤ 100 słów, dowodów plikowych, gdy jest obecna, bez spekulacji, bez edycji.

Po zwróceniu wszystkich sond przedstaw użytkownikowi jednoopcjanowe podsumowanie stanu bazowego:

```
Codebase baseline (auto-researched):

  Frontend:      <present | absent | partial> — <one line, with file pointer>
  Backend/API:   <…>
  Data:          <…>
  Auth:          <…>
  Deploy/infra:  <…>
  Observability: <…>
```

Następnie potwierdź:

Pytanie interaktywne:
- question: "Czy ten stan bazowy odpowiada twojemu rozumieniu? Czy jest coś do poprawienia lub dodania, zanim zasili Foundations?"
  header: "Stan bazowy"
  options:
  - label: "Wygląda dobrze — kontynuuj"
    description: "Użyj tego stanu bazowego jako danych wejściowych dla Foundations i sekcji ## Baseline mapy drogowej."
  - label: "Popraw jedną lub więcej warstw — wyjaśnię"
    description: "Poprawka swobodna. Ponownie zapiszę warstwę lub warstwy przed kontynuowaniem."
  - label: "Dodaj coś, czego nie ma na liście"
    description: "Swobodnie. Rzeczy pominięte przez sondy (planowane, ale niepodłączone, szkielet z innego repozytorium itd.)."
  multiSelect: true

Zapisz potwierdzony stan bazowy. Zasila on bezpośrednio Krok 6a (Foundations): warstwy **present** → Foundations je pomija; **absent** lub **partial** → otwiera się miejsce Foundations. Zasila także sekcję `## Baseline` mapy drogowej dosłownie.

### Krok 5: Zwięzły wywiad — 2–3 pytania kotwiczące, każde z mocną rekomendacją

PRD opisuje **produkt**. Stan bazowy (Krok 4) opisuje **to, co już istnieje**. Ten krok tworzy ramy mapy drogowej — `main_goal`, `north_star`, obszary inwestycji, `top_blocker` — przez ograniczony wywiad: maksymalnie **trzy pytania kotwiczące**, każde zawierające jedną mocną **Rekomendację** opartą na cytowanej linii artefaktu oraz 1–2 alternatywy z jednowierszowym uzasadnieniem „dlaczego to też jest rozsądne”. Użytkownik wybiera Rekomendację, wybiera alternatywę lub swobodnie ją nadpisuje; obszary inwestycji są *wyprowadzane* z odpowiedzi, nie są pytane. To optymalny punkt między dwoma trybami awarii, których umiejętność już doświadczyła: **cichym automatycznym ramowaniem** (podejmowanie decyzji nośnych bez bramki człowieka) i **nieograniczonym odkrywaniem** (pytanie o to, na co artefakty już odpowiadają). Jeśli `shape-notes.md` zawierał blok `## Forward: technical-roadmap`, wykorzystaj go w Rekomendacjach — nie pozyskuj ponownie treści, które użytkownik już tam odłożył. Jeśli kotwica nadal jest nierozstrzygnięta po osiągnięciu limitu, **podejmij decyzję** zgodnie z Rekomendacją, zapisz ją we frontmatter z jednowierszowym uzasadnieniem i kontynuuj — użytkownik może ją nadpisać w dowolnym momencie.

**5a. Wywnioskuj rekomendacje oraz faktycznie rozsądne alternatywy.**

Dla każdej poniższej kotwicy wyprowadź *zarówno* Rekomendację, JAK I alternatywy — na podstawie konkretnych cytatów z frontmatter PRD / `## Vision` / `## Success Criteria` / `## NFRs` / `## Open Questions` / stanu bazowego / `tech-stack.md`. Alternatywa jest „rozsądna” tylko wtedy, gdy prawdziwy sygnał w artefaktach ją wspiera LUB jest powszechnym, możliwym do obrony ustawieniem domyślnym dla kształtu produktu. **Nie wymieniaj chochołów.** Jeśli tylko jedna wartość jest wiarygodna (brak prawdziwej alternatywy możliwej do wsparcia artefaktami), powiedz to — ta kotwica zostanie przedstawiona z pojedynczą Rekomendacją oraz zapasową opcją „nadpisz własnymi słowami”.

- **`main_goal`** — wybierz spośród `market-feedback` | `quality` | `low-complexity` | `speed` | `learn` | `other`. Sygnały: `timeline_budget` (napięty → speed lub low-complexity), `target_scale` (mały → low-complexity; masowy rynek → quality), sformułowania kryteriów sukcesu („learn from real users” → market-feedback; „validate the riskiest assumption” → market-feedback; „no incidents at launch” → quality), ton Vision (eksploracyjne hobby → learn; twardy termin → speed). Alternatywy są *sąsiednimi* wartościami, które te same dowody mogą rozsądnie wspierać — np. `market-feedback` i `speed` często współistnieją, gdy PRD mówi „ship to learn fast”.

- **`north_star`** — najmniejszy kompleksowy przepływ widoczny dla użytkownika, który dostarczony jako pierwszy udowadnia główną hipotezę Vision PRD. Zwykle śledzi historyjkę US-NN o wysokim priorytecie ORAZ główne kryterium sukcesu. Rozsądne alternatywy to *inne* kandydackie wycinki, które również śledzą główne kryterium sukcesu lub historyjkę US-NN o wysokim priorytecie, z mniejszą liczbą Prerequisites lub z innymi konsekwencjami sekwencjonowania. Gdy kandydatów jest więcej niż trzech, przedstaw trzy najlepsze.

- **`top_blocker`** — wybierz spośród `skills` | `capacity` | `time` | `decisions` | `external` | `motivation` | `none`. Sygnały: ≥ 3 nierozstrzygnięte `## Open Questions` PRD → `decisions`; ambitny zakres vs niedopasowanie `timeline_budget` → `time` lub `capacity`; zależność od dostawcy nazwana w PRD, która nie została jeszcze zakontraktowana → `external`; tech-stack wymienia warstwę, której zespół nigdy nie wdrażał → `skills`; jeśli żaden warunek nie zachodzi → `none`. Rozsądne alternatywy są *sąsiednimi* typami blokad uruchamianymi przez podobne sygnały — np. `time` i `capacity` często uruchamiają się razem przy napięciu zakresu i terminu.

- **Obszary inwestycji** (NIE pytane — wyprowadzane w 5d) — dla każdego z `frontend`, `backend`, `data`, `infra`: zdecyduj `invest deeply` vs `go simple`. Sygnały: NFR PRD, które warunkują uruchomienie w warstwie (prywatność / opóźnienia / poprawność → inwestuj tam), luki stanu bazowego mapujące się na FR must-have (brak auth + must-have wielu użytkowników → inwestuj w auth), Open Questions skoncentrowane w jednej warstwie (nierozstrzygnięte decyzje tam → inwestuj) oraz wybrany `main_goal` (`quality` wzmacnia warstwy prywatności/obserwowalności; `learn` wzmacnia nieznaną warstwę; `speed` / `low-complexity` domyślnie utrzymuje wszystko prosto). NIE promuj warstwy do „invest” bez nazwania sygnału PRD/stanu bazowego/main_goal.

**5b. Pomiń kotwicę tylko wtedy, gdy artefakt jest jednoznaczny.** Jeśli frontmatter PRD lub Success Criteria *dosłownie podaje* wartość (np. `timeline_budget: "1 week to ship"` plus „we need to launch before X” → `main_goal: speed`), pomiń to pytanie i ogłoś pominięcie wraz z wybraną wartością i cytatem, który ją przesądza. Nigdy nie pomijaj, gdy istnieje jakakolwiek wiarygodna alternatywa — potwierdzenie użytkownika przy rzeczywistym wyborze jest warte więcej niż zaoszczędzone sekundy. W praktyce zwykle zadasz 2–3 pytania; możesz zadać mniej, ale NIGDY więcej niż 3.

**5c. Przeprowadź wywiad — jedno pytanie strukturalne na kotwicę, w kolejności.**

Dla każdej niepominiętej kotwicy — `main_goal`, następnie `north_star`, potem `top_blocker` — użyj wybranego narzędzia interaktywnych pytań. Każde pytanie to osobne wywołanie (sekwencyjnie, nie wsadowo). Format:

Pytanie interaktywne:
- question: "<plain-language anchor question, in the user's language>"
  header: "<short header — e.g., Cel | Gwiazda | Główne ryzyko / Goal | North star | Blocker>"
  options:
  - label: "<Recommend value> (Recommended)"
    description: "<One-line why, with the artifact quote/pointer that grounds the Recommend.>"
  - label: "<Alternative A value>"
    description: "Reasonable when <one-line condition the artifacts partially support>; you'd pick this when <sequencing/scope consequence>."
  - label: "<Alternative B value>"
    description: "Reasonable when <one-line condition>; you'd pick this when <consequence>."
  - label: "Something else — I'll explain"
    description: "Free-form. Name the value and the reason; I'll record both and sequence accordingly."
  multiSelect: false

Reguły dla bloku opcji:
- **Rekomendacja jest zawsze opcją 1**, z sufiksem „(Recommended)” w etykiecie.
- **Każda alternatywa zawiera własną klauzulę „dlaczego rozsądna”** powiązaną z sygnałem artefaktu — nie „alternative: quality”, lecz „alternative: quality — reasonable when launch correctness matters more than first-user signal”. Alternatywa bez takiej klauzuli jest chochołem; usuń ją.
- **Najwyżej 2 alternatywy** oraz zapasowa opcja swobodna (łącznie 2–4 opcje). Dłuższe listy męczą użytkownika bez dodawania sygnału.
- **Opcje gwiazdy przewodniej nazywają kandydatów na wycinki, nie abstrakcyjne wartości** — każda etykieta to `<US-NN candidate> — <one-line outcome>`.
- **Jeśli tylko jedna wartość jest wiarygodna** (5a nie znalazło rozsądnej alternatywy), przedstaw tylko Rekomendację i „Something else — I'll explain” oraz ujawnij w treści pytania: „the artifacts only support one reading here; flag if your read differs”.

**5d. Wyprowadź obszary inwestycji (bez pytania).**

Po otrzymaniu 2–3 odpowiedzi kotwiczących wyprowadź obszary inwestycji z: (1) wybranego `main_goal`, (2) NFR PRD warunkujących uruchomienie w warstwie, (3) luk stanu bazowego zmapowanych do FR must-have, (4) koncentracji Open Questions. Ogłoś wyprowadzone inwestycje w podsumowaniu syntezy (5e). Użytkownik może je nadpisać jedną linią; nie jest proszony o wybór.

**5e. Podsumowanie syntezy — potwierdź bez pytania.**

Wyemituj pojedynczą wiadomość w zwykłym markdownie, która ustala ramy. Bez nowych pytań. Odzwierciedl język użytkownika od początku do końca (polski PRD → polskie podsumowanie). Kształt:

```markdown
Locking in the roadmap framing:

- **Cel sekwencjonowania: `<main_goal>`.** <One-line rationale tying to the user's anchor answer and an artifact pointer.>
- **Gwiazda przewodnia: `<S-NN candidate> — <Outcome>`.** <One-line tying this slice to the primary Success Criterion or riskiest assumption.>
- **Główne ryzyko / blocker: `<top_blocker>`.** <One-line with the specific signal — count of Open Questions, named vendor, deadline mismatch, etc.>
- **Inwestycje: w `<layer>` głęboko; reszta lekko.** <One-line — derived from main_goal + NFR + baseline gap; not asked.>

Powiedz "go" żeby ruszyć dalej, albo nadpisz dowolną linię ("inwestycja powinna być w data, nie infra"). Nie będę pytał ponownie o to, co już ustaliliśmy.
```

Gdy użytkownik powie „go” lub pozostanie cicho po następnej granicy kroku, kontynuuj z ustalonymi ramami. Nadpisania pojedynczych linii są akceptowane i zapisywane ponownie bez ponownego pytania o pozostałe kotwice.

**5f. Wyjątek dla niestandardowego kształtu MVP.**

„Niestandardowy kształt MVP” to produkt, który nie pasuje do znanego wzorca: nie jest dashboardem SaaS, aplikacją CRUD, platformą treści, oczywistym wrapperem AI ani stroną marketingową. Sygnały: `## Vision` PRD opisuje nową interakcję lub domenę; `## User Stories` nie grupują się wokół znanej encji (create/read/update/delete a `<thing>`); `tech-stack.md` deklaruje nieoczywiste narzędzia (silniki gier, mosty sprzętowe, wyspecjalizowane środowiska uruchomieniowe, nowe kształty agentów); sformułowania użytkownika podkreślają nową mechanikę, nie znany wzorzec.

Gdy PRD wygląda na niestandardowo ukształtowany:

1. **Rozpocznij wywiad od ujawnienia tego** w wiadomości poprzedzającej pierwsze pytanie kotwiczące: *„This PRD doesn't fit a familiar MVP pattern (no SaaS dashboard / CRUD / content / AI-wrapper shape). My Recommends for the next 2-3 questions are weaker than usual — push back hard if my read is off.”*
2. **Złagodź Rekomendację dla `north_star` i każdego wyprowadzonego obszaru inwestycji.** Formułuj opis Rekomendacji jako *„My best read is X, but the artifact signal is thin”* zamiast *„PRD §Vision says X”*.
3. **Zezwól na maksymalnie dwie wymiany follow-up** ponad trzy pytania kotwiczące. Niestandardowe MVP korzystają z dialogu; intuicja projektowa użytkownika wykonuje więcej pracy, niż artefakty są w stanie wykonać. Follow-upy są tekstem swobodnym, nie nowymi pytaniami strukturalnymi.

To jedyna ścieżka, w której umiejętność skłania się ku dialogowi zamiast od niego odchodzić — i jedyna ścieżka dopuszczająca follow-upy. Łączny limit w tym wyjątku: 3 kotwice + 2 follow-upy = 5 wymian; poza nim 3 pytania kotwiczące, brak follow-upów, jedno podsumowanie syntezy.

**5g. Zasady sformułowań i języka (stosuj do każdego pytania kotwiczącego i podsumowania).**

- **Odzwierciedl język użytkownika od początku do końca.** Polski PRD → polskie pytania, opcje i podsumowanie. Tłumacz nazwy sekcji (`Open Questions` → `Otwarte pytania`, `Functional Requirements` → `Wymagania funkcjonalne`, `Non-Goals` → `Poza zakresem`, `Success Criteria` → `Kryteria sukcesu`). Bez angielskich fragmentów, takich jak „north star”, „blocker”, „must-have” wewnątrz polskiego pytania lub etykiety opcji — parafrazuj („gwiazda przewodnia”, „główne ryzyko”, „konieczne”).
- **Tłumacz żargon wewnętrzny umiejętności na prosty język produktowy.** *„Privacy posture”* → *„polityka prywatności dostawcy AI”*. *„North star”* → *„pierwsza historyjka, która udowadnia, że produkt działa”*. *„Blocking unknowns”* → *„pytania bez odpowiedzi, które blokują dalsze planowanie”*. Użytkownik nigdy nie powinien potrzebować otwierać dokumentacji tej umiejętności, aby zrozumieć pytanie.
- **Cytaty w opisach opcji muszą zasłużyć na swoje miejsce.** Cytowanie typu *„tech-stack wskazuje Astro + Supabase + OpenRouter”* jest zrzutem nazw, chyba że następna klauzula mówi, dlaczego ma to znaczenie dla *tej* kotwicy. Albo włącz implikację w linię, albo usuń cytat.
- **Rekomendacja musi być możliwa do obrony, nie agresywna.** Jednowierszowa Rekomendacja opiera się na linii artefaktu, a nie na pewnym tonie. Jeśli nie potrafisz wskazać cytatu, obniż rangę — przedstaw kotwicę z dwiema alternatywami o równej wadze (i zapasową opcją swobodną), a użytkownikowi pozwól wybrać.

### Krok 6: Dekomponuj i sekwencjonuj

To krok, w którym umiejętność pokazuje swoją wartość. Zbuduj treść mapy drogowej **w pamięci** (jeszcze nie na dysku).

**6a. Zidentyfikuj Foundations.** Foundation to przekrojowy warunek wstępny, który sam w sobie nie daje wyniku widocznego dla użytkownika, lecz odblokowuje nazwane pionowe wycinki, redukuje nazwaną blokującą niewiadomą lub tworzy infrastrukturę weryfikacyjną wymaganą przez nazwany wycinek. To kontrakt umożliwiający, nie pozwolenie na poziome planowanie. Źródła:

- Decyzje `tech-stack.md`, które implikują pracę nad szkieletem (dostawca auth → szkielet auth; wybrany cel wdrożenia → szkielet wdrożenia; wybrany monitoring → stan bazowy obserwowalności).
- `## Non-Functional Requirements` PRD wymagające infrastruktury (np. NFR „p95 < 800ms” implikuje podstawową instrumentację wydajności).
- `## Access Control` PRD, jeśli jest czymś więcej niż „single user, no auth”.
- **Stan bazowy z Kroku 4** — wszystko zgłoszone jako **absent** lub **partial** jest kandydatem Foundations. Wszystko zgłoszone jako **present** jest pomijane (i odnotowane w `## Baseline`).
- **„Where to invest” z Kroku 5** — wybory „invest deeply” promują foundation do własnego jawnego wycinka (np. „data layer — invest deeply” + brak stanu bazowego → jawne foundation projektowania danych F-NN, nie tylko domyślny krok migracji).

Nie wymyślaj foundations, których PRD nie implikuje (żadnego „set up Storybook”, jeśli nic tego nie wymusza). Nie twórz ogólnego foundation „data layer”, „API layer”, „UI layer” ani „auth system”, jeśli nie potrafisz nazwać downstream elementu `S-NN`, który odblokowuje, blokującej niewiadomej, którą redukuje, lub ścieżki weryfikacji, którą umożliwia.

**Limit zakresu Foundation.** Foundation musi być najmniejszym przekrojowym elementem umożliwiającym, który pozwala nazwanemu pionowemu wycinkowi kontynuować. Może ustanowić minimalny kontrakt, szkielet, politykę lub ścieżkę weryfikacji; NIE może ukończyć całej warstwy architektonicznej przed pracą widoczną dla użytkownika. Jeśli Outcome foundation brzmi jak „warstwa data/API/UI/auth jest ukończona”, podziel ją lub włącz minimum wymaganej pracy do pierwszego wycinka `S-NN`, który ją wykorzystuje. Test: po wdrożeniu Foundation co najmniej jeden downstream `S-NN` powinien nadal integrować i ćwiczyć tę warstwę przez rzeczywistą funkcję użytkownika.

Identyfikatory Foundation to `F-NN` (dwucyfrowe z zerem wiodącym, od `F-01`).

**6b. Zdekomponuj powierzchnię widoczną dla użytkownika na wycinki.** Przejdź przez `## User Stories` i `## Functional Requirements` PRD. Grupuj je w pionowe, kompleksowe wycinki, gdzie każdy wycinek:

- Dostarcza **pojedynczą funkcję widoczną dla użytkownika** sformułowaną jako „user can …”.
- Dotyka każdej warstwy potrzebnej, aby uczynić tę funkcję rzeczywistą (dane + logika + interfejs), od góry do dołu.
- Jest na tyle mały, że jedno wywołanie `/10x-plan` tworzy wykonalny plan, ale na tyle duży, że wycinek samodzielnie ma znaczenie (wycinek to zazwyczaj jedna US-NN, czasem dwie, gdy są ściśle powiązane — np. „create” i „list” tej samej encji).

NIE dziel poziomo („the database slice”, „the API slice”, „the UI slice”). Poziome wycinki są antywzorcem, któremu ta umiejętność ma zapobiegać. Domyślna dekompozycja jest pionowa najpierw: każdy wycinek widoczny dla użytkownika powinien tworzyć użyteczną funkcję, którą agent może zaimplementować i zweryfikować kompleksowo. Praca pozioma jest dozwolona wyłącznie jako nazwane Foundation z jawnym downstream uzasadnieniem.

Identyfikatory wycinków to `S-NN` (dwucyfrowe z zerem wiodącym, od `S-01`).

Każdy `F-NN` i `S-NN` otrzymuje też stabilne **Change ID** w kebab-case. Change ID jest pomostem do `/10x-plan` i później elementem backlogu w Jira/Linear. Preferuj zwięzłe nazwy zorientowane na wynik, takie jak `first-gated-generation`, `minimal-auth-for-generation` lub `srs-review-session`.

**Granularność i równowaga wycinków.** Wycinki mapy drogowej powinny być mniej więcej porównywalne pod względem nakładu planowania i wagi koncepcyjnej, nawet jeśli nie mają estymacji. Unikaj jednego wycinka, który pochłania większość PRD, podczas gdy późniejsze wycinki są drobnymi elementami dopracowania. Jeśli jeden kandydacki wycinek odnosi się do wielu FR must-have lub wielu niepowiązanych historyjek użytkownika, podziel go według wyników widocznych dla użytkownika, faz przepływu pracy, person lub granic ryzyka, aż każdy `S-NN` będzie czymś, o czym jedno `/10x-plan <change-id>` może spójnie rozumować.

Użyj tych wyzwalaczy podziału:

- Wycinek obejmuje więcej niż jedno główne działanie użytkownika (np. „import, edit, share, and report”).
- Wycinek łączy konfigurację, główny przepływ pracy i administrację w jednym elemencie.
- Wycinek spełnia większość FR must-have, podczas gdy inne wycinki mają po jednym drobnym FR.
- Linia Risk wycinka zawiera więcej niż jedno niezależne ryzyko.
- Wycinek potrzebuje niepowiązanych niewiadomych należących do różnych osób lub warstw.

NIE dziel według warstwy, aby naprawić rozmiar. Dziel według węższych pionowych wyników. Na przykład zastąp „complete recipe system” przez „user can save the first recipe”, „user can search saved recipes” i „user can share a recipe” — nie przez „recipe schema”, „recipe API” i „recipe UI”.

**6c. Zbuduj graf zależności.** Dla każdego wycinka i foundation zidentyfikuj Prerequisites:

- **Inne identyfikatory foundation** potrzebne wycinkowi (np. S-03 potrzebuje F-01 auth).
- **Inne identyfikatory wycinków**, których dane lub funkcje konsumuje ten wycinek (np. S-04 „rate a recipe” zależy od S-03 „see recipes”).
- **Stan zewnętrzny** (np. „a seeded ingredient table”). Konkretny, nie ogólnikowy.

Dla każdego foundation zidentyfikuj też **Unlocks**:

- jeden lub więcej downstream pionowych wycinków `S-NN`, które foundation bezpośrednio umożliwia, LUB
- jedną lub więcej blokujących Unknowns, które redukuje, LUB
- jedną lub więcej nazwanych ścieżek weryfikacji wymaganych przez downstream wycinek.

Jeśli foundation nie ma jasnych Unlocks, usuń je lub włącz pracę do pierwszego pionowego wycinka, który jej potrzebuje.

Następnie dla każdego elementu wyprowadź **Parallel with** — wycinki, których Prerequisites są podzbiorem lub rodzeństwem Prerequisites tego wycinka i które od niego nie zależą. Agenci AI mogą rozdzielić się między nimi. Jeśli dwa wycinki nie współdzielą zależności i żaden nie blokuje drugiego, są równoległe. Gdy blokadą #1 (Krok 5) jest **capacity**, bądź szczególnie hojny przy obliczaniu parallel-with — to najbardziej praktyczna dźwignia użytkownika.

**6d. Sortowanie topologiczne, z uprzedzeniem według głównego celu.** Najpierw foundations (w kolejności zależności między nimi), potem wycinki w kolejności zależności. Umieść wycinek **gwiazdy przewodniej** tak wcześnie, jak pozwalają jego Prerequisites — nie odkładaj go dla symetrycznej kolejności. Następnie rozstrzygaj remisy według głównego celu (Krok 5):

- **Market feedback** → remisy rozstrzygaj na korzyść wycinka ujawniającego najbardziej ryzykowne założenie (często integracja lub logika domenowa). Wczesne ujawnienie ryzyka jest ważniejsze niż maksymalizacja wartości demo wycinka 1.
- **Quality / craft** → Foundations sekwencjonuj chętniej; foundations obserwowalności i kontroli dostępu NIE są odkładane za wycinkami widocznymi dla użytkownika.
- **Low complexity / quick win** → remisy rozstrzygaj na korzyść najmniejszego wykonalnego wycinka; agresywne Parked.
- **Speed to launch** → najpierw ścisła ścieżka must-have; elementy nieistotne trafiają do Parked, nie są sekwencjonowane późno.
- **Learn the tech / explore** → remisy rozstrzygaj na korzyść wycinków, które najwcześniej ćwiczą nieznaną technologię; wartość uczenia się liczy się tu jako wartość użytkownika.

Jeśli `## Open Roadmap Questions` zawiera decyzję istotną dla sekwencjonowania (np. „do we ship for mobile first?”), NIE wybieraj sekwencji, która przesądza odpowiedź — pozostaw objęte wycinki ze statusem `Status: blocked`, aż pytanie zostanie rozstrzygnięte.

**6e. Zidentyfikuj blokujące niewiadome.** Dla każdego wycinka wymień:

- **Blockers** (zewnętrzne, oczekujące) — zgoda dostawcy, zasób projektowy, decyzja interesariusza. Jeśli brak, wpisz `—`. Odpowiedź „External” jako blokada #1 z Kroku 5 zasila te pola.
- **Unknowns** (pytania do zbadania) — rzeczy, na które mapa drogowa nie może odpowiedzieć i których `/10x-plan` również nie powinien próbować rozwiązywać. Każda niewiadoma zawiera: pytanie, właściciela, status blokowania (yes/no — czy planowanie jest zablokowane do czasu rozwiązania?). Odpowiedź „Decisions” jako blokada #1 z Kroku 5 zasila te pola.

Wycinek ze statusem `Status: blocked` istnieje, gdy co najmniej jedna Unknown ma `Block: yes`. Zadaniem mapy drogowej jest ujawnić je, aby użytkownik mógł je rozwiązać, zanim `/10x-plan` zostanie zmarnowany na wycinek, którego nie można zaplanować.

**6f. Wygeneruj `## Open Roadmap Questions`.** Dwa źródła:

- `## Open Questions` PRD — skopiuj dosłownie, ponumeruj ponownie, jeśli trzeba. Te pytania nadal są otwarte.
- Nowe pytania ujawnione w Kroku 5, które obejmują wiele wycinków („should we actually ship for mobile?”).

Niewiadome per-wycinek pozostają w wycinku; przekrojowe trafiają tutaj.

**6g. Wygeneruj `## Parked`.** Podnieś `## Non-Goals` PRD. Dodaj także wszystko, co Krok 5 ujawnił jako odroczone — szczególnie gdy głównym celem jest **speed to launch** lub blokadą #1 jest **time/capacity**, ta sekcja rośnie. Każdy wpis: jednolinijkowy element, jednolinijkowe uzasadnienie.

**6h. Wyprowadź `## Streams` (pomoc nawigacyjna).** Strumienie są *wyprowadzonym widokiem* grafu zależności — NIE zastępują kolejności topologicznej w `## Foundations` + `## Slices` i nie wprowadzają nowych ID. Ich zadanie: dać czytelnikowi proponowaną kolejność czytania przez równoległe ścieżki na jednym ekranie. Wyprowadzenie: jeden strumień na foundation, które kotwiczy odrębny łańcuch Prerequisites (`F-NN` → wycinki wymieniające je w Prerequisites, w kolejności zależności); wycinek bez prerequisite foundation jest własnym jednoelementowym strumieniem (nigdy koszem „Misc”); wycinek zależny od głów wielu strumieni dołącza do najbardziej pochodnego, a połączenie jest nazwane w notatce tego strumienia („joins Stream A at S-01”) — nigdy nie jest duplikowany między strumieniami. Wygeneruj jeden wiersz tabeli markdown na strumień — `Stream | Theme | Chain | Note` — Chain łączy istniejące Roadmap IDs za pomocą `→`, Theme jest opisowy, nie promocyjny („Review loop”, nie „The killer feature”), Note to jedna klauzula wiążąca strumień z `main_goal` lub nazywająca połączenie. Limit: 2–5 strumieni — więcej oznacza, że graf jest nadmiernie podzielony (złóż jednoelementowe strumienie do strumienia sąsiedniego foundation); mniej niż 2 oznacza, że kolejność topologiczna już czyta się czysto, więc pomiń sekcję. Strumienie NIE są kanoniczne: przy każdym konflikcie wygrywa kolejność topologiczna, a definicja strumienia jest błędna.

### Krok 7: Wygeneruj treść mapy drogowej

Użyj tego dokładnego szablonu (nazwy sekcji są kontraktem; narzędzia downstream i `/10x-plan` mogą ich szukać przez grep):

````markdown
---
project: <from PRD frontmatter>
version: 1
status: draft                    # draft | active | locked
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
prd_version: <int from PRD frontmatter, or `—` for non-PRD sources>
main_goal: <market-feedback | quality | low-complexity | speed | learn | other>
top_blocker: <skills | capacity | time | decisions | external | motivation | none>
milestone_id: <kebab-case, outcome-oriented — e.g. first-usable-deck>
milestone_seq: <int, 1 for the first milestone>
milestone_status: open           # open | done
---

# Roadmap: <Project>

> Derived from <source materials> + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-<seq>: <Milestone name>** — Status: open

- **Intent:** <1-2 sentences: the outcome this milestone proves or delivers — outcome-scoped, no dates>.
- **Source materials:** <`context/foundation/prd.md` (v<N>) | listed doc paths | "user description (anchors below)">
- **Done when:** every F-NN and S-NN below is `done`<, plus any explicit acceptance line the user gave>.
- **Scope anchors:** <PRD IDs this milestone draws from (FR-NNN, US-NN ranges) — or, for description-sourced milestones, numbered `MS-NN` items distilled verbatim from the user's description:>
  - MS-01: <one scope statement>
  - MS-02: <…>
  (Omit the MS list entirely when the source is a PRD or other document.)

## Vision recap

<2-3 sentences lifted from PRD's Vision & Problem Statement. NOT a re-statement —
just enough that a reader can orient without opening prd.md.

If the recap leans on a product-strategy term — most commonly "wedge", but also
"beachhead", "primary metric", "validation milestone", "north star" — define it
inline on first use, in one short sentence in plain language. Example:
"The product wedge — the one trait that, if removed, makes the product
indistinguishable from a generic AI tool — is that cards must be both
AI-grounded in the learner's own pasted text and human-gated before they
land in the deck." A reader who has not taken a product-strategy course must
be able to read the section cold.>

## North star

**<Slice ID>: <Outcome>** — <one sentence on why this is the validation milestone, tied to main_goal>.

> A reader-facing one-liner explaining what "north star" means here: the smallest
> end-to-end slice whose successful delivery would prove the core product hypothesis
> — placed as early as Prerequisites allow because everything else only matters
> if this works. Include this gloss the FIRST time "north star" appears in the
> document body; do not repeat it later.

## At a glance

| ID    | Change ID              | Outcome (user can …)              | Prerequisites    | PRD refs       | Status   |
| ----- | ---------------------- | --------------------------------- | ---------------- | -------------- | -------- |
| F-01  | <kebab-case-change-id> | (foundation) <foundation outcome> | —                | NFR-XX         | proposed |
| F-02  | <kebab-case-change-id> | (foundation) <foundation outcome> | F-01             | NFR-YY         | proposed |
| S-01  | <kebab-case-change-id> | <user-can outcome>                | F-01             | US-01, FR-001  | ready    |
| S-02  | <kebab-case-change-id> | <user-can outcome>                | S-01             | US-02, FR-003  | proposed |
| S-03  | <kebab-case-change-id> | <user-can outcome>                | S-01, F-02       | US-03, FR-005  | blocked  |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                          | Note                                                      |
| ------ | ------------------ | ------------------------------ | --------------------------------------------------------- |
| A      | <Theme>            | `F-01` → `S-01` → `S-02`       | <One-line rationale tying the stream to main_goal.>       |
| B      | <Theme>            | `F-02` → `S-03`                | <Joins Stream A at `S-NN` if applicable, else standalone.> |
| C      | <Theme>            | `S-NN`                         | <Standalone slice with no foundation prerequisite.>       |

(2–5 streams; every `F-NN` and `S-NN` appears in exactly one stream. Omit this section entirely if the dep graph is too small for streams to add value — see Step 6h.)

## Baseline

What's already in place in the codebase as of `<YYYY-MM-DD>` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** <present | absent | partial> — <one line, file pointer if present>
- **Backend / API:** <…>
- **Data:** <…>
- **Auth:** <…>
- **Deploy / infra:** <…>
- **Observability:** <…>

## Foundations

### F-01: <Foundation title>

- **Outcome:** (foundation) <one sentence on what's now in place — not user-visible>.
- **Change ID:** <kebab-case-change-id>
- **PRD refs:** <NFR-NN, Access Control section, etc. — be specific>
- **Unlocks:** <downstream S-NN IDs, blocking unknown IDs/questions, or named verification paths>
- **Prerequisites:** <slice/foundation IDs and external state — or `—`>
- **Parallel with:** <IDs that can run alongside, or `—`>
- **Blockers:** <external pending, or `—`>
- **Unknowns:** <questions, or `—`>
- **Risk:** <one line: why sequenced here, what could go wrong>
- **Status:** proposed | ready | blocked

(Repeat for each F-NN.)

## Slices

### S-01: <Slice title>

- **Outcome:** <user can …>
- **Change ID:** <kebab-case-change-id>
- **PRD refs:** <FR-NNN, US-NN, NFR-N — every must-have FR this slice satisfies, every US-NN it advances>
- **Prerequisites:** <slice/foundation IDs and external state>
- **Parallel with:** <IDs, or `—`>
- **Blockers:** <external pending, or `—`>
- **Unknowns:**
  - <question> — Owner: <user|team|TBD>. Block: <yes|no>.
  - (or `—` if none)
- **Risk:** <one line>
- **Status:** proposed | ready | blocked

(Repeat for each S-NN, in dependency order.)

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title         | Ready for `/10x-plan` | Notes |
| ---------- | ---------------------- | ----------------------------- | --------------------- | ----- |
| F-01       | <kebab-case-change-id> | <issue title for Jira/Linear> | no                    | <why or `—`> |
| S-01       | <kebab-case-change-id> | <issue title for Jira/Linear> | yes                   | Run `/10x-plan <change-id>` |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

1. **<Question>** — Owner: <who>. Block: <which slice IDs this gates, or `roadmap-wide`>.
2. ...

(Each entry mirrors PRD's `## Open Questions` shape. Per-slice unknowns stay in the slice.)

## Parked

- **<Item>** — Why parked: <PRD §Non-Goals reference, or rationale from interview>.
- ...

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone. Closure entries are written by this skill's `READY_TO_CLOSE → CLOSED` transition. Format:)

- **M-<seq>: <Milestone name>** (`<milestone_id>`) — closed <YYYY-MM-DD>. <One-line outcome.>

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate. Format:)

- **<Slice ID>: <Outcome>** — Archived <YYYY-MM-DD> → `context/archive/<YYYY-MM-DD-change-id>/`. Lesson: <pointer to lessons.md if any, or `—`>.
````

**Semantyka pól, szczegółowo:**

- **Outcome** jest sterowane czasownikiem. Wycinki: *„user can sign in and see an empty fridge”*. Foundations: *„(foundation) auth scaffold landed; tokens issued via configured provider”*. Nigdy fraza rzeczownikowa („authentication system”); zawsze deklaracja stanu świata.
- **Change ID** jest w kebab-case, stabilne i odpowiednie dla `context/changes/<change-id>/`. Nie używaj `F-01` / `S-01` jako change id; są to lokalne identyfikatory kolejności mapy drogowej.
- **Unlocks** występuje tylko w Foundations. Nazywa downstream powód istnienia tego Foundation: konkretne wycinki `S-NN`, blokujące niewiadome lub ścieżki weryfikacji. Foundation bez Unlocks to poziomy dryf.
- **PRD refs** używa dosłownych ID z PRD (`FR-001`, `US-01`, `NFR-02`). Nie parafrazuj. Każdy FR must-have w PRD musi pojawić się w co najmniej jednym PRD refs wycinka po samoprzeglądzie Kroku 8.
- **Prerequisites** łączy ID wycinków (`S-01`, `F-02`) i stan zewnętrzny, rozdzielone przecinkami. Stan zewnętrzny jest po angielsku prostym tekstem („seeded ingredient table”, „design tokens published”). Jedno pole, nie podzielone.
- **Parallel with** ma charakter informacyjny. Jest obliczane z grafu zależności: dowolny wycinek X, gdzie moje Prerequisites i Prerequisites X nie mają ścieżki między sobą. Puste = `—`.
- **Blockers** to wyłącznie *zewnętrzne oczekujące* elementy (dostawca, projekt, decyzja interesariusza). Rzeczy, których zespół nie może jednostronnie rozwiązać. Jeśli zespół MOŻE to rozwiązać, jest to Unknown, nie Blocker.
- **Unknowns** to pytania do zbadania. Każde zawiera Owner i flagę Block. Block=yes podnosi Status wycinka do `blocked`.
- **Risk** to jedna linia: dlaczego sekwencjonowane tutaj, co może pójść źle, dlaczego jest to bezpieczniejsza kolejność niż alternatywy. Nie retrospekcja. Nie katastrofizacja. Tylko nośny powód, którego przyszły czytelnik potrzebuje, aby zrozumieć sekwencję.
- **Status** cykl życia: `proposed` (domyślnie przy pierwszym generowaniu) | `ready` (wszystkie Prerequisites spełnione, brak blokujących niewiadomych — można uruchomić `/10x-plan`) | `planning` | `in-progress` | `done` | `blocked` (jedna lub więcej niewiadomych z `Block: yes`). Ta umiejętność generuje tylko `proposed`, `ready` i `blocked`; reszta jest zapisywana downstream (zobacz „Relacja z innymi umiejętnościami”), best-effort i wyłącznie do przodu.
- **Frontmatter `main_goal` / `top_blocker`** zapisują odpowiedzi z Kroku 5, aby przyszły odczyt (lub recenzent) mógł od razu zobaczyć uprzedzenie sekwencjonowania bez otwierania historii rozmowy.

**Twarda reguła — nigdy nie wymyślaj wycinków.** Każdy wycinek musi śledzić ID kotwicy źródłowej (zabezpieczenie 1). Jeśli wywiad ujawnił coś, czego źródła nie deklarują („oh and we also need offline mode”), NIE staje się to wycinkiem — staje się Open Roadmap Question (rzeczywista luka) lub wpisem Parked (jawnie odroczonym). Mapa drogowa sekwencjonuje to, co deklarują źródła; nie rozbudowuje ich.

**Bez jednostek czasu. Bez estymacji. Bez wyników złożoności.** (Zabezpieczenie 5.) Kolejność jest zakodowana w Prerequisites; tempo w Blockers i Unknowns. Chęć napisania „this should take a few hours” oznacza, że wszedłeś na terytorium `/10x-plan` — zatrzymaj się.

### Krok 8: Samoprzegląd

Przed jakimkolwiek zapisem na dysk zweryfikuj mapę drogową w pamięci:

1. **Frontmatter** — obecne wszystkie 11 kluczy (`project`, `version`, `status`, `created`, `updated`, `prd_version`, `main_goal`, `top_blocker`, `milestone_id`, `milestone_seq`, `milestone_status`).
2. **Wymagane sekcje** — te nagłówki `##` istnieją, w tej kolejności: `Milestone`, `Vision recap`, `North star`, `At a glance`, `Streams` (opcjonalne — obecne wtedy i tylko wtedy, gdy Krok 6h zdecydował, że strumienie dodają wartość), `Baseline`, `Foundations`, `Slices`, `Backlog Handoff`, `Open Roadmap Questions`, `Parked`, `Milestone History`, `Done`. Z `Streams` liczba wynosi 13; bez niego 12.
3. **Schemat per-wpis** — każdy S-NN ma 9 obowiązkowych pól (`Outcome`, `Change ID`, `PRD refs`, `Prerequisites`, `Parallel with`, `Blockers`, `Unknowns`, `Risk`, `Status`). Każdy F-NN ma te pola plus `Unlocks`.
4. **Pokrycie PRD** — każdy FR `must-have` PRD (grep `^- FR-\d{3}: .* must-have$`) pojawia się w `PRD refs` co najmniej jednego wycinka. To samo dotyczy każdego `### US-NN:`. Jeśli must-have nie jest pokryty, samoprzegląd KOŃCZY SIĘ NIEPOWODZENIEM.
5. **Integralność grafu zależności** — brak cykli. Każde ID wymienione w `Prerequisites` istnieje gdzieś w dokumencie. Kolejność w `## Foundations` i `## Slices` jest sortowaniem topologicznym: żaden wycinek nie zależy od czegoś, co występuje po nim.
6. **Zgodność tabeli at-a-glance** — wiersze tabeli pasują do treści sekcji. `Change ID`, `Prerequisites`, `PRD refs`, `Status` każdego wiersza odpowiadają polom treści dosłownie.
7. **Spójność statusów** — każdy wycinek `blocked` ma co najmniej jedną Unknown z `Block: yes`. Każdy wycinek `ready` ma wszystkie Prerequisites już w stanie `done` (obecnie oznacza to: brak Prerequisites LUB Prerequisites to wszystkie foundations, które stan bazowy zgłasza jako `present`).
8. **Brak wymyślonych wycinków** — `PRD refs` każdego wycinka zawiera co najmniej jedno rzeczywiste ID kotwicy źródłowej: ID PRD (`FR-\d{3}` lub `US-\d{2}`) dla kamieni milowych pochodzących z PRD albo kotwicę karty `MS-\d{2}` dla pochodzących z opisu. Źródła mieszane mogą mieszać rodzaje ID, ale każda kotwica musi istnieć w dokumencie źródłowym lub karcie `## Milestone`.
9. **Spójność Baseline ↔ Foundations** — żadne Foundation nie buduje ponownie szkieletu warstwy, którą sekcja `## Baseline` zgłasza jako `present`. Jeśli stan bazowy mówi, że auth jest obecne, a nadal istnieje `F-NN` dla szkieletu auth, jest to porażka samoprzeglądu (albo stan bazowy jest błędny, albo foundation jest nadmiarowe).
10. **Kontrakt umożliwiający Foundation** — każde Foundation ma `Unlocks` wypełnione co najmniej jednym downstream `S-NN`, nazwaną blokującą niewiadomą lub nazwaną ścieżką weryfikacji. Ogólne foundation, takie jak „database layer”, bez powodu downstream jest porażką samoprzeglądu.
11. **Integralność Change ID** — każdy F-NN i S-NN ma unikalne Change ID w kebab-case; każdy F-NN i S-NN pojawia się dokładnie raz w `## Backlog Handoff`; każdy wiersz przekazania odwołuje się do istniejącego roadmap ID i powtarza to samo Change ID. Brak spacji, dat, etykiet statusu ani roadmap IDs jako change IDs.
12. **Równowaga granularności wycinków** — żaden `S-NN` nie może absorbować większości nietrywialnego PRD, podczas gdy rodzeństwo jest wąskim resztkowym elementem. Jeśli jeden wycinek odnosi się do większości FR must-have, więcej niż dwóch niepowiązanych wpisów US-NN, wielu głównych działań użytkownika lub niepowiązanych ryzyk/niewiadomych, samoprzegląd KOŃCZY SIĘ NIEPOWODZENIEM, chyba że PRD naprawdę ma tylko jeden przepływ pracy widoczny dla użytkownika. Napraw przez podział na węższe pionowe wyniki, nie przez tworzenie wycinków warstwowych.
13. **Limit zakresu Foundation** — żadne Foundation nie może ukończyć całej warstwy z wyprzedzeniem. Outcome i Risk muszą pokazywać minimalny kontrakt umożliwiający, a `Unlocks` musi nazywać pionowe wycinki, które nadal zintegrują tę warstwę przez zachowanie widoczne dla użytkownika. Jeśli Foundation brzmi jak „build the data/API/UI/auth layer”, samoprzegląd KOŃCZY SIĘ NIEPOWODZENIEM. Podziel je, zawęź lub włącz minimum wymaganej pracy do pierwszego konsumującego `S-NN`.
14. **Progresywne ujawnianie elementów technicznych** — każdy przekrojowy element techniczny pojawia się albo w pierwszym pionowym wycinku, który go potrzebuje, albo w Foundation wymaganym przed tym wycinkiem, aby można było go zaplanować, zweryfikować lub uczynić bezpiecznym. Jeśli element techniczny został wprowadzony tylko dlatego, że przyda się później, samoprzegląd KOŃCZY SIĘ NIEPOWODZENIEM, a praca przenosi się do pierwszego wycinka, który faktycznie go używa.
15. **Pokrycie Streams** (tylko jeśli wygenerowano sekcję `## Streams`) — każdy `F-NN` i każdy `S-NN` wymieniony w `## At a glance` pojawia się dokładnie w jednej komórce `Chain` strumienia. Duplikaty i pominięcia powodują niepowodzenie. Komórki Chain odwołują się wyłącznie do istniejących Roadmap IDs (bez wymyślonych ID). Liczba strumieni wynosi 2–5. Jeśli dokument ma < 2 kandydackie strumienie, sekcja powinna zostać pominięta (limit Kroku 6h).
16. **Integralność kamienia milowego** — `milestone_status` jest `open` przy generowaniu; `milestone_seq` jest o 1 większy niż najwyższe zamknięte `M-<seq>` w `## Milestone History` (1, gdy historia jest pusta); `M-<seq>` karty `## Milestone` pasuje do `milestone_seq`; każda kotwica `MS-NN`, do której odwołuje się dowolny wycinek, istnieje w karcie; `## Milestone History` zostało przeniesione dosłownie (nigdy nie edytowane, nigdy nie skrócone) przy regenerowaniu i otwieraniu kolejnego kamienia milowego.
17. **Terminy strategiczne są zdefiniowane inline** — przeskanuj wygenerowaną treść pod kątem listy żargonu z zabezpieczenia 13; każdy wymieniony termin, który występuje, musi mieć swoją jednolinijkową definicję przy **pierwszym** wystąpieniu (identyfikatory w stylu `FR-001`/`S-02` oraz nazwy własne narzędzi/usług są zwolnione). Niezdefiniowane pierwsze użycie powoduje NIEPOWODZENIE; termin, którego nie można zdefiniować w jednym zdaniu, zostaje zastąpiony prostym językiem i wygenerowany ponownie.

Jeśli którykolwiek test zawiedzie, **przerwij zapis** i zgłoś konkretną porażkę:

```
Roadmap self-review FAILED:

  - <specific failure, e.g., "FR-007 (must-have) is not covered by any slice"
     or "Slice S-04 lists S-06 in Prerequisites, but S-06 comes later in the doc"
     or "F-02 (auth scaffold) is redundant — Baseline reports auth as present">
  - ...

The roadmap was NOT written. Fix the failure and regenerate, or — if a check is
wrong — file a skill bug. Self-review aborts protect downstream tooling from
drift.
```

Następnie ZATRZYMAJ.

### Krok 9: Sprawdzenie kolizji

```bash
test -f context/foundation/roadmap.md
```

Jeśli plik nie istnieje, zapisz do `context/foundation/roadmap.md` i przejdź do Kroku 10.

Jeśli plik istnieje, konwencja dokumentów foundation to **edycja w miejscu** dla przyrostowego dopracowania, **archiwizacja, a potem zastąpienie** dla pełnego regenerowania. Ta umiejętność tworzy *pełną* mapę drogową z PRD; chirurgiczne dopracowanie jest poza zakresem. Dlatego domyślnie archiwizuj, a potem zastępuj, lecz zapytaj za pomocą wybranego narzędzia interaktywnych pytań:

Pytanie interaktywne:
- question: "context/foundation/roadmap.md już istnieje. Jak chcesz kontynuować?"
  header: "Kolizja"
  options:
  - label: "Zarchiwizuj i zastąp (Recommended)"
    description: "Przenieś istniejący plik do context/foundation/archive/<today>-roadmap.md, a następnie zapisz nową mapę drogową. Historia zachowana zgodnie z konwencją foundation README."
  - label: "Nadpisz bez archiwizacji"
    description: "Zastąp w miejscu. Istniejąca treść zostanie utracona (chyba że została zatwierdzona w repozytorium). Używaj tylko, gdy istniejąca mapa drogowa jest pusta lub robocza."
  - label: "Cancel"
    description: "Zakończ bez zapisu. Bez rozstrzygania kolizji."
  multiSelect: false

Po „Zarchiwizuj i zastąp”: utwórz `context/foundation/archive/`, jeśli nie istnieje, przenieś istniejący plik do `context/foundation/archive/<today>-roadmap-<milestone_id>.md` (dzisiejsza data w `YYYY-MM-DD`; pomiń sufiks `-<milestone_id>` dla starszych plików bez niego), a następnie zapisz nową treść. Jeśli plik już istnieje pod tą ścieżką archiwum (zregenerowano dwa razy jednego dnia), dodaj `-2`, `-3` itd.

Po „Nadpisz bez archiwizacji”: zapisz nową treść, nadpisując w miejscu.

Po „Cancel”: ZATRZYMAJ.

### Krok 10: Przekaż dalej

Po zapisaniu podsumuj:

```
═══════════════════════════════════════════════════════════
  ROADMAP GENERATED
═══════════════════════════════════════════════════════════

  Project:           <project>
  Milestone:         M-<seq>: <name>  (<milestone_id>)  —  open
  Path:              context/foundation/roadmap.md
  Main goal:         <main_goal>            (sequencing bias)
  #1 blocker:        <top_blocker>          (what to plan around)
  Baseline present:  <comma-separated layers reported present>
  Foundations:       <count>
  Slices:            <count>
  Status breakdown:  ready: N  |  proposed: M  |  blocked: K
  PRD coverage:      <covered must-have FRs> / <total must-have FRs>
  Open Roadmap Q:    <count>
  Parked items:      <count>

  North star:  <Slice ID> — <Outcome>

═══════════════════════════════════════════════════════════
```

Następnie **zarekomenduj pojedynczy kolejny ruch** — nie oddawaj listy „ready” i nie proś użytkownika o wybór. Wybierz jeden element mapy drogowej do zaplanowania jako pierwszy i uzasadnij go w jednej linii. Użytkownik może nadpisać wybór, ale domyślną powierzchnią jest rekomendacja, nie menu.

**Reguła wyboru rekomendowanego kolejnego ruchu** (stosuj w kolejności, wygrywa pierwsze dopasowanie):

1. Jeśli gwiazda przewodnia jest `ready`, zarekomenduj ją. Gwiazda przewodnia jest kamieniem milowym walidacji; odłożenie jej traci sygnał.
2. W przeciwnym razie, jeśli Foundation, od którego gwiazda przewodnia bezpośrednio zależy, jest `ready`, zarekomenduj to Foundation i wyraźnie powiedz „this unlocks the north star <S-NN>”.
3. W przeciwnym razie, jeśli żaden wycinek nie jest `ready`, zarekomenduj rozwiązanie pytania Open Question lub Blocker o najwyższej dźwigni (tego, które odblokowuje najwięcej elementów downstream). Do tego czasu nie ma dostępnego ruchu planowania.
4. W przeciwnym razie zarekomenduj wycinek `ready`, który odblokowuje najwięcej elementów downstream (najwyższy fan-out w grafie zależności). Rozstrzygaj remisy według głównego celu (Krok 6d).

Format:

```
► **Your next move:** `/10x-plan <change-id>` on **<Roadmap ID>: <Outcome>**.

  Why this one first: <one sentence — load-bearing reason: it IS the north
  star / it unblocks the north star / it has the highest fan-out / it's the
  smallest end-to-end validation we can ship now>.

  After that, in order: <next ready ID>: <Outcome> → <next>: <Outcome>.
  (Full list in `## Backlog Handoff`.)

  Blocked — stay parked until their Unknowns resolve:
    - <Slice ID>: <Unknown> (Owner: <who>)
    - ...
  (Resolving any of these promotes its slice to `ready` and changes my
  recommendation; come back and I'll re-recommend.)
```

Jeśli żaden wycinek nie jest `ready` i żadne Foundation również nie jest `ready` (przypadek 3), zastąp rekomendację przez:

```
► **No planning move is available yet.** Every slice is blocked.
  Highest-leverage unknown to resolve next:

    <Question> — Owner: <who>. Unblocks: <S-NN, S-MM, ...>.

  Resolving this promotes <count> slices and is the single change that
  most opens the roadmap. Resolve it, then re-invoke `/10x-roadmap` to
  re-recommend.
```

ZATRZYMAJ. Nie przechodź automatycznie do innej umiejętności — użytkownik wybiera, kiedy planować. Ale NIE degraduj rekomendacji do listy wielokrotnego wyboru; jeśli użytkownik chce inny wycinek, powie to.

## Krytyczne zabezpieczenia

1. **Materiały źródłowe są źródłem.** Każdy wycinek śledzi ID kotwicy źródłowej — ID PRD (`FR-NNN`/`US-NN`) dla kamieni milowych pochodzących z PRD, kotwice karty `MS-NN` dla pochodzących z opisu użytkownika. Ramowanie z Kroku 5 ujawnia kontekst celu/gwiazdy przewodniej/inwestycji/blokady wywnioskowany ze źródeł; stan bazowy ujawnia to, co już istnieje; żadne z nich nie rozbudowuje źródeł. Elementy mapy drogowej bez śladu źródła są porażką samoprzeglądu.

2. **Najpierw pionowe wycinki.** Wycinek dostarcza kompleksowo funkcję widoczną dla użytkownika. Poziome wycinki („the API layer”, „the schema”) są antywzorcem, któremu ta umiejętność ma zapobiegać. Foundations są *jedynym* wyjątkiem — są jawnie przekrojowymi elementami umożliwiającymi, znajdują się we własnej sekcji, zawierają `Unlocks` i są oznaczone `(foundation)`, aby żaden czytelnik nie pomylił ich z pracą widoczną dla użytkownika.

3. **Zrównoważona granularność bez estymacji.** Wycinki nie otrzymują etykiet rozmiaru, ale ich zakres nadal musi być porównywalny. Mapa drogowa, w której `S-01` zawiera niemal całe PRD, a `S-02`/`S-03` są drobnymi resztkami, jest złą mapą drogową. Dziel zbyt duże elementy według węższych wyników widocznych dla użytkownika, faz przepływu pracy, person lub granic ryzyka — nigdy według warstwy technicznej.

4. **Foundations są minimalnymi odblokowaniami, nie projektami ukończenia warstw.** Foundation może stworzyć najmniejszy warunek wstępny potrzebny, zanim pionowa praca będzie mogła ruszyć. Nie może budować wcześniej całej warstwy database/API/UI/auth. Jeśli element techniczny może zostać wprowadzony wewnątrz pierwszego wycinka widocznego dla użytkownika, który go potrzebuje, umieść go tam; utrzymuje to integrację pionową i progresywnie ujawnia wyłącznie potrzebne elementy.

5. **Bez estymacji, bez jednostek czasu.** Żadnego „Day 1”, „2 weeks”, „small/medium/large”, punktów. Wykonanie przez agentów AI jest nieliniowe, a estymacje oparte na budżecie czasu kłamią. Kolejność jest zakodowana w Prerequisites; tempo ujawnia się przez Blockers i Unknowns. Mapa drogowa opisuje kształt, nie harmonogram.

6. **Bez technicznych szczegółów niskiego poziomu.** Bez nazw frameworków (należą do `tech-stack.md`), bez ścieżek plików, definicji schematów, kodu ani wyborów bibliotek. Jeśli zauważysz, że je zapisujesz, wkroczyłeś na terytorium `/10x-plan` — zatrzymaj się i pozwól `/10x-plan` wykonać jego zadanie downstream.

7. **Ujawniaj niewiadome, nie zakrywaj ich.** Unknowns per-wycinek z `Block: yes` podnoszą `Status: blocked`. Przekrojowe niewiadome trafiają do `## Open Roadmap Questions`. Jeśli PRD ma TODOs, mapa drogowa dziedziczy je jako unknowns zablokowanych wycinków. Wartość mapy drogowej częściowo polega na pokazaniu użytkownikowi, czego NIE można jeszcze planować.

8. **Stan bazowy jest automatycznie badany, nie pytany.** Nie pytaj użytkownika „what's already in place?” — uruchom równoległe subagenty Explore (Krok 4) i pozwól kodowi odpowiedzieć. Następnie pytaj użytkownika wyłącznie o potwierdzenie lub poprawkę. To kontrakt, który czyni Foundations uczciwymi: foundation istnieje tylko wtedy, gdy stan bazowy mówi, że warstwa jest absent lub partial.

9. **Samoprzegląd przerywa przy dryfie.** Brak wymaganych sekcji, uszkodzony graf zależności, niepokryte FR must-have, wymyślone wycinki, zbyt duże wycinki, ukończenie warstwy przez Foundation, sprzeczności Baseline-vs-Foundations — wszystkie przerywają zapis z konkretnym błędem. Bez cichego łatania.

10. **Konwencja dokumentów foundation.** `roadmap.md` jest dokumentem foundation zgodnie z `context/foundation/README.md`. Domyślna obsługa kolizji to archiwizacja, a następnie zastąpienie (historia trafia do `foundation/archive/<today>-roadmap.md`); chirurgiczne dopracowanie jest poza zakresem tej umiejętności (edytuj ręcznie, jeśli tego potrzebujesz).

11. **Wyłącznie uniwersalny język.** Bez odniesień do 10xDevs / cohort / certification w jakimkolwiek wyniku widocznym dla użytkownika ani artefakcie zapisanym na dysk. Umiejętność jest ogólnym generatorem map drogowych.

12. **Nigdy nie przechodź automatycznie dalej.** Krok 10 jest ogłoszeniem, nie wywołaniem. Użytkownik wybiera, kiedy (i który) wycinek przekazać do `/10x-plan`. Automatyczne łańcuchowanie pominęłoby przegląd wygenerowanej mapy drogowej przez człowieka.

13. **Definiuj terminy strategiczne inline przy pierwszym użyciu.** Słownictwo strategii produktu — `wedge`, `beachhead`, `north star`, `validation milestone`, `primary metric`, `must-have path`, `product-market fit`, `thin end of the wedge`, `riskiest assumption`, `core hypothesis` — jest skrótem wewnętrznym umiejętności i PRD, nie wiedzą powszechną; mapa drogowa musi być czytelna od zera dla współpracownika (lub przyszłego ciebie), który nie ukończył kursu strategii produktu. Przy PIERWSZYM wystąpieniu dowolnego takiego terminu w treści dokumentu dołącz jednolinijkową definicję inline (w nawiasie, jako objaśnienie po pauzie lub krótkie następujące zdanie); nie powtarzaj jej później. Jeśli pojęcia nie da się zdefiniować jednym zdaniem, zastąp je prostym językiem („the smallest end-to-end flow that proves the product works” jest lepsze niż „the wedge”, którego nie potrafisz skompresować do jednej klauzuli). Dotyczy prozy widocznej dla użytkownika w wygenerowanym dokumencie — nie pytań wywiadu (5g je obejmuje) ani semantyki pól tego pliku. Kontrola samoprzeglądu #17 to wymusza.

14. **Zwięzły wywiad z mocnymi Rekomendacjami — nie ciche automatyczne ramowanie, nie nieograniczone odkrywanie.** Reguły Kroku 5 są normatywne: maksymalnie 3 pytania kotwiczące (`main_goal`, `north_star`, `top_blocker`), obszary inwestycji wyprowadzane, nie pytane, każde pytanie z jedną Rekomendacją opartą na cytowanej linii artefaktu oraz 1–2 rzeczywistymi alternatywami (chochoły zakazane), pominięcia wyłącznie wtedy, gdy artefakty dosłownie podają wartość, follow-upy tylko w ramach wyjątku niestandardowego MVP (5f). Rekomendowany kolejny ruch z Kroku 10 to ta sama zasada zastosowana do przekazania dalej: jedna rekomendacja z jednolinijkowym powodem, nie lista „ready to plan”, którą użytkownik musi triage’ować.

15. **Kamienie milowe zapętlają się, ale nigdy nie są ograniczane czasowo.** Dokładnie jeden kamień milowy jest otwarty naraz; zamyka się wyłącznie wtedy, gdy każde F-NN/S-NN jest `done` (lub użytkownik jawnie go porzuca), po czym pętla otwiera się ponownie ze świeżymi materiałami źródłowymi lub opisem użytkownika. Stan kamienia milowego jest wyprowadzany wyłącznie z `roadmap.md` — bez plików pomocniczych. Specyfikacja cyklu życia znajduje się w `references/milestone-state.md`, ładowanym WYŁĄCZNIE dla operacji na poziomie kamienia milowego (rozdzielenie Kroku 0). Umiejętności downstream pozostają ślepe na kamienie milowe; ta umiejętność wykrywa ukończenie kamienia milowego przy kolejnym wywołaniu.

## Uwagi

- Ta umiejętność to **generator dokumentu plus tracker kamieni milowych**. Wynikiem jest `context/foundation/roadmap.md`, kropka. Planowanie pojedynczych zmian znajduje się downstream w `/10x-plan`.
- Sonda stanu bazowego (Krok 4) zastępuje dawne pytanie „what's already in place?”. Subagenci są tańsi niż uwaga użytkownika, a kod jest bardziej niezawodny niż pamięć.
- Gdy umiejętność regeneruje istniejącą mapę drogową, zarchiwizowana poprzednia wersja jest najczystszym celem diff do zobaczenia, jak zmieniło się rozumienie projektu — to udogodnienie, do którego zaprojektowano konwencję dokumentów foundation.