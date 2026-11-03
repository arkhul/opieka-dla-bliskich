---
name: 10x-e2e-setup
description: One-time, re-runnable Playwright E2E setup for an existing web app. Detects the stack, port, package manager, auth and any existing Playwright files, then fills only the gaps - installs @playwright/test, creates or extends playwright.config.ts (webServer on build + preview, a setup project with storageState, traces and screenshots on failure), writes and greens one seed test for a browser-level risk, wires playwright-cli into your agent, and records everything in context/foundation/test-stack.md. Hands off to /10x-e2e. Use when the user says "set up Playwright", "e2e setup", "prepare E2E tests", "no playwright config", or when /10x-e2e redirects here.
---
# Konfiguracja 10x E2E — infrastruktura Playwright dla `/10x-e2e`

Prowadzisz projekt od „braku Playwright” (lub „pewnej konfiguracji Playwright”) do dokładnie tego, czego potrzebuje `/10x-e2e`, i niczego więcej:

```
DETECT → INSTALL → CONFIG → SEED → AGENT WIRING → RECORD → HAND OFF
```

Każdy krok najpierw sprawdza, czy jego wynik już istnieje, i uzupełnia tylko brak. **Drugie uruchomienie na ukończonym projekcie nie zmienia żadnych plików** — bez nadpisanej konfiguracji, bez drugiej instalacji `playwright-cli`, bez nowej daty `updated`. To jest test tej umiejętności.

Opcjonalny argument: `$ARGUMENTS` — identyfikator ryzyka lub jednoliniowy opis ryzyka dla seeda (pomija pytanie o ryzyko w kroku 4).

## Za co odpowiada ta umiejętność — a czego nie zrobi

Odpowiada za: konfigurację Playwright, `tests/e2e/auth.setup.ts`, test seed, integrację `playwright-cli` oraz sekcję `## E2E` w `context/foundation/test-stack.md`.

W konfiguracji „odpowiada” oznacza **wpis aplikacji `webServer`** (ten, którego `url` jest bazowym URL-em) oraz każde pole rejestrowane przez `test-stack.md`. `/10x-e2e` może później dodać dodatkowe wpisy `webServer` dla serwerów mocków (forma tablicy) i podłączyć swój mock do wpisu aplikacji (`references/playwright-setup-templates.md` → „Who owns what in the config”). Ponowne uruchomienie odczytuje i rejestruje wyłącznie polecenie build + preview, url, port i `reuseExistingServer` wpisu aplikacji oraz nigdy nie dotyka dodatkowych wpisów.

Nie będzie:
- pisać testów E2E poza seedem — od tego jest `/10x-e2e`;
- dotykać workflow CI;
- nadpisywać istniejącego klucza konfiguracji ani specyfikacji bez pytania;
- pisać do pliku zasad agenta (`CLAUDE.md`, `AGENTS.md`, …). Zasady E2E mają znaczenie tylko podczas pracy nad testami E2E, dlatego są dostarczane w `references/e2e-quality-rules.md` umiejętności i ładowane z `/10x-e2e`, a nie w każdej sesji. Blok zasad E2E dodany przez wcześniejszą wersję tej umiejętności pozostaje bez zmian; możesz go usunąć;
- odczytywać ani wyświetlać wartości sekretów, tworzyć użytkowników poza lokalnym stosem ani commitować poświadczeń;
- commitować czegokolwiek — osoba ucząca się przegląda i commituję wynik.

## Konwencje

> **Pytanie użytkownika — niezależne od hosta.** Wszędzie tam, gdzie ta umiejętność mówi *ask the user*, użyj dowolnego narzędzia interaktywnych pytań udostępnianego przez agenta; nie koduj na sztywno jednej nazwy narzędzia. Przed pierwszym pytaniem przeskanuj dostępne narzędzia w poszukiwaniu takiego, które zadaje użytkownikowi ustrukturyzowane pytanie (parametr `question` oraz pole `options`/`choices`), i użyj pierwszego dopasowania. Jeśli żadnego nie ma, zapytaj w zwykłej wiadomości konwersacyjnej, wymieniając opisane opcje, i zaczekaj na odpowiedź — nigdy nie blokuj procedury. Gdy pytasz po raz pierwszy, powiedz, którego narzędzia użyłeś (lub że zastosowano zwykły czat). Pytaj tylko o to, czego nie udało się wykryć.

> **Konwencja schowka.** Wszędzie tam, gdzie ta umiejętność mówi *copy `X` to the clipboard*, przekaż dokładny ciąg `X` do systemowego schowka — spróbuj `pbcopy` (macOS), potem `clip.exe` (Windows/WSL), następnie `xclip -selection clipboard` (Linux) lub `Set-Clipboard` w PowerShell, i przejdź dalej po cichu, jeśli żadne z nich nie istnieje. Następnie wyświetl skopiowane polecenie w osobnej linii z sufiksem `(✓ copied)`.

> **Wartości zależne od narzędzia.** Wszystko, co różni się między narzędziami agentów — katalog umiejętności, docelowy argument `playwright-cli install --skills`, sposób wywołania umiejętności — znajduje się w `references/tool-wiring.md`. Odszukaj to tam według identyfikatora narzędzia; nigdy nie zgaduj.

Prowadź w rozmowie krótką checklistę, po jednej linii na krok (`- [ ] 1. Detect` … `- [ ] 7. Hand off`), i oznacz każdy krok jako `done`, `already in place` lub `changed`. Na jej podstawie tworzony jest końcowy raport.

---

## 1. Detect

Czytaj, nie zapisuj. Zbierz poniższe fakty i pokaż je użytkownikowi jako jedną krótką tabelę przed krokiem 2.

1. **Agent tool.** Ustal identyfikator narzędzia zgodnie z opisem w `references/tool-wiring.md` → „Which tool is this?”: `.10x-cli-manifest.json` w katalogu narzędzia, w którym zainstalowana jest ta umiejętność (`<tool dir>/skills/10x-e2e-setup/` → `<tool dir>/.10x-cli-manifest.json`); w przeciwnym razie najnowszy manifest spośród katalogów manifestów w tabeli; w przeciwnym razie dopasuj katalog, z którego uruchamiana jest ta umiejętność, do katalogów umiejętności z tabeli; w przeciwnym razie zapytaj użytkownika. Z tabeli pobierz **skill dir** i docelowy argument **`--skills`**.
2. **Package manager** z pliku blokady: `package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock`/`bun.lockb` → bun. Używaj go dla każdego polecenia instalacji i uruchamiania.
3. **Stack and commands.** Na podstawie skryptów z `package.json` i konfiguracji frameworka: polecenie build oraz produkcyjne polecenie preview/start. Preferuj build + preview zamiast serwera deweloperskiego.
4. **Port — odczytaj go, nigdy nie zakładaj.** W kolejności:
   - jawny port w konfiguracji frameworka (np. `server.port` w `astro.config.*`, `preview.port`/`server.port` w `vite.config.*`);
   - flaga `--port`/`-p` w skrypcie preview/start;
   - udokumentowany domyślny port frameworka dla jego polecenia preview/start (np. Astro 4321, Vite preview 4173, Next.js 3000).
   Zapisz, skąd pochodzi liczba. Jeśli `E2E_PORT` jest już ustawiony w pliku env (nazwa i numer portu nie są sekretem, więc je odczytaj), to jest port używany przez uruchomienie: użytkownik odpowiedział na pytanie o port przy wcześniejszym uruchomieniu, więc nie pytaj ponownie.
5. **Czy port jest wolny?** Sprawdź port używany przez uruchomienie (`E2E_PORT`, jeśli jest ustawiony, w przeciwnym razie wykryty port), zanim na nim polegasz: `lsof -nP -iTCP:<port> -sTCP:LISTEN` (macOS/Linux) lub `netstat -ano | findstr :<port>` (Windows); działa również `nc -z localhost <port>`. Jeśli coś nasłuchuje, powiedz to jasno i podaj nazwę procesu, jeśli potrafisz: z `reuseExistingServer` poza CI Playwright będzie **po cichu testował dowolną aplikację, która już tam działa**. Zaproponuj dwa wyjścia — zatrzymanie tego procesu albo ustawienie `E2E_PORT=<free port>` w pliku env (konfiguracja go odczytuje). Nigdy samodzielnie nie wybieraj nowego domyślnego portu.
6. **Existing Playwright.** `@playwright/test` w `package.json`; `playwright.config.*` (przeczytaj w całości: `testDir`, `use.baseURL`, `webServer`, projekty, `storageState`, `trace`, `screenshot`); istniejące specyfikacje (`*.spec.ts`, `*.setup.ts`); istniejący seed (plik o nazwie `seed.spec.ts` lub pole `seed` z `test-stack.md`).
7. **Unit-test runner overlap.** Jeśli skonfigurowano runner testów jednostkowych (np. Vitest, Jest), sprawdź jego globy include. Jeśli również zbierałyby `tests/e2e/**/*.spec.ts`, specyfikacje E2E muszą zostać tam wykluczone — odnotuj to na krok 3.
8. **Auth approach.** Sprawdź middleware / guardy routingu, stronę logowania i jej formularz oraz dostawcę uwierzytelniania (np. Supabase, Auth.js, Clerk, niestandardową sesję). Zapisz: chronione trasy, ścieżkę logowania, stronę docelową po zalogowaniu oraz czy dostawca działa lokalnie (np. `supabase/config.toml` → lokalny stos przez `npx supabase start`). Brak logowania → `auth: none`.
9. **App env.** Który ignorowany przez git plik env odczytuje aplikacja (np. `.env`), czy preview odczytuje inny plik (zobacz `references/playwright-setup-templates.md` → Preview env) oraz czy URL backendu w nim wskazuje na lokalny stos. Odczytuj tylko **nazwy** zmiennych, nigdy wartości — z wyjątkiem sprawdzenia, czy URL backendu jest lokalny.
10. **Test plan and state.** `context/foundation/test-plan.md` (ryzyka na poziomie przeglądarki) oraz `context/foundation/test-stack.md` (istniejąca sekcja `## E2E`).

Jeśli projekt nie ma aplikacji webowej do obsłużenia (w ogóle nie ma polecenia server/preview), zatrzymaj się i powiedz, że E2E wymaga uruchamialnej aplikacji.

## 2. Install

Tylko to, czego brakuje:

- `@playwright/test` nie ma w `package.json` → dodaj go jako zależność deweloperską wykrytym menedżerem pakietów (`npm i -D @playwright/test`, `pnpm add -D @playwright/test`, `yarn add -D @playwright/test`, `bun add -d @playwright/test`).
- Przeglądarka: `npx playwright install chromium` (użyj odpowiednika exec menedżera pakietów). To no-op, gdy przeglądarka już istnieje, i nie zmienia plików projektu.

Zapisz zainstalowaną wersję (`npx playwright --version`).

## 3. Config

Użyj `references/playwright-setup-templates.md`.

- **Najpierw `.gitignore`** (przed pierwszym wywołaniem `playwright-cli`): dopisz brakujące linie Playwright z szablonu (co najmniej `playwright/.auth/` i `.playwright-cli/`, które tworzy pierwsze wywołanie `playwright-cli`, z snapshotami i logami konsoli mogącymi zawierać poświadczenia), oraz potwierdź, że plik env z poświadczeniami jest ignorowany.
- **Uruchom aplikację do eksploracji.** Kroki 3 i 4 eksplorują stronę logowania oraz przepływ seeda za pomocą `playwright-cli`, więc aplikacja musi działać: uruchom polecenie build, a następnie uruchom polecenie preview na porcie z kroku 1.4–1.5 **w tle** (te same polecenia, które uruchamia wpis `webServer`; najpierw sprawdź uwagi o stosie w szablonie). Zatrzymaj ją oraz każdy demon pozostawiony przez nią **przed każdym uruchomieniem `playwright test`**, aby `webServer` uruchamiał serwer i był jego właścicielem. Pozostawiony uruchomiony serwer jest po cichu używany ponownie i ukrywa nieaktualny build. Przekaż nazwaną sesję przy każdym wywołaniu `playwright-cli` (`-s=<repo-name>`); domyślna sesja jest współdzielona przez każdy projekt na maszynie (zobacz `references/tool-wiring.md` → „One browser session per project”). `playwright-cli fill` wypisuje wpisaną wartość w swoim wyniku i logach: gdy wpisujesz hasło użytkownika testowego, nie pokazuj użytkownikowi tej linii.
- **Brak konfiguracji** → utwórz `playwright.config.ts` z szablonu, wypełnionego wykrytymi wartościami: stała `PORT` domyślnie używa wykrytego portu i najpierw odczytuje `E2E_PORT`; `webServer` uruchamia build + preview **na tym porcie** (port przekazany jawnie do polecenia preview), `url: baseURL`, `reuseExistingServer: !process.env.CI`; `use.baseURL`; projekt `setup` dopasowujący `*.setup.ts`, którego plik sesji to `playwright/.auth/user.json`, ładowany przez `use.storageState` przez projekt przeglądarki, który od niego zależy; `trace: 'on-first-retry'` oraz `screenshot: 'only-on-failure'`; env ładowane jawnie z ignorowanego przez git pliku env.
- **Konfiguracja istnieje** → dodaj tylko brakujące elementy (szablon → „Extending an existing config”). Jeśli klucz istnieje z inną wartością, zapytaj użytkownika przed jego zmianą i pokaż obie wartości. Klucze, które już się zgadzają, pozostają identyczne bajt po bajcie. Gdy `webServer` jest tablicą, porównaj tylko wpis aplikacji; pozostałe wpisy to serwery mocków `/10x-e2e`, więc pozostaw je bez zmian.
- **Auth setup** (pomiń, gdy `auth: none`): jeśli nie istnieje `*.setup.ts`, otwórz stronę logowania przez `playwright-cli` (krok 5 go instaluje; `npx -y @playwright/cli` działa wcześniej), zrób snapshot i napisz `tests/e2e/auth.setup.ts` z szablonu, używając zaobserwowanych nazw dostępności. Loguje się on przez rzeczywiste UI przy użyciu `E2E_USERNAME` / `E2E_PASSWORD` z pliku env i zapisuje `playwright/.auth/user.json`.
- **Test user**: jeśli `E2E_USERNAME` / `E2E_PASSWORD` nie są ustawione, postępuj zgodnie z sekcją „Test user (local only)” w szablonie — potwierdź, że backend jest lokalny, utwórz tam użytkownika (lub poproś użytkownika, aby to zrobił), i umieść te dwie zmienne w ignorowanym przez git pliku env.
- **`.env.example`**: niezależnie od tego, czy użytkownik testowy już istniał, dodaj te dwie nazwy (bez wartości), jeśli ten plik istnieje i ich nie zawiera.
- **Nakładanie się runnera jednostkowego** z kroku 1.7: zapytaj przed dodaniem katalogu E2E do listy exclude tego runnera.

## 4. Seed

Seed jest wzorcem, który kopiuje każdy wygenerowany test (`references/seed-test-pattern.md`), więc musi być mały, poprawny i zielony.

- **Seed istnieje** (ścieżka `seed` z `test-stack.md` albo `seed.spec.ts`) → nie nadpisuj go; tylko go uruchom (poniżej).
- **Brak seeda → wybierz jedno ryzyko.** Jeśli `$ARGUMENTS` wskazuje jedno, użyj go. W przeciwnym razie, jeśli istnieje `context/foundation/test-plan.md`, weź jego ryzyka **na poziomie przeglądarki** i wybierz to, które jest **najszybsze do doprowadzenia do zielonego bez mocków**, np. przekierowanie przez auth-gate zamiast przepływu wywołującego zewnętrzne API. Ryzyko jest na poziomie przeglądarki, gdy jego wiersz w tabeli ryzyko-odpowiedź planu testów wskazuje e2e jako (część) najtańszej warstwy albo gdy faza wdrożenia E2E wymienia je w scenariuszu. W obu przypadkach nie jest ono na poziomie przeglądarki, gdy ten wiersz odradza e2e (ma to pierwszeństwo przed wymienieniem go w fazie wdrożenia) (oba warunki zachodzą: najtańszą warstwą jest unit/integration **oraz** kolumna antywzorców ostrzega przed e2e; milcząca kolumna antywzorców go nie wyklucza). Pozostaw pozostałe dla `/10x-e2e`. Tylko gdy nie ma planu testów, zapytaj użytkownika o jedno ryzyko na poziomie przeglądarki i obserwowalny wynik, który je potwierdza. Ryzyko bez identyfikatora (opisane przez użytkownika) otrzymuje krótki slug kebab-case, np. `auth-gate-roundtrip`.
- **Czy wynik jest zbudowany?** Zbadaj przepływ, zanim zdecydujesz się na ryzyko. Jeśli obserwowalny wynik nie odpowiada temu, co aplikacja robi dzisiaj (np. użytkownik oczekuje powrotu do chronionej strony, ale logowanie zawsze kończy się na `/`), powiedz to użytkownikowi. Następnie utwórz seed dla części, która jest zbudowana, i zapisz resztę jako niezbudowaną albo wybierz inne ryzyko. Nigdy nie asertuj zachowania, którego aplikacja nie posiada.
- **Napisz** `tests/e2e/seed.spec.ts` (lub w istniejącym katalogu E2E projektu), zgodnie z czterema wzorcami w `references/seed-test-pattern.md`: lokatory oparte na rolach, samowystarczalny setup → action → assertion → cleanup, oczekiwanie na stan oraz nazwa testu wskazująca ryzyko. Najpierw zbadaj przepływ za pomocą `playwright-cli` i użyj nazw dostępności pokazanych przez snapshot. Zaczekaj, aż formularz będzie interaktywny, zanim zaczniesz pisać (zobacz wzorzec seeda: dane wpisane do formularza, który nie zakończył jeszcze hydratacji, są tracone). Dodaj komentarz o pochodzeniu z identyfikatorem ryzyka. Seed, którego ryzykiem jest ścieżka wylogowanego użytkownika, rezygnuje z zapisanej sesji (zobacz wzorzec seeda).
- **Uruchom go do zielonego z zimnego serwera** za pomocą polecenia dla pojedynczej specyfikacji (projekt `setup` uruchamia się najpierw jako zależność). Najpierw zatrzymaj serwer eksploracyjny i potwierdź, że nic nie nasłuchuje na porcie (polecenie z kroku 1.5 nic nie wypisuje), aby `webServer` sam zbudował i uruchomił aplikację. Ciepły serwer ukrywa wyścigi hydratacji i nieaktualne buildy, więc seed, który stał się zielony tylko przeciwko takiemu serwerowi, nie jest potwierdzony. Jeśli backend to lokalny stos, upewnij się, że działa. Gdy jest czerwony: przeczytaj błąd i trace, popraw seed lub setup — nigdy nie osłabiaj asercji, dopóki nie przestanie być możliwe jej niepowodzenie, i nigdy nie pomijaj testu. Następnie zadaj pytanie kontrolne: czy ta asercja zakończyłaby się niepowodzeniem, gdyby ryzyko się zmaterializowało? Jeśli nie, wzmocnij ją. (Pełna celowa kontrola przez psucie należy do `/10x-e2e`.)

## 5. Agent wiring

Postępuj zgodnie z `references/tool-wiring.md` → „Wiring `playwright-cli` into the agent”, używając identyfikatora narzędzia z kroku 1.1: globalny CLI (tylko jeśli `playwright-cli --version` kończy się niepowodzeniem), następnie command skill z docelowym argumentem `--skills` tego narzędzia (tylko jeśli nie znajduje się już w katalogu umiejętności narzędzia), a następnie krok kopiowania tam, gdzie wskazuje tabela. Zgłoś, co dodało `install` (`.playwright/`, linię `.playwright-cli/` w `.gitignore`).

## 6. Record

Zapisz sekcję `## E2E` w `context/foundation/test-stack.md` dokładnie tak, jak definiuje ją `references/test-stack-e2e-schema.md` — każde wymagane pole, wypełnione faktami z kroków 1–5 (dla `web server command` tylko polecenie build + preview wpisu aplikacji). Zachowaj resztę pliku. Jeśli każde pole poza `updated` już pasuje, pozostaw plik nietknięty. Utwórz `context/foundation/`, jeśli nie istnieje.

## 7. Hand off

Wybierz kolejne ryzyko z `test-plan.md`: ryzyko o najwyższym priorytecie, które (a) **nie jest ryzykiem seeda**, (b) jest **na poziomie przeglądarki** (reguła z kroku 4, która odczytuje kolumnę najtańszej warstwy z planu testów) oraz (c) **nie ma jeszcze specyfikacji** (wyszukaj jego identyfikator w nagłówkach pochodzenia i nazwach testów katalogu E2E). Skopiuj `/10x-e2e <risk-id>` do schowka. Jeśli żadne ryzyko nie spełnia warunków albo nie ma planu testów, skopiuj `/10x-e2e` bez ryzyka (poprosi o jedno). Nigdy nie przekazuj ryzyka seeda. Następnie wypisz:

```
E2E setup — done

[checklist: each step with done / already in place / changed]

Created or changed:
- [files, one per line — or "nothing: the project was already set up"]

Review before you commit:
- tests/e2e/seed.spec.ts — the pattern every generated test will copy
- playwright.config.ts (port [port] from [source]; override with E2E_PORT)

Never commit: playwright/.auth/, the env file with E2E_USERNAME / E2E_PASSWORD.

Next — write the first reviewed test for a risk:
→ /10x-e2e [risk-id, or nothing] (✓ copied)
```

Dodaj jedną linię z formą wywołania dla wykrytego narzędzia z tabeli w `references/tool-wiring.md`, gdy różni się od formy slash. Następnie ZATRZYMAJ SIĘ.

## References

- `references/tool-wiring.md` — katalog umiejętności, katalog manifestu, docelowy argument `--skills`, wywołanie dla każdego narzędzia; instalacja `playwright-cli` oraz to, co zmienia.
- `references/playwright-setup-templates.md` — szablony konfiguracji, auth setup, użytkownika testowego i `.gitignore`.
- `references/test-stack-e2e-schema.md` — kontrakt sekcji `## E2E` odczytywany przez `/10x-e2e` i `/10x-tdd`.
- `references/seed-test-pattern.md` — cztery wzorce przenoszone przez seed wraz z przykładem (współdzielone z `/10x-e2e`).
- `references/e2e-quality-rules.md` — zasady E2E, których przestrzega seed i które egzekwuje `/10x-e2e`, wraz z uzasadnieniem (współdzielone z `/10x-e2e`).