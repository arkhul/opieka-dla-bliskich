---
name: 10x-test-plan
description: >
  Stateful, phased test-rollout orchestrator for existing products. Writes
  context/foundation/test-plan.md, then drives each rollout phase through
  /10x-new → /10x-research → /10x-plan → /10x-implement; re-running resumes
  from the next pending phase. Trigger phrases: "create test plan", "test
  strategy", "phased test rollout", "QA spec", "stwórz plan testów",
  "strategia jakości". Use AFTER /10x-prd and /10x-roadmap. Brownfield only.
argument-hint: "[path ...] | --status | --refresh"
---
# Plan testów 10x — Stanowy orkiestrator wdrażania etapowego

Ta umiejętność zapisuje i zarządza `context/foundation/test-plan.md` jako **strategią etapowego wdrożenia**, a następnie uruchamia po jednym etapie wdrożenia w łańcuchu 10x: zmiana/badanie/plan/implementacja. Przewodnik zaczyna jako *plan* etapów — każdy etap ostatecznie otwiera własny folder `context/changes/<change-id>/` i wypełnia sekcje cookbooka (§6) w miarę wdrażania. Umiejętność jest **stanowa**: każde wywołanie ponownie wyprowadza bieżący stan, sprawdzając, które artefakty istnieją, i wznawia od następnego oczekującego etapu wdrożenia. Nie wymusza powrotu do `/10x-test-plan` po każdym dalszym etapie. Po otwarciu zmiany wdrożeniowej obowiązuje ustalony proces badanie → plan → implementacja: po każdej głównej fazie sugeruj następne naturalne polecenie, chyba że istnieje wyraźna blokada, korekta lub decyzja należąca z powrotem do `/10x-test-plan`.

`$ARGUMENTS`:

- **puste** → wyprowadź stan i działaj w kolejnym oczekującym kroku.
- **jedna lub więcej ścieżek** → źródła kontekstu dla Fazy 1 (PRD, notatki dotyczące zakresu, briefy). Usuń wiodący `@`, jeśli występuje.
- **`--status`** → wypisz status wdrożenia (gdzie jesteśmy, co dalej) bez wykonywania pracy.
- **`--refresh`** → otwórz nową zmianę `test-plan-refresh-<YYYY-MM-DD>`, aby zaktualizować istniejący przewodnik; nie edytuje przewodnika w miejscu.

## Maszyna stanów

Każde wywołanie uruchamia to drzewo decyzyjne. Każdy stan odpowiada temu, „jakiego pliku obecnie brakuje”:

1. **Faza 0 — Warunki wstępne + wykrywanie stanu (uruchamiana zawsze).** Sprawdź znacznik projektu, rozgałęź na flagach `--status`/`--refresh`, a następnie sprawdź, czy istnieje `context/foundation/test-plan.md`.
2. **Jeśli przewodnik NIE ISTNIEJE**, uruchom ścieżkę zapisu od początku do końca:
   - Faza 1: Odkrywanie (czytanie źródeł, skanowanie hot-spotów, profil bazy testów).
   - Faza 2: Wywiad z użytkownikiem.
   - Faza 3: Synteza krótkiego briefu początkowego.
   - Faza 4: Zapis etapowego `test-plan.md`.
   - Następnie przejdź do Fazy 5.
3. **Jeśli przewodnik ISTNIEJE** (lub został właśnie zapisany), przejdź do Fazy 5: przeczytaj przewodnik i znajdź pierwszy etap wdrożenia, którego status nie wynosi `complete` — to jest bieżący etap wdrożenia.
4. **Faza 6 — Określ podstan dla bieżącego etapu wdrożenia i przedstaw następne przekazanie**, na podstawie artefaktów istniejących na dysku:
   - brak folderu zmiany → `/10x-new`
   - tylko `change.md` → `/10x-research`
   - `+ research.md` → `/10x-plan`
   - `+ plan.md` z oczekującymi elementami Progress → `/10x-implement`
   - `+ plan.md` w pełni ukończony → oznacz etap wdrożenia jako ukończony w §3 i przejdź dalej (pętla do Fazy 5).
5. **Przekazanie** — skopiuj następne wywołanie do schowka, poinformuj użytkownika, aby wykonał `/clear` i je uruchomił, a następnie ZATRZYMAJ SIĘ.

Każde przekazanie jest punktem **STOP** dla tej umiejętności. Użytkownik wykonuje `/clear` i uruchamia zakolejkowane wywołanie. Po każdej głównej dalszej fazie ukończona faza powinna sugerować następne naturalne polecenie w procesie badanie → plan → implementacja. Uruchom ponownie `/10x-test-plan` tylko wtedy, gdy dalszy etap zgłosi korekty planu testów, etap wdrożenia zostanie ukończony i należy wybrać następny etap lub użytkownik chce `--status` / `--refresh`.

## Zasady nośne

Trzy reguły, których przestrzega każde wywołanie; wszystkie trzy trafiają do §1 artefaktu.

1. **Koszt × sygnał.** Każdy test dodawany przez wdrożenie — klasyczny lub AI-native — musi odpowiadać na jedno pytanie: *jaki jest najtańszy test dający rzeczywisty sygnał dla tego ryzyka?* Nie promuj do e2e tylko dlatego, że „wydaje się bezpieczniej”; nie nakładaj modelu wizji na deterministyczny diff, który już wykrywa regresję. Przekaż to do `/10x-plan` dla każdego etapu wdrożenia.

2. **Obawy użytkownika są dowodem.** Ryzyka, których zespół doświadczył, mają taką samą wagę jak linie PRD lub dane hot-spotów.

3. **Sygnał, nie wiedza.** Ta umiejętność czyta bazę kodu dla *sygnału* — zmian hot-spotów, profilu bazy testów, znacznika projektu, języka/frameworka. Nie czyta dla *wiedzy* — grafu wywołań, schematów, translacji błędów, tego, która linia odpowiada za awarię. Mapa ryzyk §2 cytuje dowody (linie PRD, odpowiedzi z wywiadu, katalogi hot-spotów); nigdy nie stwierdza, że plik jest „miejscem występowania awarii”. Tym punktem odniesienia jest wynik `/10x-research`, tworzony podczas każdego etapu wdrożenia. Umiejętność jest **autorem i kwestionującym specyfikacji QA**, a nie audytorem kodu.

   Konsekwencja operacyjna: gdy skan hot-spotów wskazuje `src/lib/foo/` jako główny katalog, §2 może cytować „hot-spot dir `src/lib/foo/` — 12 commits/30d” jako dowód *prawdopodobieństwa*. NIE może cytować „anchor: `src/lib/foo/bar.ts`” — graf wywołań wewnątrz tego katalogu jest niezweryfikowany, dopóki nie zostanie uruchomione badanie.

## Kiedy używać, kiedy pominąć

**Użyj, gdy** projekt ma przynajmniej PRD lub kilka zarchiwizowanych wycinków, a użytkownik zamierza inwestować w testy.

**Pomiń, gdy**:

- nie ma PRD, roadmapy ani zaimplementowanego kodu (najpierw uruchom `/10x-shape` → `/10x-prd`);
- użytkownik chce dodać **jeden** test do pojedynczego pliku — to obszar `/10x-tdd`, nie wdrożenia;
- użytkownik chce skonfigurować hooki, MCP lub CI YAML w izolacji — mogą one stać się etapami wdrożenia, ale samodzielne zadanie konfiguracyjne to inna umiejętność.

## Relacja z innymi umiejętnościami

| Umiejętność | Rola |
|--------------------|----------------------------------------------------------------------------------------|
| `/10x-shape`, `/10x-prd`, `/10x-roadmap` | Wcześniejsze. Tworzą PRD/roadmapę, którą wykorzystuje odkrywanie. |
| `/10x-stack-assess` | Wcześniejsza (brownfield). Identyfikuje istniejącą bazę testów. |
| `/10x-new` → `/10x-research` → `/10x-plan` → `/10x-implement` | Łańcuch dalszy, wywoływany raz na etap wdrożenia. `/10x-test-plan` uruchamia łańcuch; po każdej głównej fazie aktywna dalsza umiejętność sugeruje następne naturalne polecenie w ustalonym procesie badanie → plan → implementacja, chyba że wystąpi blokada. `/10x-research` jest **powierzchnią ekstrakcji wiedzy** — czyta kod, śledzi grafy wywołań i tworzy punkty odniesienia plik:linia, których ten plan celowo nie zawiera. |
| `/10x-tdd` | Równorzędna. Czyta cookbook (§6) podczas dodawania pojedynczego testu. |

---

## Faza 0 — Warunki wstępne + wykrywanie stanu (uruchamiana zawsze)

Ta faza uruchamia się przy każdym wywołaniu.

### Krok 0.1 — Wykryj znacznik projektu

Potwierdź, że to prawdziwy katalog główny projektu, znajdując manifest jego ekosystemu w sposób pasujący do repozytorium — nie ma ustalonego polecenia. Szukaj w pobliżu katalogu głównego konwencjonalnych znaczników dla danego stosu (np. `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile`, `composer.json`, `*.csproj`, `pubspec.yaml` lub odpowiedników frameworka). PRD w `context/foundation/` również liczy się jako prawidłowy punkt startowy.

Jeśli nie znaleziono znacznika projektu, wypisz:

```
No project markers found in the current directory. /10x-test-plan needs an
existing project (or at least a PRD). If you're at the idea stage, run
/10x-shape and /10x-prd first.
```

…i ZATRZYMAJ SIĘ.

### Krok 0.2 — Rozgałęź na `--status` / `--refresh`

- **`--status`**: przeczytaj przewodnik, jeśli istnieje, wypisz tabelę statusu wdrożenia (nazwa fazy → status → folder zmiany, jeśli istnieje) i ZATRZYMAJ SIĘ bez wykonywania pracy. Przydatne, gdy użytkownik nie jest pewien, gdzie skończył.
- **`--refresh`**: przejdź do ścieżki Refresh (koniec tej umiejętności). Nie modyfikuje istniejącego przewodnika w miejscu.

### Krok 0.3 — Sprawdź, czy przewodnik istnieje

```bash
test -f context/foundation/test-plan.md && echo "EXISTS" || echo "MISSING"
```

- **MISSING** → przejdź do Fazy 1 (pełne odkrywanie → zapis przewodnika).
- **EXISTS** → przejdź do Fazy 5 (odczytaj przewodnik, wyprowadź bieżący etap wdrożenia, przekaż).

To jest gałąź nośna. Wszystko dalej od niej zależy, dlatego zawsze jawnie wykonuj sprawdzenie istnienia pliku; nigdy nie wnioskuj na podstawie wcześniejszej historii rozmowy.

---

## Faza 1 — Odkrywanie (tylko gdy przewodnik nie istnieje)

Czytaj to, co istnieje; nie wymyślaj. Dla każdego wejścia zapisz ścieżkę pliku, którą faktycznie przeczytano; jeśli fakt pojawia się w krótkim briefie lub przewodniku, musi prowadzić do jednego z nich.

### Źródła do odkrycia (pomiń brakujące)

Jawne ścieżki z `$ARGUMENTS` są **zawsze czytane**, niezależnie od miejsca, w którym się znajdują. Poniższe wartości domyślne są wyszukiwane tylko wtedy, gdy nie zostały już podane przez argumenty.

| Źródło | Domyślna ścieżka | Co wyodrębnić |
|---|---|---|
| Dokumenty podobne do PRD | `context/foundation/prd.md` + ścieżki podane w argumentach | Użytkownicy, główne przepływy, non-goals, reguły biznesowe, zależności, metryka sukcesu |
| Roadmapa | `context/foundation/roadmap.md` + roadmapa podana w argumentach | Nadchodzące wycinki, co jest „następne” (zwiększa prawdopodobieństwo) |
| Zarchiwizowane wycinki | `context/archive/*/plan.md` + plany wycinków podane w argumentach | Co jest już zaimplementowane (bieżąca powierzchnia ryzyka) |
| Stos technologiczny | `context/foundation/tech-stack.md` + notatka o stosie podana w argumentach, LUB wykrycie przez manifest | Język, framework, runtime, używany już runner testów |
| Briefy / notatki dotyczące zakresu | wyłącznie podane w argumentach — brak stałej wartości domyślnej | Ograniczenia, non-goals, wskazówki ryzyka, które nigdy nie trafiły do PRD |
| Istniejące AGENTS.md / CLAUDE.md | katalog główny repo | Twarde zasady i konwencje ograniczające wybory testowe |
| Istniejąca konfiguracja testów | `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `pytest.ini`, itd. | Jaka infrastruktura testowa już istnieje |
| Narzędzia MCP sesji | lista narzędzi bieżącego hosta/sesji | MCP dokumentacji/wyszukiwania, które mogą ugruntować zalecenia zależne od stosu |

### Czytaj źródła

Najpierw przeczytaj jawne `$ARGUMENTS`, a następnie odpowiednie wartości domyślne, które nie są już objęte argumentem. Używaj odczytów równoległych lub subagentów, gdy host umożliwia to niskim kosztem, lecz utrzymuj ten sam kontrakt wyjściowy dla każdego źródła:

1. **Typ źródła** — podobne do PRD, roadmapa, tech-stack, zarchiwizowany wycinek, brief, zasady AGENTS, konfiguracja testów lub inne.
2. **2–4 fakty istotne dla ryzyka** — scenariusze awarii implikowane przez źródło.
3. **Twarde ograniczenia** — reguły „nie wolno”, blokady frameworków, wymagania zgodności.
4. **Uczciwe luki** — jeśli źródło jest puste/nie na temat/skąpe, powiedz to jawnie.

Zwróć zwięzłe notatki z cytatami `path:line`. **Nie** deleguj Fazy 3 (synteza briefu).

### Profil bazy testów (uruchamiany zawsze)

Przed rozpoczęciem wywiadu zbuduj jednozdaniową intuicję dotyczącą istniejącej bazy testów, aby Faza 2 nie zadawała pustych pytań („co wydaje się niedostatecznie przetestowane?” nie ma sensu, gdy nic nie jest testowane). Sklasyfikuj projekt do jednego z trzech koszyków.

Wykryj bazę testów w sposób pasujący do stosu faktycznie znalezionego w Fazie 1 — nie ma ustalonego polecenia. Używaj rzeczywistej konfiguracji runnera testów projektu i konwencji plików testowych (np. konfiguracji `vitest`/`jest`/`playwright` oraz `*.test.*`/`__tests__/` dla JS-TS; `pytest`/`pyproject.toml` i `test_*.py` dla Pythona; `*_test.go` dla Go; w innych przypadkach odpowiedników frameworka), a katalogi vendored/build wykluczaj. Dąż do dwóch faktów: czy istnieje konfiguracja runnera testów oraz w przybliżeniu ile rzeczywistych plików testowych istnieje i gdzie się skupiają.

Klasyfikuj:

- **`none`** — nie znaleziono konfiguracji testów ORAZ mniej niż 3 pliki testowe. Projekt faktycznie nie ma zestawu testów.
- **`sparse`** — konfiguracja istnieje, ale jest mniej niż ~15 plików testowych, albo pliki testowe skupiają się tylko w jednym obszarze, podczas gdy reszta bazy kodu jest pusta.
- **`meaningful`** — konfiguracja + rzeczywisty zestaw (~15+ plików testowych rozproszonych po bazie kodu). Projekt ma kulturę testów; nadal może mieć luki.

Zapisz werdykt (jedna linia: koszyk + krótkie uzasadnienie, np. „skonfigurowano vitest, 4 pliki testowe wszystkie w `packages/api/`”) dla §4 (Stack) przewodnika oraz dla rozgałęzienia wywiadu w Fazie 2.

### Ugruntowanie stosu wspomagane MCP (uruchamiane zawsze)

Przed zaleceniem narzędzi testowych, narzędzi AI-native, hooków, automatyzacji przeglądarki, bramek CI lub warstw testów specyficznych dla frameworka, sprawdź MCP/narzędzia dostępne w **bieżącej sesji**. Jest to krok ugruntowujący, a nie wymóg użycia każdego narzędzia.

Szukaj w szczególności narzędzi mogących ograniczyć nieaktualne lub ogólne porady dotyczące stosu:

- **MCP dokumentacji technicznej**, takich jak Context7, dokumentacja frameworka/biblioteki, dokumentacja dostawcy lub pakietu. Używaj ich najpierw dla dokładnych API, aktualnych wskazówek frameworka, konfiguracji testów zależnej od wersji oraz przestarzałych/przemianowanych poleceń.
- **MCP wyszukiwania/odkrywania**, takich jak Exa.ai. Używaj ich, gdy właściwa oficjalna strona nie jest znana, przy porównywaniu bieżącego wsparcia narzędzi lub sprawdzaniu, czy funkcja testowa/MCP jest aktualna, preview, przestarzała lub ograniczona regionalnie/przez dostawcę.
- **MCP przeglądarki/runtime**, takich jak Playwright/automatyzacja przeglądarki. Zauważ, czy są dostępne jako możliwa warstwa testu lub weryfikacji, lecz zalecaj je tylko, gdy dodają sygnał wykraczający poza tańsze testy deterministyczne.
- **MCP dostawcy/platformy**, takich jak GitHub, Linear, Cloudflare, Supabase, Vercel lub narzędzia baz danych. Zauważ możliwości tylko do odczytu, które mogą wspierać przyszłe bramki jakości, inspekcję logów, tworzenie issue lub weryfikację środowiska.

Reguła wykrywania niezależna od hosta:

1. Sprawdź dostępne nazwy/opisy narzędzi ujawnione agentowi w tej sesji. Jeśli host ma powierzchnię odkrywania narzędzi, odpytaj ją terminami takimi jak `docs`, `Context7`, `Exa`, `search`, `browser`, `Playwright`, `github`, `cloudflare`, `database` oraz nazwami wykrytego frameworka/runtime.
2. Nie wymyślaj MCP na podstawie przykładów. Jeśli Context7 lub Exa.ai nie są ujawnione w tej sesji, zapisz „not available in current session” zamiast zakładać dostęp.
3. Korzystaj z oficjalnej dokumentacji przez MCP dokumentacji, gdy jest dostępny. Używaj MCP wyszukiwania, aby znaleźć aktualną oficjalną dokumentację lub niedawne strony statusu, a następnie preferuj źródło pierwotne nad blogami.
4. Zastosuj tę samą granicę **sygnał, nie wiedza**, co w reszcie Fazy 1: dokumentacja/wyszukiwanie MCP może potwierdzić, że narzędzie jest wspierane, aktualne lub odpowiednie dla wykrytego stosu. Nie lokalizuje punktów odniesienia w kodzie dla konkretnych awarii; to pozostaje zadaniem `/10x-research`.

Zapisz krótką notatkę `Stack grounding tools` dla §4 i briefu początkowego:

```markdown
**Stack grounding tools (current session):**
- Docs: <Context7 / framework docs MCP / none> — <what was checked or why skipped>; checked: <YYYY-MM-DD>
- Search: <Exa.ai / web search MCP / none> — <what was checked or why skipped>; checked: <YYYY-MM-DD>
- Runtime/browser: <Playwright MCP / browser tool / none> — <possible use, or "not used">; checked: <YYYY-MM-DD>
- Provider/platform: <GitHub/Cloudflare/Supabase/etc. / none> — <quality-gate relevance, or "not used">; checked: <YYYY-MM-DD>
```

Jeśli nie ma użytecznych MCP, kontynuuj z lokalnymi dowodami manifestu/konfiguracji i powiedz to jawnie w §4. Brak dostępu MCP nie może blokować wdrożenia.

### Skan hot-spotów (historia git)

Uruchom skan hot-spotów historii git z ostatnich 30 dni, **ograniczony wyłącznie do głównych katalogów bazy kodu projektu**. **Częstotliwość zmian jest jednym z najsilniejszych sygnałów prawdopodobieństwa**. Skanowanie całego repozytorium zagłusza sygnał zmianami, których nikt nie tworzy ręcznie.

#### Krok 1 — Zidentyfikuj katalogi głównej bazy kodu

Znajdź katalogi zawierające ręcznie pisany kod aplikacji, w sposób pasujący do stosu znalezionego w Fazie 0 — nie ma ustalonego polecenia. Szukaj konwencjonalnych katalogów źródłowych tego ekosystemu (np. `src`/`app`/`lib` dla JS-TS, katalog pakietu dla Pythona, `cmd`/`internal`/`pkg` dla Go, członkowie workspace dla Rusta, `src`/`app` dla PHP) i uwzględniaj układy monorepo workspace. Wyklucz kod vendored, wygenerowany i wynik budowania (`node_modules`, `dist`, `build`, `.next`, `target`, `coverage`, `vendor` i podobne). Celem jest zbiór ścieżek, w których zmiany odzwierciedlają rzeczywiste tworzenie kodu, a nie szum narzędzi.

#### Krok 2 — Potwierdź zakres z użytkownikiem

> Wykryte zakresy głównej bazy kodu dla skanu hot-spotów: `<scope 1>`, `<scope 2>`, `<scope 3>`. Wykluczono dokumentację, fixtures, archive, wynik budowania. **Accept** albo wklej listę **override**.

Jeśli wykrywanie nie zwróci niczego, wróć do katalogu głównego repozytorium z domyślną listą wykluczeń i jawnie poinformuj użytkownika. Nigdy nie skanuj po cichu wszystkiego.

#### Krok 3 — Uruchom skan

Użyj potwierdzonych zakresów, aby zebrać najczęściej zmieniane ręcznie pisane pliki i katalogi z ostatnich 30 dni. Wyklucz lockfile, snapshoty, kod vendored, kod wygenerowany i wynik budowania. Dokładne polecenie zależy od hosta i stosu; wynik musi zawierać:

- użytą listę zakresów;
- najczęściej zmieniane pliki, jeśli są przydatne;
- najczęściej zmieniane katalogi, najlepiej pogrupowane wokół głębokości 2–3;
- informację, czy historia w zakresie ma wystarczający sygnał.

**Zabezpieczenie niewystarczającej historii.** Jeśli git log w zakresie zwróci mniej niż 5 commitów z ostatnich 30 dni, pomiń skan i odnotuj w punkcie kontrolnym Fazy 1: „Hot-spot scan: insufficient git history — likelihood ratings in the guide will rely on roadmap and user interview only.”

Zapisz wynik jako krótką notatkę konsumowaną przez Fazy 2, 3 i 4.

### Punkt kontrolny

Podsumuj użytkownikowi wejścia w ≤12 liniach: `path → classified-type → 1-line gist → [argument | default]`, plus 3-liniowe podsumowanie hot-spotów. Potwierdź przed przejściem do Fazy 2.

## Faza 2 — Wywiad z użytkownikiem (tylko gdy przewodnik nie istnieje)

Faza 1 ujawnia, co mówią dokumenty. Faza 2 ujawnia, co użytkownik wie, a czego dokumenty nigdy nie rejestrują: wcześniejsze incydenty, intuicyjne obawy, obszary zmieniane bez pewności oraz jawne instrukcje dotyczące tego, czego *nie* testować. Traktuj odpowiedzi z taką samą wagą jak linie PRD lub dane hot-spotów — ryzyko zakotwiczone w „użytkownik obawia się Y, awaria ujawniłaby się w `<file>`” jest ugruntowane, o ile plik wytrzyma weryfikację podczas badania.

Pomiń wywiad tylko wtedy, gdy użytkownik wyraźnie o to poprosi. Ostrzeż raz, że wdrożenia oparte wyłącznie na dokumentach odzwierciedlają to, na czym skupia się PRD, a rzadko jest to tym, czego zespół rzeczywiście obawia się zepsuć.

### Prowadzenie

Zadawaj **jedno pytanie naraz**, uwarunkowane poprzednią odpowiedzią — nie jako formularz. Zawsze łącz pytanie z **2–3 krótkimi, konkretnymi przykładami**, aby użytkownik wyczuł kształt oczekiwanej odpowiedzi (i rozpoznał, kiedy jego sytuacja się różni). Przykłady są rusztowaniem, a nie opcjami — wyjaśnij, że użytkownik powinien odpowiedzieć własnymi słowami. Po każdej odpowiedzi powtórz ją w jednej linii, aby użytkownik mógł tanio poprawić błędne odczytanie. Następnie zadaj kolejne pytanie.

Użytkownik może odpowiedzieć „skip” na dowolne pytanie. Jeśli trzy lub więcej zostaną pominięte, przerwij wywiad, odnotuj, że wdrożenie będzie opierać się wyłącznie na dokumentach, i przejdź do Fazy 3 z jednoliniowym ostrzeżeniem.

### Pięć pytań

Każde pytanie poniżej jest dostarczane z przykładowymi odpowiedziami. Przeczytaj je użytkownikowi jako część promptu; dostosuj przykłady do domeny projektu, gdy istnieje oczywiste dostosowanie (np. dla produktu rozliczeniowego użyj przykładów związanych z rozliczeniami).

1. **„Czego najbardziej obawiasz się w związku z awarią tego produktu — niezależnie od tego, co mówią dokumenty?”**
   - np. „Płacący użytkownik otrzymuje 403 i nie może dotrzeć do treści, za którą zapłacił.”
   - np. „Webhook ze Stripe przychodzi dwa razy i podwójnie naliczamy opłatę.”
   - np. „Cichy błąd utraty danych w potoku importu, którego nikt nie zauważa przez tydzień.”

2. **„Gdzie wcześniej zawiódł Cię ten kod albo podobny?”**
   - np. „W zeszłym kwartale migracja działała poprawnie na stagingu i uszkodziła wiersze prod.”
   - np. „Refaktoryzacja middleware uwierzytelniania wylogowała użytkowników na 30 minut.”
   - np. „Wydaliśmy build, w którym w katalogu brakowało połowy lekcji, a nikt nie zauważył tego przez dzień.”

3. **„Który obszar zmieniasz najczęściej bez poczucia pewności?”**
   - np. „Logika blokowania lekcji — każda zmiana wydaje się ruletką.”
   - np. „Routing Cloudflare Worker — działa lokalnie, psuje się na prod.”
   - np. „Skrypt uploadu R2 — uruchamiam go i modlę się.”

4. **„Co dziś wydaje się niedostatecznie przetestowane i potajemnie Cię martwi?”** *(zobacz warunkowe przeformułowanie poniżej, jeśli profil bazy testów to `none`)*
   - np. „Ścieżka ponowień webhooka — mamy jeden test happy path i to wszystko.”
   - np. „Granice błędów — istnieją, ale nigdy nie widziałem ich uruchomionych w teście.”
   - np. „Wszystko, co dotyka pieniędzy — pokrycie jest niewielkie, a wpływ jest poważny.”

5. **„Na co NIE chcesz wydawać budżetu testowego, nawet jeśli podręcznik mówi, że należy to testować?”**
   - np. „Wewnętrzne narzędzia administracyjne — pięciu zaufanych użytkowników, mały promień rażenia.”
   - np. „Wygenerowane klienty TypeScript — generator jest testem.”
   - np. „Testy snapshotów UI dla stron marketingowych — ciągle się psują i niczego nie wykrywają.”

Jeśli odpowiedź użytkownika na jedno pytanie w pełni obejmuje następne, uznaj nakładanie i przejdź dalej. Pięć tur to limit, nie quota.

### Warunkowe przeformułowanie P4 na podstawie profilu bazy testów

Profil bazy testów z Fazy 1 decyduje, jak (lub czy) zadać P4:

- **`meaningful`** — zadaj P4 zgodnie z zapisem. Użytkownik ma testy; „niedostatecznie przetestowane” jest spójnym pojęciem.
- **`sparse`** — przeformułuj: *„Masz kilka testów w `<area>`, ale większość bazy kodu jest pusta. Która luka przeraża Cię najbardziej?”* i zaoferuj te same przykłady.
- **`none`** — **pomiń P4**. Nie ma niczego, co mogłoby być niedostatecznie przetestowane *względem* czegoś. Powiedz użytkownikowi jawnie: *„Pomijam pytanie o 'niedostateczne testowanie' — nie istnieje jeszcze znaczący zestaw testów, więc odpowiedzią byłoby 'wszystko'. Faza 1 wdrożenia zainicjuje runner testów.”* Nie licz tego jako pominięcia zainicjowanego przez użytkownika do progu przerwania.

**Opcjonalne naprowadzenie przy P3.** Jeśli skan hot-spotów wygenerował użyteczną listę, a odpowiedź użytkownika na P3 jest niejasna, pokaż 3 główne katalogi hot-spotów i zapytaj, czy któryś pasuje. Nigdy nie zaczynaj od listy; nigdy nie pozwól jej zastąpić jasnej odpowiedzi słownej.

### Zapis

Zapisz odpowiedzi jako ustrukturyzowaną notatkę (w pamięci; przekazaną do briefu i przewodnika):

```markdown
**User-stated concerns (Phase 2 interview):**

| # | Question | User answer (paraphrase OK) | Implied risk(s)                            |
|---|----------|------------------------------|---------------------------------------------|
| 1 | Worries most         | "Paid user gets a 403 instead of their content." | API gating regression on lesson endpoint |
| 2 | Burned before        | "Catalog build silently dropped lessons last month." | Strict ref resolution at build time |
| 3 | Change without confidence | (skipped) | — |
| 4 | Under-tested today   | "The webhook retry path." | Billing webhook idempotency |
| 5 | Do NOT spend on      | "Internal admin tools — we trust the small set of users." | Negative space note |
```

## Faza 3 — Synteza krótkiego briefu początkowego (tylko gdy przewodnik nie istnieje)

Wyłącznie w pamięci. Brief napędza Fazę 4 i jest źródłem prawdy dla struktury wdrożenia.

```markdown
# Seed Brief (in-memory)

## 1. Top risks (5–7): | # | Risk (failure scenario) | Impact | Likelihood | Source(s) — evidence, not anchors |
## 2. Hot-spots (top 5 files + top 5 directories, scope list) — used as likelihood evidence, not as failure-location anchors
## 3. User-stated concerns (verbatim from Phase 2)
## 4. Stack notes (detected test infra, or "none yet"; include Stack grounding tools checked in current session)
## 5. Risk response guidance: | Risk # | What would prove protection | Must challenge | Context needed | Likely cheapest layer | Anti-pattern to avoid |
## 6. Proposed rollout phases (3–5): | # | Phase name | Goal | Risks covered | Test types | Order rationale |
```

Przykładowe wiersze faz: „Pokrycie ścieżek krytycznych” (najtańsza warstwa dla głównych ryzyk), „Integracja wokół hot-spotów” (moduły o dużej zmienności), „Warstwa AI-native” (tylko jeśli dodaje sygnał, którego klasyczne testy nie wykrywają tanio), „Połączenie bramek jakości” (utrwalenie poziomu bazowego).

### Wskazówki odpowiedzi na ryzyko (obowiązkowe)

Dla każdego głównego ryzyka dodaj wiersz odpowiedzi przed zaproponowaniem etapów wdrożenia. To jest most między „zidentyfikowaliśmy ryzyko” a „dalsza umiejętność wie, jak je zaatakować”. Zachowaj podejście oparte na dowodach: używaj sygnału PRD/wywiadu/archiwum/hot-spotów oraz ograniczeń stosu, ale nie wymyślaj punktów odniesienia do plików.

Każdy wiersz odpowiada na:

- **Co dowiedzie ochrony** — obserwowalne zachowanie lub tryb awarii, który użyteczny test musi wykrywać. Formułuj to jako zachowanie użytkownika/biznesu, a nie „pokryj funkcję X”.
- **Należy zakwestionować** — oczywiste, ale niebezpieczne założenie, którego agent nie powinien bezgłośnie akceptować. Przykłady: „logowanie happy path oznacza, że dostęp do płatnej treści działa”, „pusta odpowiedź oznacza brak treści”, „ponowienie się udało, bo końcowy status to 200”, „wygenerowany schemat równa się kontraktowi produktu”.
- **Potrzebny kontekst** — co `/10x-research` musi ugruntować przed planowaniem: punkt wejścia, stan trwały, granica zewnętrzna, translacja błędów, kształt auth/sesji, gwarancja kolejności, reguła idempotencji, dane fixture/źródło prawdy itd.
- **Prawdopodobnie najtańsza warstwa** — unit, integracja, kontrakt, e2e, deterministyczny visual diff, przegląd AI-native, hook lub manual smoke. To hipoteza do zweryfikowania przez `/10x-research`, nie polecenie.
- **Antywzorzec do uniknięcia** — jeden konkretny tryb awarii przyszłego testu: lustrzane odbicie implementacji, tylko happy path, asercja skopiowana z logiki produkcyjnej, nadmierne mockowanie wnętrzności, kruche założenie kolejności, snapshot-bez-znaczenia, e2e tam, gdzie wykryłaby to integracja, lub warstwa AI-native ponad deterministycznym sygnałem.

Jeśli ryzyko nie może utworzyć tego wiersza, nie jest wystarczająco wykonalne dla wdrożenia. Przeformułuj je lub odrzuć przed Fazą 4.

### Perspektywa nadużyć / bezpieczeństwa (obowiązkowa, gdy ma zastosowanie)

Jeśli produkt ma uwierzytelnianie, płatności lub akceptuje dowolne dane wejściowe użytkownika, główne N ryzyk musi zawierać co najmniej jeden **scenariusz nadużycia** — happy path wyklucza atakującego, więc prawie nigdy nie wyłaniają się one samodzielnie z wywiadu Fazy 2. Przed sfinalizowaniem briefu skonfrontuj zestaw ryzyk z tymi klasami i dodaj wiersz tam, gdzie produkt rzeczywiście wystawia daną powierzchnię:

- **Autoryzacja/dostęp** — IDOR i kontrole własności: czy endpoint weryfikuje, że *ten zasób należy do Ciebie*, a nie tylko, że *jesteś zalogowany*?
- **Niezaufane dane wejściowe** — injection i zgodność walidacji po stronie serwera (serwer nie może ufać klientowi).
- **Wyciek sekretów/PII** — klucze, tokeny lub dane osobowe wydostające się do logów, treści błędów lub bundle front-endu.
- **Nadużycie zasobów** — obejście rate limit, kosztowne operacje w pętli, masowe wyzwalanie skutków ubocznych (np. zalew magic-linków).

Są to zwykłe scenariusze awarii oceniane na tych samych osiach wpływ × prawdopodobieństwo, cytowane zgodnie z tymi samymi zasadami dowodowymi — nie osobny framework i nigdy punkt odniesienia do pliku. Jeśli produkt ma te powierzchnie, a mapa ma zero wierszy nadużyć, to luka do zamknięcia, a nie znak, że produkt jest bezpieczny.

### Kalibracja wpływ × prawdopodobieństwo

Oceniaj obie osie w grubej skali High / Medium / Low (zobacz `references/test-plan-schema.md` §2, aby poznać rubrykę), aby kolejność była odtwarzalna. Chroń najpierw High × High. Scenariusze o wysokim wpływie × niskim prawdopodobieństwie (np. awaria dostawcy chmurowego) zwykle należą do obserwowalności/alertowania, a nie do testu — odnotuj to zamiast sztucznie wypełniać mapę. Nie wymyślaj drobniejszych stopni; celem jest obroniona kolejność, nie fałszywa precyzja.

### Przejście kwestionujące (obowiązkowe)

Przed pokazaniem briefu użytkownikowi przejdź przez każde główne N ryzyko i zastosuj perspektywę konsultanta QA. Trzy kontrole na ryzyko:

1. **„Czy to jest wada, czy opisuję implementację?”** Jeśli złamanie ryzyka wymagałoby najpierw *dodania* zabezpieczenia (np. „brak ścieżki fallback”, gdy fallback nie istnieje), ryzyko jest spekulatywne — odrzuć je lub przeformułuj, aby testowało to, co *istnieje* (np. „ścieżka awarii ujawnia czysty 5xx, nie udaje powodzenia i nie zapisuje do bazy danych”). Spekulatywne ryzyka, które przejdą do §2, zmuszają `/10x-research` do wymyślenia kodu pod test lub oznaczenia ryzyka z powrotem do rewizji; oba przypadki marnują cykl.

2. **„Czy ten wiersz cytuje plik jako punkt odniesienia?”** Usuń wszystko w kolumnie Source, co wygląda jak `src/foo/bar.ts:42` lub `<module>` (konkretny symbol). Zastąp to dowodem, który *podniósł* ryzyko — wywiad P#, linia PRD, **katalog** hot-spotu. Jeśli po usunięciu nie pozostaje żaden dowód, ryzyko nie ma źródła i musi zostać odrzucone albo poparte rzeczywistym cytatem z wywiadu/PRD.

3. **„Czy zalecana odpowiedź wykryłaby rzeczywistą regresję, czy tylko zwiększyłaby pokrycie?”** Odrzuć wskazówki odpowiedzi, które mówią jedynie „dodaj testy unit”, „pokryj moduł”, „przetestuj happy path” lub „asertuj bieżący wynik”. Prawidłowa odpowiedź nazywa zachowanie/tryb awarii, kontekst, który `/10x-research` musi zweryfikować, oraz co najmniej jeden antywzorzec do uniknięcia. Najniebezpieczniejszym pojedynczym antywzorcem dla testów pisanych przez AI jest **problem wyroczni**: asercja, której oczekiwana wartość została podniesiona z implementacji pod testem zamiast z niezależnego źródła (wymagań, kontraktu, wywiadu). Taki test jest tautologiczny — daje zielone światło bieżącemu zachowaniu, w tym bieżącym błędom, i nigdy nie może nie przejść z właściwego powodu. Formułuj komórkę „Co dowiedzie ochrony” jako zachowanie użytkownika/biznesu właśnie po to, aby dalszy test otrzymał wyrocznię z ryzyka, a nie z kodu, który czyta.

Obie kontrole działają po cichu — w ten sposób brief jest oczyszczany, a nie jako krok widoczny dla użytkownika. Jeśli ryzyko zostanie odrzucone lub przeformułowane, odnotuj je w jednoliniowej podsekcji „Challenger findings” na końcu briefu, aby użytkownik mógł zobaczyć, co usunięto i dlaczego.

Pokaż (oczyszczony) brief; poproś o **Accept** / **Edit** / **Cancel**.

## Faza 4 — Zapisz etapowy `test-plan.md` (tylko gdy przewodnik nie istnieje)

Zapisz **jeden plik**: `context/foundation/test-plan.md`, zgodnie z `references/test-plan-schema.md`. Schemat jest stały; treść dostosowuje się do briefu.

Dwa punkty egzekwowania, które schemat wyraźnie określa — nie osłabiaj ich:

- **§1 Strategy musi zawierać zasadę #3** („Risks are scenarios, not code locations”). Skopiuj boilerplate ze schematu; nie parafrazuj go skrótowo.
- **§2 Kolumna Source to dowody, nie punkty odniesienia.** Dozwolone: linie PRD/roadmapy/archiwum, wywiad P#, katalogi hot-spotów z liczbą zmian, ograniczenia tech-stack. Zabronione: `file:line`, nazwy funkcji, nazwy schematów, nazwy modułów. Jeśli szkic wiersza ryzyka nie ma nic w Source po usunięciu zabronionych punktów odniesienia, wiersz nie ma źródła — odrzuć go lub dołącz rzeczywisty cytat z wywiadu/PRD przed zapisem.

Sekcją nośną jest **§3 Phased rollout** — orkiestrator czyta tę tabelę statusów przy każdym kolejnym wywołaniu. Słownictwo statusu (literały parsera): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`. Orkiestrator nadpisuje komórki Status i Change-folder w miarę postępu wdrożenia; reszta wiersza jest zamrożona do `--refresh`.

Zachowaj wskazówki odpowiedzi na ryzyko z briefu w zapisanym planie:

- wiersze ryzyka §2 pozostają zwięzłe i oparte wyłącznie na dowodach.
- §2 musi także zawierać tabelę `Risk Response Guidance` ze schematu dla każdego głównego ryzyka. Przenosi ona intencję odpowiedzi, a nie punkty odniesienia.
- cele faz §3 powinny mówić, jaką ochronę faza próbuje udowodnić, a nie tylko, jaki typ testu doda.
- §4 Stack musi zawierać notatkę o ugruntowaniu MCP/dokumentacji/wyszukiwania z bieżącej sesji z Fazy 1, w tym daty `checked:` oraz „not available in current session” tam, gdzie to właściwe.
- placeholdery §6 powinny, gdy to możliwe, nazywać przyszły wzorzec cookbooka przez zachowanie/tryb awarii, np. „TBD — see §3 Phase 1 for paid-content access denial/regression pattern,” a nie tylko „unit tests TBD.”

Nie dodawaj punktów odniesienia do plików ani kodu testowego, aby zachować te wskazówki. Plan powinien przenosić intencję odpowiedzi; `/10x-research` dostarcza punkty odniesienia, a `/10x-plan` zamienia odpowiedź w podfazy.

Po zapisaniu przejdź bezpośrednio do Fazy 5 (użytkownik już zatwierdził brief).

---

## Faza 5 — Przeczytaj przewodnik, znajdź bieżący etap wdrożenia

Przeczytaj §3 i znajdź pierwszy wiersz, którego Status nie wynosi `complete` — to jest **bieżący etap wdrożenia**. Jeśli każdy wiersz ma `complete`, przejdź do „All phases complete”. Wyodrębnij: numer fazy (N), nazwę fazy, objęte ryzyka, typy testów i folder zmiany (jeśli istnieje) — zasila to bezpośrednie bloki argumentów poniżej.

## Faza 6 — Określ podstan i przedstaw następne przekazanie

Wyprowadź podstan z artefaktów na dysku dla bieżącego wiersza §3: folder zmiany, `research.md`, `plan.md` i niezaznaczone elementy `## Progress` w `plan.md`.

Przed wybraniem przekazania uzgodnij nieaktualny status §3 z dyskiem, jeśli jest potrzebne:

- istnieje `research.md`, a §3 wciąż mówi `change opened` → zaktualizuj na `researched`.
- istnieje `plan.md`, a §3 wciąż mówi `change opened` lub `researched` → zaktualizuj na `planned`.
- istnieje `plan.md` z oczekującym Progress, a §3 nie wynosi `implementing` → zaktualizuj na `implementing` przed przekazaniem do `/10x-implement`.
- Progress w `plan.md` jest w pełni `[x]` → zaktualizuj na `complete` i kontynuuj do Przekazania E.

To leniwe uzgadnianie wspiera ustalony proces badanie → plan → implementacja: dalsze umiejętności nie muszą wracać tutaj tylko po to, aby przełączać etykiety statusu.

Zmapuj stan na jedno z pięciu przekazań. Każde wypisuje następne wywołanie, kopiuje je do schowka, a następnie ZATRZYMUJE SIĘ. W stanach znajdujących się już wewnątrz dalszego procesu payload przekazania przypomina aktywnej umiejętności, aby po ukończeniu sugerowała następne naturalne polecenie, zamiast wracać tutaj po routing.

### Reguła kontynuacji dalszego procesu

Po ukończeniu dowolnej głównej dalszej fazy sugeruj następne naturalne polecenie w ustalonym procesie `/10x-research` → `/10x-plan` → `/10x-implement`, chyba że istnieje wyraźna blokada, korekta lub brakująca decyzja. Następne polecenie powinno zawierać tylko bezpośredni parametr, którego następna umiejętność potrzebuje teraz. Nie proś użytkownika o ponowne uruchomienie `/10x-test-plan` tylko po to, aby odkryć już znany następny krok.

Wróć do `/10x-test-plan`, gdy sam plan testów wymaga uwagi: przeniesienie korekt z badania, uzgodnienie ukończonego etapu wdrożenia, wybór następnego etapu wdrożenia, `--status` lub `--refresh`.

### Przekazanie A — Brak folderu zmiany (Status `not started`)

Zaproponuj change-id na podstawie nazwy etapu wdrożenia (kebab-case, z prefiksem `testing-`). Np. „Critical-path coverage” → `testing-critical-path-coverage`. Potwierdź z użytkownikiem, a następnie zaktualizuj §3 (Status → `change opened`, Change folder → wybrane id) **przed** przekazaniem, aby wznowienie działało, jeśli sesja zakończy się nieoczekiwanie.

Następnie wykonaj **Rytuał przekazania** z:

```
/10x-new <change-id>
```

…a bezpośrednio po nim z tym blokiem intencji jako argumentem:

```
Open a change folder for rollout Phase <N> of context/foundation/test-plan.md: "<phase name>".
Risks covered: <list from §2>. Test types planned: <list from §3>.
Risk response intent: <for each covered risk, one line from §2 Risk Response Guidance describing the behavior or failure mode this phase must prove protected>.
After creating the folder, follow the downstream continuation rule.
```

### Przekazanie B — Istnieje `change.md`, brak `research.md` (Status `change opened`)

Wykonaj Rytuał przekazania z:

```
/10x-research
```

…a bezpośrednio po nim z zapytaniem badawczym o takim kształcie:

```
Ground rollout Phase <N> of context/foundation/test-plan.md.

Risks to verify: <Risk #X, #Y from §2>.
Risk response guidance to verify, not blindly accept:
- <Risk #X>: prove <observable behavior/failure mode>; challenge <obvious assumption>; avoid <anti-pattern>.
- <Risk #Y>: prove <observable behavior/failure mode>; challenge <obvious assumption>; avoid <anti-pattern>.
Hot-spot directories that raised these risks (likelihood evidence — NOT anchors): <dir 1, dir 2 from §1 scope>.
Stack: <from §4>.

The test plan carries evidence and response intent, not code anchors. For each risk, ground the real failure path in code, quote relevant lines, verify or correct the response guidance, locate existing tests, identify the cheapest useful test layer, and flag speculative risks or misleading hot-spot evidence.

Write findings to context/changes/<change-id>/research.md.
Then follow the downstream continuation rule.
```

Jeśli użytkownik wróci tutaj po badaniu, zaktualizuj Status wiersza §3 przewodnika na `researched` przed kontynuowaniem. Uruchom także **kontrolę przeniesienia po badaniu** (poniżej). Ten powrót służy głównie korektom; szczęśliwa ścieżka powinna kontynuować według reguły kontynuacji dalszego procesu.

### Kontrola przeniesienia po badaniu

Gdy pojawi się `research.md` i przed przedstawieniem Przekazania C, przeczytaj nowy plik badania i szukaj trzech typów ustaleń:

1. **Korekty punktów odniesienia** — badanie odkryło powierzchnie awarii w katalogu/obszarze innym niż ten, który kolumna Source §2 cytowała jako dowód hot-spotu (np. §2 cytowało `src/lib/schemas/` jako dowód hot-spotu dla ryzyka dryfu odpowiedzi, ale badanie pokazuje, że schemat odpowiedzi faktycznie znajduje się w `src/lib/openrouter.ts`). Cytat hot-spotu jest mylący.
2. **Potwierdzenia ryzyka spekulatywnego** — badanie oznaczyło ryzyko jako „opisujące implementację, brak czego zepsuć” i zaproponowało odrzucenie/przeformułowanie.
3. **Korekty wskazówek odpowiedzi** — badanie zweryfikowało, że planowana odpowiedź nie wykryłaby awarii, wybrało tańszą warstwę lub stwierdziło, że wymienione założenie „must challenge” było błędne.

Jeśli występuje któreś z nich, zapytaj użytkownika:

> Research surfaced corrections to the test plan §2:
> - [list each finding in one line]
>
> Backport into `context/foundation/test-plan.md` §2 now (Source column, risk wording, or Risk Response Guidance only — never adds file anchors), or defer to `--refresh`?

To jest JEDYNA dozwolona edycja §1/§2 w miejscu poza `--refresh`. Edycja zmienia cytat Source, sformułowanie ryzyka lub komórki wskazówek odpowiedzi, nigdy nie dodaje punktu odniesienia file:line (zasada #3 nadal obowiązuje).

### Przekazanie C — Istnieje `research.md`, brak `plan.md` (Status `researched`)

Wykonaj Rytuał przekazania z:

```
/10x-plan
```

…a bezpośrednio po nim z promptem planowania o takim kształcie:

```
Plan rollout Phase <N> of context/foundation/test-plan.md. Read research.md
and change.md fully. Risks covered: <list>. Test types: <list>. Hot-spot scope:
<from §1>.

Risk response guidance from the test plan and research:
- <Risk #X>: prove <behavior/failure mode>; required context <grounded fact from research>; anti-pattern to avoid <specific anti-pattern>.
- <Risk #Y>: prove <behavior/failure mode>; required context <grounded fact from research>; anti-pattern to avoid <specific anti-pattern>.

Plan sub-phases by cost × signal and risk priority. Each test sub-phase must state behavior asserted, regression caught, research source, edge/error/boundary case, and anti-pattern avoided. Challenge happy paths, avoid implementation mirrors, keep grounding explicit, date any AI-native guidance, and make the final sub-phase update §6 with the cookbook patterns shipped.

Then follow the downstream continuation rule.
```

Jeśli użytkownik wróci tutaj po zapisaniu `plan.md`, zaktualizuj Status §3 na `planned`. Ten powrót nie jest wymagany na szczęśliwej ścieżce; `/10x-plan` powinien stosować regułę kontynuacji dalszego procesu.

### Przekazanie D — Istnieje `plan.md` z oczekującym Progress (Status `planned` lub `implementing`)

Znajdź pierwszy niezaznaczony wiersz w `## Progress` i wyodrębnij numer jego podfazy, np. `N.M` z `- [ ] N.M <title>`.

Wykonaj Rytuał przekazania z:

```
/10x-implement <change-id> phase <N>
```

(Nie potrzeba bezpośredniego argumentu; `/10x-implement` czyta plan bezpośrednio.)

Zaktualizuj Status §3 na `implementing` przy pierwszym przejściu; pozostaw `implementing` dla kolejnych podfaz.

### Przekazanie E — Progress w `plan.md` w pełni `[x]` (Status `complete`)

Etap wdrożenia jest ukończony. Zaktualizuj Status §3 na `complete`. Następnie **zapętl się z powrotem do Fazy 5** — znajdź następny oczekujący etap wdrożenia, przedstaw jego Przekazanie A. Nie kończ, dopóki:

- Wszystkie wiersze §3 nie będą `complete` → wypisz podsumowanie ukończenia (zobacz „All phases complete” na dole tej umiejętności).
- Użytkownik nie zechce zatrzymać się tutaj → po zaktualizowaniu Status wypisz krótkie podsumowanie i ZATRZYMAJ SIĘ.

Użyj `AskUserQuestion` po oznaczeniu jako ukończone:

> Rollout Phase <N> is complete. Proceed to Phase <N+1>, or stop here?
>
> - **Continue to Phase <N+1>** — I'll present the `/10x-new` handoff for the next phase.
> - **Stop here** — I'll print a status snapshot and exit. Re-run `/10x-test-plan` to resume.

---

## Rytuał przekazania

Każde przekazanie (A–D) wypisuje następne wywołanie, kopiuje je do schowka, gdy host wspiera dostęp do schowka, a następnie się zatrzymuje. W przypadku Przekazań A–C następne wywołanie to polecenie slash, po którym bezpośrednio występuje blok intencji/zapytania/promptu jako argument polecenia; nie zakładaj, że dalsze polecenie `/10x-*` zapyta o parametry po uruchomieniu. W przypadku Przekazania D wywołanie zawiera tylko polecenie, ponieważ `/10x-implement` czyta plan bezpośrednio. Późniejsze wywołanie `/10x-test-plan` ponownie wyprowadza stan z dysku i uzgadnia ewentualne nieaktualne statusy §3.

### Krok 1 — Wypisz

```
─────────────────────────────────────────────────────────────────────
Next step: <human-readable description>

Copied invocation (✓ copied to clipboard):

<exact command> <intent/query/prompt block, if any>

Then /clear and paste the copied invocation. After that phase completes, continue with the next natural command suggested by the active skill unless it reports a blocker.
─────────────────────────────────────────────────────────────────────
```

### Krok 2 — Skopiuj do schowka

Użyj narzędzia schowka hosta, jeśli jest dostępne. Jeśli nie, pozostaw wypisane wywołanie jako źródło prawdy.

### Krok 3 — STOP

Nie czekaj na potwierdzenie. Zadanie umiejętności jest ukończone dla tego wywołania.

---

## Tryb `--status`

Pomiń całą logikę faz; przeczytaj przewodnik, jeśli istnieje, i wypisz zwięzły status wdrożenia. Przykładowy wynik:

```
Test rollout status — context/foundation/test-plan.md

| # | Phase                       | Status        | Change folder                                  | Next action                                  |
|---|-----------------------------|---------------|------------------------------------------------|-----------------------------------------------|
| 1 | Critical-path coverage      | complete      | context/changes/testing-critical-path-coverage/ | —                                             |
| 2 | Integration around hot-spots | implementing  | context/changes/testing-integration-hotspots/  | /10x-implement testing-integration-hotspots phase 3 |
| 3 | AI-native layer             | not started   | —                                              | /10x-new testing-ai-native-layer              |
| 4 | Quality-gates wiring        | not started   | —                                              | (waits for Phase 3 to land)                   |

Currently at: Phase 2, sub-phase 3 of 5.
```

Jeśli przewodnik nie istnieje, wypisz:

```
No test-plan.md found at context/foundation/. Run /10x-test-plan
without --status to start the rollout.
```

…i ZATRZYMAJ SIĘ.

## Tryb `--refresh`

Wyzwalany, gdy użytkownik uruchamia `/10x-test-plan --refresh` lub gdy przewodnik jest nieaktualny (np. data `checked:` zalecanego narzędzia jest starsza niż 3 miesiące). Refresh **nie edytuje przewodnika w miejscu** — otwiera nowy folder zmiany `test-plan-refresh-<YYYY-MM-DD>`:

1. Uruchom Fazy 1+2 od nowa — hot-spoty i obawy są jedynymi uczciwymi wyzwalaczami refreshu.
2. Zsyntetyzuj brief o zakresie refreshu: co jest obecnie w przewodniku, co jest nieaktualne, czego brakuje.
3. Przekaż do `/10x-new` z tym briefem (standardowy Rytuał przekazania).
4. Łańcuch działa normalnie; końcowa podfaza planu aktualizuje status §3 i wzorce cookbooka §6, ale nigdy nie przepisuje §1/§2 bez wyraźnej dyspozycji użytkownika.

---

## Interaktywne prompty — niezależne od hosta

Za każdym razem, gdy ta umiejętność mówi *„zapytaj użytkownika”*, użyj dowolnego interaktywnego narzędzia pytań udostępnianego przez hosta (np. `AskUserQuestion`, `ask_question`, `request_user_input`). Przed pierwszym krokiem interaktywnym przeskanuj dostępne narzędzia w poszukiwaniu narzędzia z parametrem `question` i polem `options`/`choices`; użyj pierwszego dopasowania. Jeśli żadne nie istnieje, użyj zwykłej wiadomości konwersacyjnej z oznaczonymi opcjami.

## Wszystkie fazy ukończone

Gdy pętla zakończy się z każdym wierszem §3 ustawionym na `complete`:

```
Rollout complete — every phase in context/foundation/test-plan.md is now `complete`.

What landed:
- <N> rollout phases shipped
- <N> change folders archived (see context/archive/ for history)
- context/foundation/test-plan.md now reflects what is actually tested,
  how to add new tests by area, and the gates that are wired

Refresh cadence: re-run /10x-test-plan --refresh when a new top-3 risk
surfaces, a tool's `checked:` date is > 3 months old, the tech stack changes,
or §7 negative-space no longer matches what the team believes.
```

Następnie zasugeruj smoke test: otwórz świeżą sesję agenta i zapytaj „Read the project rules and `context/foundation/test-plan.md`. What should I test first for a new `<area>` endpoint, and why?” Agent powinien wskazać wzorzec cookbooka, lokalizację i najtańszy typ testu. Jeśli wybierze losowy plik, plik zasad nie wskazuje jeszcze na `context/foundation/`.

## Czego ta umiejętność NIE robi

- Nie pisze kodu testowego, nie konfiguruje hooków/MCP/CI YAML ani nie edytuje AGENTS.md. Trafiają one przez dalsze etapy wdrożenia.
- Nie wymyśla ryzyk — każde ryzyko prowadzi do PRD, roadmapy, archiwum, hot-spotów lub wywiadu Fazy 2.
- Nie wywołuje automatycznie dalszych umiejętności. Każde przekazanie zatrzymuje się przy schowku i czeka, ale każda ukończona dalsza faza powinna sugerować następne naturalne polecenie w ustalonym procesie badanie → plan → implementacja, chyba że istnieje wyraźna blokada.
- **Nie czyta bazy kodu dla wiedzy.** Zmiany hot-spotów, liczba bazy testów, znacznik projektu, wykrywanie frameworka — tak. Grafy wywołań, treści schematów, logika translacji błędów, „który plik odpowiada za tę awarię” — nie. Ta ekstrakcja jest zadaniem `/10x-research`, uruchamianym dla każdego etapu wdrożenia względem aktualnego kodu. Jeśli kiedykolwiek masz pokusę zacytowania `src/foo/bar.ts:42` w §2, przekroczyłeś granicę — zatrzymaj się i pozwól badaniu to zrobić. (Zobacz „Zasady nośne” §3.)

## Ton

Profesjonalny, instruktażowy, zwięzły. Tryb rozkazujący. Bez języka marketingowego. Bez emoji (pojedynczy ✓ w potwierdzeniu schowka jest funkcjonalny).

## Przypadki brzegowe

- **Brak PRD, archiwum ani roadmapy.** Poproś użytkownika o kanoniczne źródła kontekstu; jeśli żadne nie zostaną podane, przewodnik opiera się silnie na wywiadzie Fazy 2 i skanie hot-spotów.
- **Stos poliglotyczny.** Wybierz dominującą powierzchnię testową według liczby plików dla zakresu hot-spotów; wspomnij o wtórnych stosach w §2, jeśli posiadają główne ryzyko.
- **Brak istniejącej infrastruktury testowej.** §4 mówi „none yet”; pierwszy etap wdrożenia inicjuje runner + pierwszy test integracyjny dla Ryzyka #1.
- **Brownfield z bogatymi istniejącymi testami.** Badanie podkreśla, co NIE jest pokryte; §6 rejestruje zarówno to, co istnieje, jak i to, co dodaje wdrożenie.
- **Przewodnik w języku innym niż angielski.** Zapisz treść w żądanym języku; zachowaj słownictwo statusów §3 po angielsku, aby parser nadal działał.
- **Porzucony plan (Status `planned`/`implementing`, użytkownik chce pominąć).** Zapytaj jawnie; jeśli potwierdzone, oznacz `complete` z jednoliniową notatką o pominięciu i przejdź dalej. Nigdy nie przechodź po cichu.