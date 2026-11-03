---
name: 10x-repo-map
description: >
  Build a Project Map (context/map/repo-map.md) of an unfamiliar or legacy
  repository in one run, organised around business capabilities — checkout,
  billing, sign-in, search, notifications, whatever the product actually
  does — and ranked by criticality × buzz: where change, fixes, reverts and
  discussion concentrate. A capability inventory from entry points, data
  model and commit vocabulary feeds four parallel evidence sub-agents
  (history, discussion, structure, people); the main agent synthesizes one
  decision-ready report with risk zones, a first-day reading list and
  explicit unknowns. Tech-stack agnostic; works on git alone, richer with the
  GitHub CLI. Use when the user wants to get up to speed in, map or
  understand a large or inherited codebase, asks "where do I start in this
  repo", "what are the hot areas here", "zbuduj mapę projektu", "wide scan",
  "repo map", or wants to refresh an existing context/map/repo-map.md.
argument-hint: "[--root <path>] [--since <git-date>] [--lang <code>] [--replace]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---
# Mapa projektu: gdzie kryje się biznes i gdzie boli

Przygotuj jeden raport, `context/map/repo-map.md`, który odpowiada na pytania dotyczące repozytorium,
którego nikt ci nie wyjaśnił: **co robi ten produkt, które z jego
możliwości mają największe znaczenie, gdzie jest największy szum — zmiany, poprawki, wycofania,
dyskusje — i gdzie muszę zachować ostrożność przed większą zmianą?**

Metoda to **Wide Scan**: nigdy nie czytaj repozytorium; pozwól tanim,
deterministycznym narzędziom (historii git, forge, grafowi zależności) zbierać
dowody poza oknem kontekstu, a interpretuj tylko ich skondensowane
wyniki. Jednostką analizy jest **możliwość biznesowa**, a nie folder.
Foldery i importy wyjaśniają problemy możliwości; nie określają ich rangi.

**Szerokość, nie głębokość — mapa nie ma celu.** Służy do szybkiego
zapoznania się z całym repozytorium (lub poddrzewem `--root`): dla nowego członka zespołu,
osoby wracającej po długiej przerwie, zespołu przejmującego repozytorium. Umiejętność
samodzielnie odkrywa możliwości; nie przyjmuje funkcji, modułu ani pytania, na którym
miałaby się skupić, i nigdy nie zawęża skanowania. Jej strefy ryzyka i niewiadome wskazują,
gdzie powinna rozpocząć się głębsza, ukierunkowana analiza.

## Wyniki

| Ścieżka | Co |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `context/map/repo-map.md` | **Raport** — jedyny plik przeznaczony do czytania przez ludzi i późniejsze prace |
| `context/map/evidence/1-history.md` | Aktywność zmian, presja poprawek i współzmiany według możliwości |
| `context/map/evidence/2-discussion.md` | PR-y, przeglądy, wycofania, zgłoszenia, artefakty planowania i znaczniki długu według możliwości |
| `context/map/evidence/3-structure.md` | Graf zależności między możliwościami i wewnątrz nich: promień rażenia, cykle, granice |
| `context/map/evidence/4-people.md` | Kto odpowiada za każdą możliwość, na tle bazowej wielkości zespołu |
| `context/archive/<stamp>-repo-map/` | Wcześniejszy raport i jego dowody, przeniesione tutaj przy zastąpieniu |
| `context/map/.work/` | Jednorazowe dane pośrednie, ignorowane przez git za pomocą własnego `.gitignore` |

## 1. Przygotowanie

- Potwierdź repozytorium git. Zanotuj datę pierwszego commitu: gdy historia jest
  krótsza niż okno (domyślnie `12 months ago`, zmień za pomocą `--since`),
  całkowita historia stanowi okno. Płytki klon otrzymuje ostrzeżenie —
  dowody oparte na historii będą częściowe.
- Jeśli `context/map/repo-map.md` istnieje w drzewie roboczym: z `--replace`,
  lub gdy nie ma nikogo, kogo można zapytać (uruchomienie zorkiestrowane lub CI), przenieś go oraz
  `context/map/evidence/` do `context/archive/<stamp>-repo-map/` — `<stamp>`
  to data `generated` raportu jako `YYYY-MM-DD`, z `-2`, `-3` … gdy
  taki folder istnieje — i kontynuuj; w przeciwnym razie zapytaj raz, czy go zastąpić.
  To jedyne pytanie.
- Język raportu: `--lang`, w przeciwnym razie język żądania użytkownika, a jeśli go nie ma —
  angielski.
- `mkdir -p context/map/evidence context/map/.work`, a następnie zapisz
  `context/map/.work/.gitignore` zawierający `*`, aby surowe dane nigdy nie zostały
  zacommitowane. Nie twórz niczego więcej.
- Uruchamiaj każde polecenie git z `-c core.quotepath=off` i wyświetlaj pliki za pomocą
  `git ls-files` — nigdy `find` — aby worktree, pamięci podręczne i ignorowane pliki pozostały
  pominięte.
- Sprawdź raz, czy GitHub CLI nadaje się do użycia dla tego repozytorium
  (`gh repo view --json nameWithOwner` kończy się powodzeniem). Zapisz odpowiedź; agent
  dyskusji dostosuje się.

## 2. Kontrakt skanowania i inwentarz możliwości (główny agent)

Zbuduj wspólną prawdę bazową, z której korzysta każdy podagent, zgodnie z
[references/scan-contract.md](references/scan-contract.md): okno, koszyki,
korzenie modułów, filtr szumu, wykluczone commity i zasady liczenia — oraz
**inwentarz możliwości** z
[references/capability-inventory.md](references/capability-inventory.md),
stanowiący kręgosłup całego raportu. Zapisz `context/map/.work/scan-contract.md`
i `context/map/.work/capabilities.tsv`.

Tylko tanie polecenia: git, listy plików, `rg` po nazwach i schemacie,
nagłówki własnego README i dokumentacji projektu. Nie czytaj plików źródłowych.

## 3. Wyślij równolegle czterech podagentów zbierających dowody

Uruchom wszystkich czterech w **jednej wiadomości**. Każdy prompt zawiera: bezwzględną ścieżkę
do katalogu tej umiejętności (`<loaded-skill-dir>` w opisach), ścieżkę do jego opisu,
ścieżki kontraktu skanowania i możliwości, ścieżkę wyjściową, ścieżkę do listy
fałszywych sygnałów oraz poniższe zasady. Powiedz każdemu podagentowi, aby najpierw przeczytał swój opis.

| Podagent | Opis | Pytanie |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| historia | [references/agent-history.md](references/agent-history.md) | Co się zmienia, co jest poprawiane, co zmienia się razem? |
| dyskusja | [references/agent-discussion.md](references/agent-discussion.md) | Gdzie trafiają uwaga, tarcia i drugie próby? |
| struktura | [references/agent-structure.md](references/agent-structure.md) | Jak daleko sięga zmiana; które granice się łamią? |
| ludzie | [references/agent-people.md](references/agent-people.md) | Kto odpowiada za każdą możliwość? |

W Claude Code uruchamiaj za pomocą narzędzia `Agent` (`Task` w starszych wersjach),
`subagent_type: "general-purpose"` — potrzebują Bash i Write. W innych hostach
użyj natywnego odpowiednika. Bez obsługi podagentów uruchom samodzielnie cztery opisy
sekwencyjnie.

Zasady do przekazania każdemu podagentowi:

1. Dowody przed interpretacją. Każda liczba, ranking lub zależność pochodzi
   z polecenia uruchomionego w tej sesji. Bez eksploracyjnego czytania plików źródłowych;
   otwieraj plik tylko po to, aby potwierdzić to, na co wskazało polecenie.
2. Przypisuj wszystko do możliwości przez `capabilities.tsv` i
   zasady liczenia w kontrakcie skanowania; raportuj nieprzypisaną objętość zamiast
   ją ukrywać. Nigdy nie wymyślaj prywatnego schematu przypisywania lub liczenia.
3. Zastosuj [references/false-signals.md](references/false-signals.md), zanim
   nazwiesz cokolwiek ryzykiem; oznaczaj mechaniczne sygnały jako takie.
4. Surowe dane pozostają w `context/map/.work/`; plik dowodów zawiera skondensowane
   tabele. Oznaczaj ustalenia jako `evidence`, `inference` lub `unknown`; martwy punkt to
   `unknown`, nigdy „no dependencies”.
5. Tylko odczyt i **niczego nie instaluj** — lokalnie ani na forge. Gdy lepsze
   narzędzie wymagałoby instalacji, użyj alternatywy i zarekomenduj narzędzie w sekcji
   Niewiadome.
6. Zwróć do głównego agenta maksymalnie 15 wierszy: najważniejsze ustalenia dla każdej możliwości,
   niewiadome, pokrycie i pewność.

Poczekaj na wszystkich czterech. Nieudany lub częściowy podagent stanowi wskazaną lukę w
raporcie; ponów próbę tylko raz, jeśli awaria była mechaniczna.

## 4. Zsyntetyzuj raport

Przeczytaj cztery pliki dowodów i zapisz `context/map/repo-map.md` zgodnie z
[references/report.md](references/report.md): uszereguj możliwości według
**criticality × buzz**, licz tylko niezależne sygnały szumu, zastosuj
listę fałszywych sygnałów i zachowaj jego siedem sekcji.

## 5. Zweryfikuj, a następnie przedstaw

Uruchom etap weryfikacji opisany w
[references/report.md](references/report.md#verification). Następnie przedstaw: ścieżkę do
raportu, tabelę możliwości, strefy ryzyka, dostępne źródła dowodów
(tylko git lub git plus forge), pokrycie grafu według języka oraz luki.
Na tym zakończ; mapa nie rozpoczyna dalszych prac.