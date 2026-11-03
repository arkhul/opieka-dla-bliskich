---
name: 10x-configure-hook
description: >
  Turn the quality gates from context/foundation/test-plan.md into working
  agent hooks and prove them before handing off. Detects the harness from the
  repo (Claude Code, Cursor, Codex, GitHub Copilot), audits existing hook
  config, maps each gate to a moment (per edit, end of turn, commit, push,
  CI), generates config and scripts in that harness's signal protocol, and
  runs every script against a deliberately broken file. Trigger phrases:
  "configure hooks", "set up agent hooks", "lint after every edit", "hook
  fires but the agent ignores it", "skonfiguruj hooki", "hook po edycji",
  "agent nie widzi błędów z hooka". Use AFTER /10x-test-plan (M3L1). Does
  not write git pre-commit/pre-push config — it only recommends it.
---
# 10x Configure Hook — bramki jakości jako hooki agenta, sprawdzone

Ta umiejętność zamienia bramki, które projekt już określił, w hooki, które agent faktycznie odbiera. Hook jest użyteczny tylko wtedy, gdy jego komunikat dociera do agenta przez kanał odczytywany przez harness dla tego zdarzenia. Większość zepsutych hooków działa poprawnie i wypisuje dane do kanału, którego nikt nie nasłuchuje — dlatego ta umiejętność nigdy nie przekazuje hooka, którego nie uruchomiła.

Pracuj w tej kolejności. Każdy krok ma wynik, który wykorzystuje następny krok; raport końcowy (Krok 8) je zbiera.

## Zasady krytyczne

1. **Przepytuj repo, nie użytkownika.** Wszystko widoczne na dysku — harness, toolchain, istniejące hooki, plan testów — jest odczytywane, a nie pytane. Pytaj tylko o to, na co repo nie może odpowiedzieć.
2. **Kanał sygnału zależy od harnessu i zdarzenia.** Nigdy nie zakładaj, że kody wyjścia, stderr, stdout lub pole JSON znaczą to samo w dwóch harnessach. Fakty znajdują się w `references/<harness>.md`; używaj ich i preferuj aktualną dokumentację, gdy możesz ją przeglądać i jest sprzeczna.
3. **Dla każdej edycji oznacza edytowany plik.** Hook dla każdej edycji odczytuje ścieżkę edytowanego pliku z payloadu i sprawdza tylko ten plik. Kontrole całego projektu przenieś na koniec tury lub później.
4. **Najpierw udowodnij, potem przekaż.** Każdy wygenerowany skrypt uruchom z przykładowym payloadem na celowo zepsutym pliku i na czystym pliku, zanim napiszesz raport.
5. **Scalaj, nigdy nie nadpisuj.** Istniejąca konfiguracja hooków jest audytowana i scalana; diff jest pokazywany przed zapisem.

---

## Krok 1 — Warunki wstępne: przeczytaj plan testów

Poszukaj `context/foundation/test-plan.md`. Znajdź sekcję bramek jakości **po tytule** („Quality Gates” lub bliskim wariancie) — nigdy po numerze sekcji; numeracja zmienia się między wersjami schematu.

Z tabeli bramek zapisz po jednym wierszu dla każdej bramki: nazwę bramki, gdzie działa („local”, „local (agent loop)”, „CI on PR”…), wymagalność („required”, „required after §3 Phase N”, „recommended after…”, „optional”) oraz co wykrywa. Wiersze dotyczące pętli agenta — „post-edit hook”, „lint + typecheck”, „unit + integration” — są podstawowym wejściem.

Zapisz również **jawne odroczenia**: każdą bramkę lub wiersz oznaczony jako „deferred”, „not v1”, „later”, „out of scope” lub podobnie, wraz z cytowanym sformułowaniem i powodem podanym przez plan. Odroczenia są decyzjami, nie lukami.

Jeśli plik nie istnieje albo nie ma sekcji bramek jakości: wyprowadź kandydatów na bramki z własnych skryptów repo (Krok 3) i podaj w raporcie „No test plan found — gates derived from the toolchain”. Zasugeruj `/10x-test-plan`, aby podjąć rzeczywistą decyzję o bramkach, ale nie zatrzymuj się.

## Krok 2 — Wykryj harness(y)

Każdy plik referencyjny otwiera sekcja **Detection signals**. Przeczytaj te sekcje dla każdego pliku w `references/` i dopasuj je do repo. Typowe sygnały:

- Claude Code: katalog `.claude/` (`settings.json`, `settings.local.json`, `skills/`), `CLAUDE.md`.
- Cursor: `.cursor/` (`hooks.json`, `rules/`, `skills/`), `.cursor/rules/10x-course.mdc`.
- Codex: `.codex/` (`hooks.json`, `config.toml`), `.agents/skills/`, `AGENTS.md`.
- GitHub Copilot: `.github/hooks/`, `.github/skills/`, `.github/copilot-instructions.md`.
- Manifest 10x-cli: `.claude/`, `.cursor/`, `.github/` lub `.agents/.10x-cli-manifest.json` — jego pole `"tool"` nazywa harness, dla którego zainstalowano artefakty kursu.

Specyficzne dla harnessu katalogi konfiguracji i manifest są silnymi sygnałami. `AGENTS.md` i `.agents/skills/` są słabe: wiele harnessów odczytuje `AGENTS.md`, a 10x-cli zapisuje również `.agents/skills/` w repozytoriach Claude Code.

**Rozstrzygnięcie remisu:** katalog, z którego załadowano tę umiejętność, określa harness, który konfigurujesz. Wymień każdy inny znaleziony harness wraz ze ścieżką dowodu; zapytaj raz — oferując wykryte opcje — tylko jeśli inny harness jest również potrzebny albo ma już konfigurację hooków.

## Krok 3 — Wykryj toolchain

Czytaj manifest i konfigurację, nie polegaj na pamięci. Dla każdej bramki zapisz dokładne polecenie używane przez to repo:

- **Lint / formatowanie** — linter projektu oraz to, czy akceptuje ścieżkę pojedynczego pliku (ESLint, Biome, Ruff, golangci-lint, RuboCop…). Preferuj lokalny binarny (`npx`, `pnpm exec`, `uv run`, …), którego repo już używa. Wyprowadź sprawdzane rozszerzenia plików z konfiguracji lintowania, nie z przykładów (np. dodaj `.astro`, gdy skonfigurowano `eslint-plugin-astro`, analogicznie `.vue` / `.svelte`). **Brak lintera:** kontrolą dla każdej edycji są diagnostyki typecheckera przefiltrowane do edytowanego pliku oraz `node --check` dla zwykłego JavaScript (`check-edited-file.sh` w referencji Claude Code); zalecaj linter w raporcie, nie instaluj go.
- **Typecheck** — polecenie dla całego projektu (`tsc --noEmit`, `astro check`, `mypy`, `cargo check`, …) oraz orientacyjny czas działania. Frameworki z generowanymi typami wymagają najpierw kroku synchronizacji (`tsc` nie przechodzi dla modułów `astro:*`, dopóki `astro sync` nie wygeneruje `.astro/`; `astro check` synchronizuje je sam, ale działa wolniej). Wygenerowane katalogi są zwykle ignorowane przez git, więc synchronizacja naprawiająca baseline powinna należeć do skryptu na koniec tury, a nie do jednorazowego polecenia.
- **Baseline** — uruchom każdą kontrolę na koniec tury raz na niezmienionym drzewie. Jeśli jest już czerwona (brakujące wygenerowane typy, zagnieżdżony pakiet z niezainstalowanymi zależnościami uwzględniony przez główny include `**/*`, …): napraw warunek wstępny (wygeneruj typy), ogranicz zakres polecenia (projektowy tsconfig, filtr ścieżek, diagnostyki ograniczone do zmienionych plików) albo zgłoś to jako blokadę. Nigdy nie przekazuj hooka Stop, który blokuje na czystym drzewie.
  **Czerwony z powodu hosta, a nie kodu** (test przypięty do dokładnej wersji narzędzia, test trybu pliku zależący od `umask`, współdzielona lokalna usługa): skrypt wykrywa ten warunek, pomija tylko dotkniętą część i informuje o tym w swoim wyjściu (wzorzec `SKIPPED` w referencji). Jeśli możesz, napraw środowisko poza hookiem; ciche pominięcie nigdy nie jest akceptowalne.
- **Testy** — runner oraz to, czy ma tryb testów powiązanych (`vitest related <file> --run`, `jest --findRelatedTests <file> --passWithNoTests`, `pytest` ze ścieżką, …). Zwróć uwagę, co runner robi, gdy żaden test nie pasuje (czy kod wyjścia to 0). **Brak trybu powiązanego** (`node --test`, `bun test`): wybierz pliki testowe importujące edytowany moduł za pomocą `git grep` po plikach testowych (`related-tests-by-import.sh` w referencji Claude Code); jeden poziom importu, przegląd na koniec tury i bramka commita pokrywają resztę. Zmierz raz całą suitę jednostkową: jeśli kończy się w około 30 s lub mniej, skrypt na koniec tury uruchamia całość (dzięki temu wykrywa także czerwony test w module, który agent tylko zaimportował); w przeciwnym razie uruchamia testy powiązane ze zmienionymi plikami.
- **Menedżer git-hooków** — Husky, lint-staged, Lefthook, pre-commit albo brak. Istniejące hooki git nie są nigdy modyfikowane przez tę umiejętność.
- **Wymagania wstępne skryptów** — `jq` dla skryptów bash albo Node/Python, jeśli skrypt inny niż bash jest bezpieczniejszy (Windows bez Git Bash).

## Krok 4 — Przypisz bramki do momentów; przeprowadź audyt istniejących elementów

**Momenty**, najpierw najtańszy sygnał:

| Moment | Należy tutaj | Dociera do agenta |
| --- | --- | --- |
| Dla każdej edycji | Lint/formatowanie edytowanego pliku; powiązane testy, gdy kończą się w sekundy | Tak |
| Koniec tury | Lint + testy dla każdego pliku zmienionego w tej turze; typecheck całego projektu | Tak |
| Przed commitem | Lint + testy na zindeksowanych plikach (wychwytuje edycje wykonane bez agenta) | Nie |
| Przed pushem | Cięższe suity, lokalne e2e | Nie |
| CI | Integracja, współdzielony stan, infrastruktura, której nie masz lokalnie | Nie |

Heurystyka szybkości: **im wolniejsza kontrola, tym rzadszy moment.** Kilka sekund pasuje do każdej edycji; dziesiątki sekund lub zakres całego projektu należą na koniec tury; minuty należą do commita, pushu lub CI.

Moment dla każdej edycji widzi wyłącznie narzędzia edycji harnessu. Agenci przepisują także pliki przez polecenia powłoki (`cat > file <<EOF`, `sed -i`), których żaden hook dla każdej edycji nie odbiera. Koniec tury jest zatem siatką bezpieczeństwa dla całej tury, nie tylko momentem typechecka: ponownie sprawdza każdy zmieniony plik z `git diff`.

**Odroczenia.** Gdy plan testów jawnie odracza bramkę, która stałaby się hookiem (na przykład „post-edit hook — deferred, not v1”), zacytuj użytkownikowi odroczenie i jego powód, a następnie zapytaj **raz**: skonfigurować mimo to czy uszanować odroczenie? Zapisz odpowiedź jako `override` albo `skip` w raporcie. Nie pytaj ponownie dla każdego hooka.

**Przeprowadź audyt istniejącej konfiguracji hooków przed zaproponowaniem czegokolwiek.** Przeczytaj pliki konfiguracji hooków harnessu (ścieżki w referencji) oraz każdy skrypt w jego katalogu hooków, w tym skrypty, do których nie odnosi się żadna konfiguracja (np. osierocony `.claude/hooks/run-related-tests.mjs`, który wypisuje tylko na stdout). Dla każdego istniejącego hooka nazwij konkretne wady, na przykład:

- lint całego projektu albo `--fix .` przy każdej edycji (wolne, dotyka plików, których agent nie edytował, zgłasza stare błędy jako szum);
- polecenie, którego błąd kończy się kodem traktowanym przez harness jako nieblokujący albo wypisuje do kanału, który nigdy nie dociera do agenta (np. exit 1 + stdout, gdy harness przekazuje tylko stderr przy exit 2);
- timeouty wyglądające jak milisekundy (`10000`, `30000`), gdy harness oczekuje sekund;
- typecheck całego projektu przy każdej edycji zamiast na koniec tury;
- hook na koniec tury bez zabezpieczenia przed ponowieniem (może zapętlić się do limitu harnessu);
- ta sama kontrola zarejestrowana dwa razy (Cursor i Copilot mogą importować `.claude/settings*.json` — zobacz ich referencje).

Przedstaw mapę momentów i ustalenia audytu razem jako propozycję. Poczekaj na zgodę użytkownika przed zapisem plików — **chyba że żądanie już jest taką zgodą**: użytkownik poprosił o skonfigurowanie konkretnych hooków w tym repo, a propozycja nie dodaje niczego, o co nie prosił (bez nadpisania odroczenia, zastąpionego hooka, zmiany poza katalogiem hooków i konfiguracją). Wtedy przedstaw propozycję i kontynuuj; pytaj tylko o to, co wykracza poza żądanie.

## Krok 5 — Załaduj referencję harnessu

Przeczytaj `references/<harness>.md` dla każdego harnessu, który skonfigurujesz:

- `references/anthropic.md` — Claude Code
- `references/cursor.md`
- `references/codex.md`
- `references/copilot.md`
- `references/other-harnesses.md` — Devin Desktop, Gemini CLI, OpenCode, Kiro, Junie: tylko linki i uwagi o możliwościach. Dla tych wyjaśnij ograniczenie i wskaż dokumentację zamiast generować konfigurację, której nie możesz udowodnić.

Każda referencja rozpoczyna się od `Verified on:` oraz kanonicznych URL-i dokumentacji. Jeśli możesz przeglądać internet, otwórz podlinkowaną dokumentację i ponownie sprawdź pole payloadu dla edytowanego pliku, kanał docierający do agenta oraz jednostkę timeoutu. W razie konfliktu postępuj zgodnie z aktualną dokumentacją i zapisz rozbieżność w raporcie („reference says X, doc now says Y”).

## Krok 6 — Wygeneruj konfigurację i skrypty

Postępuj zgodnie z minimalnymi przykładami z referencji; dostosuj polecenia do toolchainu z Kroku 3.

- **Skrypt dla każdej edycji** — odczytuje payload ze stdin, wyodrębnia ścieżkę edytowanego pliku za pomocą pól wskazanych przez referencję, kończy się sukcesem, gdy ścieżki brakuje lub typ pliku nie jest sprawdzany, i uruchamia kontrolę **tylko na tym pliku**. Przy błędzie wysyła krótki nagłówek oraz wyjście narzędzia kanałem docierającym do agenta.
- **Skrypt na koniec tury** — przegląda turę: zbiera zmienione i nowe pliki (`git diff --name-only HEAD` plus nieśledzone), kończy się wcześnie, gdy ich nie ma, uruchamia kontrole dla każdej edycji na wszystkich z nich (lint dla objętych plików; powiązane testy albo całą suitę jednostkową, gdy Krok 3 wykazał, że jest szybka), następnie typecheck całego projektu i raportuje wszystkie błędy w jednej wiadomości. Uwzględnia flagę ponowienia harnessu (`stop_hook_active` w Claude Code albo odpowiednik nazwany w referencji), aby agent dostał **jedną** szansę na naprawę, a następnie mógł zakończyć. To, czego nie może naprawić, pozostawia bramce commita. Utrzymuj łączny czas poniżej timeoutu (domyślnie 120 s); jeśli przegląd jest wolniejszy, najpierw ogranicz testy wyłącznie do powiązanych.
- **Zwykłe wyjście** — wyjście hooka jest czytane przez model, nie terminal: `tsc --pretty false`, `grep --color=never`, `NO_COLOR=1 FORCE_COLOR=0` dla wszystkiego innego. Skrypty dziedziczą środowisko powłoki użytkownika (np. `GREP_OPTIONS=--color=always` psuje filtr grep), więc ustawiaj je jawnie.
- **Payloady to niezaufane kształty wejścia.** Akceptuj każdy udokumentowany kształt: toleruj brakujące pola, pusty stdin i alternatywne nazwy pól; nigdy nie powoduj błędu hooka, ponieważ brakuje pola. Brakująca ścieżka oznacza „nothing to check”, nie błąd.
- **Timeouty** w jednostce oczekiwanej przez harness (zwykle sekundy): około 30 dla lintowania dla każdej edycji, 60 dla powiązanych testów, 120 dla typechecka — następnie dostrój.
- **Ścieżki** — rozwiązuj checkout w sposób pokazany w referencji, nigdy przez samo `cd` do zmiennej katalogu projektu. W Claude Code `$CLAUDE_PROJECT_DIR` jest katalogiem, w którym rozpoczęła się sesja, i staje się nieaktualny po `EnterWorktree`, a edycja w sąsiednim worktree nie należy ani do tej zmiennej, ani do `cwd`: polecenie odnajduje skrypt przez `git rev-parse --show-toplevel`, skrypt dla każdej edycji pobiera checkout z edytowanego pliku (ścieżki względne rozwiązywane względem `cwd`; pliki innych repozytoriów są pomijane), a skrypt na koniec tury przegląda payload `cwd` oraz każdy checkout zarejestrowany dla `session_id`. Uczyń skrypty wykonywalnymi (`chmod +x`).
- **Bez cichego sukcesu** — exit 0 oznacza „sprawdzone i czyste” albo „nic do sprawdzenia”. Brakującego narzędzia (`jq`, niezainstalowanego lintera), typecheckera, który się nie uruchomił, ani wrappera takiego jak `[ -x script ] && exec script; exit 0` nie wolno przepuścić; muszą widocznie zakończyć się błędem (kanał informacji zwrotnej albo komunikat widoczny dla użytkownika).
- **Zacommitowana konfiguracja** — sprawdź, że pliki hooków nie są ignorowane (`git check-ignore -v .claude/settings.json`). Ignorowany katalog hooków istnieje tylko na jednym dysku; zaproponuj ponowne uwzględnienie z referencji i pokaż diff `.gitignore`.
- **Windows** — odnotuj powłokę używaną przez harness (Git Bash, PowerShell, pole poleceń per OS). Jeśli bash albo `jq` nie są dostępne, wygeneruj zamiast tego skrypt Node.
- **Istniejąca konfiguracja** — scal ją, zachowaj niepowiązane hooki, zastąp tylko wadliwe wpisy nazwane w Kroku 4 i pokaż diff przed zapisem. Skrypt pozostawiony przez zastąpiony lub osierocony hook pozostaje na dysku: wymień go w raporcie i zalecaj usunięcie; nigdy nie usuwaj go po cichu.
- **Podwójna rejestracja** — hooki `.claude/settings*.json` są także uruchamiane przez Cursor (import domyślnie włączony), przez Copilot CLI oraz przez VS Code, gdy `chat.useClaudeHooks` jest włączone. Jeśli jedno z nich jest używane, a `.claude/settings*.json` już zawiera hooki, nie rejestruj ponownie tej samej kontroli w jego natywnej konfiguracji bez rozwiązania importu (zobacz `references/cursor.md`, `references/copilot.md`).

## Krok 7 — Udowodnij przed przekazaniem, jako zacommitowany test

Dowód to **plik testowy zacommitowany do repo**, uruchamiany przez własny runner testów repo, a nie jednorazowa sekwencja poleceń powłoki. Hooki się zmieniają; dowód, którego nikt nie może uruchomić ponownie, przestaje cokolwiek udowadniać po pierwszej edycji.

Nazwij go `agent-hooks.test.*` i umieść obok istniejących testów narzędziowych repo (w `scripts/__tests__/`, `tools/ci/` lub `tests/`, …), w runnerze już używanym przez repo. Każdy przypadek przesyła payload (kształt z referencji) do rzeczywistego skryptu i asercyjnie sprawdza kod wyjścia oraz kanał wyjścia. Pracuj na tymczasowej kopii albo jednorazowym repo/worktree git, nigdy na plikach w drzewie dewelopera. Stubuj tylko to, co jest wolne albo niedostępne w środowisku testowym (binarny linter na `PATH`, który oznacza marker), zachowaj prawdziwe git, `jq` i skrypty.

Przypadki:

1. **Zepsuty plik** — celowy, oczywisty błąd w pliku objętym kontrolą (nieużywana zmienna, zły typ). Oczekuj blokującego lub zwrotnego sygnału udokumentowanego przez referencję oraz komunikatu nazywającego plik i problem. Dla skryptów uruchamiających testy błąd musi być behawioralny (nieprzechodząca asercja): błędy wyłącznie typów nie psują Vitest, który usuwa typy.
2. **Czysty plik** — oczekuj sukcesu i braku blokującego wyjścia. Dla skryptów na koniec tury wymaga to zielonego baseline z Kroku 3.
3. **Pomijany typ** — plik, którego kontrola nie obejmuje (np. `README.md`). Oczekuj sukcesu.
4. **Nieistniejący plik** — payload wskazujący ścieżkę, która nie istnieje. Oczekuj sukcesu.
5. **Pusty payload** — `{}` oraz payload nieparsowalny lub bez ścieżki (np. `not json`, wywołanie narzędzia bez ścieżki). Oczekuj sukcesu.
6. **Koniec tury z ustawioną flagą ponowienia** — oczekuj sukcesu, nawet gdy błąd nadal istnieje.
7. **Edycja omijająca hook dla każdej edycji** — błąd lintowania zapisany bezpośrednio na dysku, bez payloadu dla każdej edycji, skrypt na koniec tury. Oczekuj, że zablokuje i nazwie ten plik. Gdy nie ma w ogóle zmienionych plików, oczekuj sukcesu bez uruchamiania żadnej kontroli.
8. **Rozwiązywanie checkoutu** — zmienna katalogu projektu wskazująca inny checkout zawierający błąd: hooki sprawdzają checkout sesji i pozostają zielone. Ścieżka względna rozwiązuje się względem `cwd`. Zepsuty plik innego repozytorium jest pomijany. Edycja w sąsiednim worktree jest przeglądana przez skrypt na koniec tury. Każde `command` z konfiguracji, uruchomione z worktree przy zmiennej katalogu projektu ustawionej na nieistniejącą ścieżkę, dociera do wykonywalnego skryptu.
9. **Bez cichego sukcesu** — brakujący linter albo typechecker: oczekuj sygnału błędu, nie sukcesu.
10. **Kształty specyficzne dla harnessu** — dodatkowe przypadki wymienione przez referencję (np. Codex: payload niebędący patchem, patch wieloplikowy, `cwd` w podkatalogu).

Raz celowo zepsuj sam test: cofnij jedną poprawkę w skrypcie (np. usuń zabezpieczenie przed ponowieniem) i obserwuj, jak odpowiadający przypadek staje się czerwony, następnie ją przywróć. Podłącz test do bramki, którą repo już uruchamia (suita jednostkowa, `verify`, pre-push), ograniczając go do zmian w katalogu hooków, jeśli suita jest wolna. Nie dodawaj zadania CI.

Cofnij każdy celowy błąd i potwierdź, że `git status` pokazuje tylko pliki, które zamierzałeś utworzyć lub zmienić. Jeśli przypadek nie przechodzi, napraw skrypt i uruchom test ponownie. Nigdy nie raportuj działania hooka wyłącznie na podstawie konfiguracji.

## Krok 8 — Raport

Wypisz zwięzły raport:

- **Wejścia** — ścieżka planu testów (albo „No test plan found — gates derived from the toolchain”), harness(y) wraz ze ścieżkami dowodów, polecenia toolchainu, baseline na koniec tury (zielony, naprawiony, ograniczony zakresem albo blokada).
- **Odroczenia** — każde cytowane odroczenie oraz odpowiedź użytkownika (`override` / `skip`).
- **Audyt** — wady znalezione w istniejącej konfiguracji hooków i to, co je zastąpiło; pozostawione skrypty (osierocone lub zastąpione) z zaleceniem usunięcia.
- **Skonfigurowane** — dla każdego harnessu: plik(i) konfiguracji, skrypty, zdarzenia, timeouty; scalony diff.
- **Dowód** — zacommitowany plik testowy, polecenie go uruchamiające, jego wynik oraz celowe zepsucie, które obserwowałeś jako czerwone.
- **Nadal wymagane od użytkownika** — kroki zaufania lub zatwierdzenia (np. przegląd Codex `/hooks`, zaufanie do workspace Cursor, ponowne uruchomienie sesji) oraz sposób potwierdzenia załadowania hooka (menu hooków harnessu albo log debug).
- **Dryf referencji** — każda rozbieżność między referencją a aktualną dokumentacją.
- **Poza zasięgiem** — czego te hooki nie mogą udowodnić: zachowania uruchomionej aplikacji (komponent klienta, który nigdy nie hydratuje, routing, polityki bazy danych, efekty uboczne). Lint, typy i testy jednostkowe mogą przejść, gdy funkcja jest zepsuta. Nazwij zagrożone powierzchnie repo i wskaż weryfikację E2E lub w przeglądarce; nie konfiguruj jej tutaj.
- **Zalecane bramki git (niezapisane)** — co należy do pre-commit i pre-push dla tego repo, z istniejącym menedżerem hooków, jeśli istnieje. Nie twórz ani nie edytuj konfiguracji git-hooków.
- **Następny krok** — poproś agenta o edycję pliku z błędem lintowania, a następnie błędem typu, i obserwuj, jak naprawia oba w tej samej sesji. Następnie poproś go o przepisanie pliku poleceniem powłoki z błędem lintowania i obserwuj, jak hook na koniec tury odsyła go z powrotem.

## Czego ta umiejętność NIE robi

- Nie zmienia bramek ani strategii ryzyka — od tego jest `/10x-test-plan`.
- Nie pisze testów aplikacji, scenariuszy E2E ani pipeline’ów CI (jedyny test, który pisze, to test hooka z Kroku 7).
- Nie instaluje ani nie rekonfiguruje menedżerów git-hooków (Husky, Lefthook, pre-commit).
- Nie generuje konfiguracji dla harnessów, których nie może udowodnić (zobacz `references/other-harnesses.md`).

## Interaktywne prompty — niezależne od hosta

Gdy ta umiejętność mówi „zapytaj użytkownika”, użyj dowolnego narzędzia pytań udostępnianego przez hosta; jeśli żadne nie istnieje, zapytaj zwykłym tekstem z oznaczonymi opcjami. Zapytaj najwyżej o: który harness (tylko gdy występuje niejednoznaczność), czy nadpisać odroczenie (raz) oraz zgodę po propozycji (pomijaną, gdy żądanie już jest taką zgodą, Krok 4).

## Ton

Zwięzły, rozkazujący, konkretny. Nazywaj pliki, polecenia i kody wyjścia. Bez języka marketingowego.