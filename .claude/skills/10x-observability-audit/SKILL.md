---
name: 10x-observability-audit
description: >
  Audit an existing codebase for code logic that hides production errors:
  swallowed exceptions, errors turned into redirects or 200s, lost stack
  traces and causes, code paths running outside the error tracker, logs that
  never become alerts. Picks the critical user flows from
  context/foundation (shape-notes, PRD, roadmap) or asks for 2-3 areas,
  fans out full-stack subagent audits, optionally proves gaps at runtime
  with a local fake error-tracker endpoint, and writes a new dated report
  under context/audits/observability/ on every run. Use whenever the user
  asks why production errors are missing or hard to debug, wants an
  observability / monitoring / error-tracking / logging audit, asks "what
  does Sentry (or Datadog, Rollbar, CloudWatch…) miss", "audyt
  observability", "czego nie widzimy w monitoringu", or wants to re-run a
  previous observability audit. Tech-stack agnostic.
argument-hint: "[area ...] [--runtime] [--verify <report-path>] [--out <dir-or-file>]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
  - TaskList
---
# Audyt obserwowalności: gdzie znikają błędy produkcyjne?

Celem jest jedno pytanie, zadawane dla każdego krytycznego przepływu użytkownika: **gdy to zepsuje się na produkcji, czy ktokolwiek się o tym dowie i czy będzie w stanie ustalić dlaczego?**

Większość baz kodu nie przechodzi tego testu z kilku systemowych powodów, a nie w setkach niepowiązanych miejsc. Niektóre ścieżki kodu działają poza zakresem trackera błędów. Awarie wracają jako zwykłe odpowiedzi. Obiekty błędów są odrzucane przy pierwszym `catch`. Filtry prywatności usuwają dane diagnostyczne. Wdrożenia nie są oznaczane. Zadaniem audytu jest znaleźć te mechanizmy, pokazać konkretne miejsca, w których szkodzą przepływom mającym znaczenie, oraz udowodnić najpoważniejsze z nich. Nie tworzy on listy w stylu lintera, zawierającej każdy pusty `catch`.

**Przedmiotem jest kod aplikacji.** Audyt pyta, co kod robi z awarią, gdy potok monitorowania już istnieje: czy ją rzuca, przechwytuje, loguje, raportuje, spłaszcza czy odrzuca? To, czy produkt do logowania lub tracker błędów jest włączony, jest warunkiem wstępnym, a nie pytaniem audytu. Często jest to ustawiane w panelu platformy lub dostawcy, więc repozytorium nie może tego pokazać. Zakładaj, że potok działa na produkcji, chyba że użytkownik mówi inaczej. Konfiguracja, której repozytorium nie zawiera, jest **nieznana, a nie brakująca**, i nigdy nie staje się przyczyną źródłową.

Umiejętność nigdy nie modyfikuje audytowanego kodu w głównym drzewie roboczym. Zapisuje jeden nowy raport na uruchomienie. Dowód środowiska uruchomieniowego powstaje wyłącznie w jednorazowej, izolowanej kopii.

## Kiedy używać, kiedy pominąć

**Użyj, gdy** projekt ma kod działający na produkcji (lub wkrótce będzie działać), a użytkownik podejrzewa, że błędy są niewidoczne, zaszumione lub niemożliwe do zdiagnozowania. Użyj także przed uruchomieniem, po incydencie, w którym „nie mieliśmy logów”, albo aby ponownie sprawdzić wcześniejszy audyt.

**Pomiń, gdy** użytkownik chce naprawić jeden konkretny znany błąd: to jest zwykłe debugowanie. Pomiń także, gdy chce *wybrać* dostawcę monitorowania (`/10x-infra-research`) lub przeprowadzić ogólną kontrolę kondycji projektu (`/10x-health-check`).

## Dane wejściowe

- **Dokumenty podstawowe (opcjonalne, preferowane):** `context/foundation/shape-notes.md`, `context/foundation/prd.md`, `context/foundation/roadmap.md`. Informują, które przepływy są istotne dla użytkowników i biznesu, dzięki czemu audyt przeznacza na nie swój budżet.
- **Objaw (opcjonalny, najcenniejszy):** to, co użytkownik już widzi, np. „żądania pojawiają się w logach, ale błędy, których szukam, nie”. Taki objaw potwierdza, że potok działa, i kieruje audyt na ścieżki kodu, które gubią błędy. Użyj go do ukierunkowania wyboru obszarów i briefów dla audytorów.
- **Argumenty (opcjonalne):** nazwy obszarów (np. `login checkout "admin import"`) zastępują wybór obszarów. `--runtime` wybiera dowód środowiska uruchomieniowego bez pytania. `--verify <report>` ponownie sprawdza ustalenia wcześniejszego raportu zamiast szukać nowych (zobacz *Tryb weryfikacji*). `--out <dir-or-file>`, lub wskazanie przez użytkownika lokalizacji słowami, zastępuje miejsce zapisu raportu (zobacz Krok 6).
- **Poprzednie raporty (opcjonalne):** `*.md` w katalogu raportów (domyślnie `context/audits/observability/`).

## Przebieg pracy

Śledź kroki za pomocą TaskCreate/TaskUpdate. Audyt jest długi, a użytkownik powinien widzieć, na jakim jest etapie.

### Krok 0 — Warunki wstępne i tożsamość uruchomienia

1. Potwierdź, że cwd jest bazą kodu (manifest projektu, katalogi źródłowe). Jeśli nie, zatrzymaj się i powiedz to.
2. Zapisz tożsamość uruchomienia. Każdy raport jest zakotwiczony dokładnie w tym, co zostało poddane audytowi, co umożliwia porównywanie ponownych uruchomień:
   - data (`date +%Y-%m-%d`) i czas (`date +%H:%M`), bieżący commit (`git rev-parse --short HEAD`), gałąź oraz to, czy drzewo jest zmodyfikowane (`git status --porcelain`). Zmodyfikowane drzewo jest w porządku, ale zaznacz to w raporcie.
3. Wyświetl wcześniejsze raporty w katalogu raportów (domyślnie `context/audits/observability/`): `ls <report-dir> 2>/dev/null`.
   Przeczytaj frontmatter najnowszego z nich: objęte obszary, commit, otwarte ustalenia. Wybierz go według klucza `date`, który zawiera czas; nazwy plików zawierają tylko dzień. Użyjesz go w Kroku 2 i Kroku 6.

### Krok 1 — Odkryj stos obserwowalności

Przed audytem przepływów zbuduj **model przechwytywania**: krótki opis, oparty na dowodach, tego, jak awaria przechodzi z kodu do człowieka. Zrób to samodzielnie (wymaga osądu i jest niewielkie). Cytuj plik:wiersz dla każdego twierdzenia.

- **Środowisko uruchomieniowe i platforma:** długo działający serwer, funkcje serverless/edge, kontenery, mobile, przeglądarkowe SPA, framework SSR, procesy w tle, cron, kolejki.
- **Tracker błędów:** Sentry, Datadog, Rollbar, Bugsnag, Honeybadger, New Relic, eksporter OpenTelemetry, Application Insights, Crashlytics lub brak. Znajdź *każde* miejsce inicjalizacji i odnotuj, co każde z nich obejmuje.
- **Granice przechwytywania:** gdzie tracker faktycznie otrzymuje aktywnego klienta? Globalny handler procesu, middleware na żądanie, wrapper na trasę, integracja frameworka, filtr wyjątków, granica błędów. Centralne pytanie brzmi: **które ścieżki kodu wykonują się poza jakąkolwiek granicą**. Przykłady: middleware ustawione przed trackerem, trasy rezygnujące z niego, strumieniowane body odpowiedzi, zadania w tle po odpowiedzi, procesy workerów bez własnej inicjalizacji, aplikacja po stronie klienta.
- **Logowanie:** logger(y), dokąd trafiają logi (usługa logów platformy, plik, stdout), czy wiersze logów kiedykolwiek stają się alertami lub zgłoszeniami oraz jak logger serializuje obiekty błędów.
- **Czyszczenie i próbkowanie:** hooki w stylu `beforeSend`, filtry PII, współczynniki próbkowania, listy ignorowania, head-sampling logów.
- **Tożsamość wdrożenia:** tagi wydania/wersji i środowiska; source maps lub symbole debugowania; czy ruch preview/staging można odróżnić od produkcyjnego.

Ten krok powinien być krótki. To kontekst dla audytu kodu, a nie sam audyt. Oznacz każde twierdzenie jako **w repozytorium** (cytowany plik:wiersz) lub **poza repozytorium** (ustawienie panelu lub platformy, którego nie widzisz). Dla elementów poza repozytorium zapisz założenie („założono: zbieranie logów platformy jest włączone”) zamiast ustalenia. Jeśli cały audyt zależy od jednego z nich (nigdzie w kodzie nie ma SDK trackera, a użytkownik nie wspomniał o objawie), zadaj użytkownikowi jedno pytanie o to, co widzi na produkcji, zanim przejdziesz dalej. Nie zgaduj.

Umieść model przechwytywania w raporcie. Podagenci również go potrzebują, aby każdy z nich nie odkrywał go od nowa.

### Krok 2 — Wybierz obszary (przepływy, które mają znaczenie)

Wybierz **2–4 krytyczne przepływy użytkownika**, każdy audytowany pełnostosowo (UI → API → usługi → dane/wywołania zewnętrzne → praca w tle). Rozstrzygaj je w tej kolejności:

1. **Argumenty:** użyj ich zgodnie z podaniem.
2. **Dokumenty podstawowe:** przeczytaj trzy pliki, które istnieją. Wybierz przepływy, których awaria zaszkodziłaby najbardziej: główną pętlę wartości (to, po co przychodzą użytkownicy), tożsamość/dostęp (logowanie, rejestracja, uprawnienia), pieniądze lub nieodwracalne zapisy (płatności, publikowanie, importy, usuwanie danych) oraz wszystko, co roadmapa oznacza jako w toku lub niedawno wydane (nowy kod, najmniej sprawdzony w boju). Przedstaw swój wybór z jednozdaniowym uzasadnieniem dla każdego i pozwól użytkownikowi go dostosować (AskUserQuestion, z Twoim wyborem jako zalecaną opcją).
3. **Brak dokumentów podstawowych:** zapytaj użytkownika o 2–3 obszary do pełnostosowego przeglądu (AskUserQuestion). Zaproponuj 3–4 konkretne kandydatury wywnioskowane ze struktury tras/stron/modułów, aby nie odpowiadał po omacku.

**Rotacja przy ponownych uruchomieniach.** Jeśli istnieją wcześniejsze raporty, preferuj przepływy, których nie obejmowały, lub które obejmowały przy starszym commicie, i zaznacz to („login i CMS zostały poddane audytowi 2026-09-24; to uruchomienie proponuje checkout i notifications”). Użytkownik nadal może wybrać ponowny audyt tych samych obszarów; raport wtedy zapisuje, jak zmieniło się każde wcześniejsze ustalenie.

### Krok 3 — Rozdziel audyty (równoległe podagenty)

Uruchom w jednej wiadomości, aby działały równolegle:

- **Jeden audytor na obszar** (tylko do odczytu).
- **Jeden audytor infrastruktury kodowej** (tylko do odczytu). Obejmuje przekrojowy *kod*, za który nie odpowiada żaden obszar: kod inicjalizacji trackera, granice i kolejność middleware, serializację błędów przez logger, hooki czyszczenia, tagowanie wydań w kodzie, punkty wejścia zadań w tle/workerów, globalne handlery po stronie klienta oraz przeszukanie całego repozytorium z liczbami. Nie audytuje ustawień panelu ani platformy.

Użyj briefów z `references/auditor-briefs.md`. Wklej model przechwytywania z Kroku 1 do każdego briefu wraz z objawem użytkownika (jeśli występuje) i znanymi problemami z wcześniejszych raportów lub dokumentów triage. Sklasyfikuj każde ustalenie według taksonomii i rubryki ważności z `references/gap-taxonomy.md`, aby wyniki obszarów dało się łatwo połączyć.

Gdy działają, przygotuj Krok 4, jeśli ma zastosowanie.

### Krok 4 — Dowód środowiska uruchomieniowego (opcjonalny, izolowany)

Statyczne czytanie mówi „to *powinno* być niewidoczne”. Sonda środowiska uruchomieniowego pokazuje, że tak jest. Zaoferuj ten krok, gdy audyt wykrył krytyczne luki w pokryciu, a aplikację można uruchomić lokalnie. Uruchom go, gdy użytkownik przekazał `--runtime` lub wyraził zgodę.

Postępuj zgodnie z `references/runtime-probes.md`. Najważniejsze zasady:

- Pracuj **wyłącznie w izolowanej kopii**: git worktree (opcja podagenta `isolation: "worktree"`) lub tymczasowy clone. Nigdy nie dotykaj głównego drzewa, nigdy nie wykonuj commitu, nigdy nie pushuj, nigdy nie wdrażaj.
- Skieruj tracker błędów na **lokalny fałszywy endpoint przyjmujący dane** (`scripts/fake-ingest.mjs`) zamiast na rzeczywistą usługę. Nigdy nie wysyłaj zdarzeń sondy do produkcyjnego trackera i nigdy nie używaj produkcyjnych baz danych ani kont zewnętrznych dostawców.
- Wstrzyknij ustalony katalog postaci awarii (rzuconą w handlerze, rzuconą we wczesnym middleware, błąd zwrócony jako 5xx bez rzucania, zignorowany wynik błędu, nieobsłużone odrzucenie, awarię zadania w tle, obiekt błędu przekazany do loggera…) z wyzwalaczem sondy (np. `?probe=<id>`). Zapisz wynik HTTP / dane wyjściowe konsoli platformy / to, co dotarło do fałszywego trackera.
- Zautomatyzuj uruchomienie (skrypt `suite`), aby można było je powtórzyć identycznie. Zachowanie harnessu umożliwia później dowód przed/po.

Jeśli aplikacja nie może się uruchomić (brakująca infrastruktura, sekrety, płatne usługi), zgłoś dokładną przeszkodę. Oznacz dotknięte ustalenia jako *wyłącznie statyczne*; nigdy nie zgaduj wyników środowiska uruchomieniowego.

### Krok 5 — Zweryfikuj, a następnie zsyntetyzuj

Podagenci zgłaszają zbyt dużo. Przed raportem:

- **Wyrywkowo sprawdź** samodzielnie 3–5 najbardziej zaskakujących lub najpoważniejszych twierdzeń (przeczytaj cytowane wiersze, uruchom regex, sprawdź źródło SDK w katalogu zależności). Odrzuć lub obniż ważność wszystkiego, co się nie potwierdza, i zaznacz w raporcie, że zostało to zweryfikowane.
- **Usuń duplikaty** między obszarami. Kilka ustaleń obszarowych to często jeden mechanizm: „12 tras nie wywołuje reportera” to *jedna* luka pokrycia z 12 lokalizacjami, a nie 12 ustaleń.
- **Odrzuć ustalenia dotyczące warunków wstępnych.** „Logowanie nie jest włączone w konfiguracji wdrożenia”, „brak przekazywania logów”, „brak reguł alertów w repozytorium” lub „brak klucza trackera w przykładowym pliku env” nie są ustaleniami, gdy ustawienie może znajdować się poza repozytorium. Przenieś je na listę *Założeń* raportu. Zachowaj element konfiguracji tylko wtedy, gdy kod, który możesz zacytować, aktywnie pogarsza zdarzenia (hook czyszczenia, który usuwa stack traces, próbkowanie błędów poniżej 100%, lista ignorowania pasująca do błędów first-party).
- **Nazwij systemowe przyczyny źródłowe** (zwykle 3–6). To najcenniejsza część raportu, ponieważ naprawienie jednej przyczyny źródłowej zamyka wiele ustaleń. Każda przyczyna źródłowa musi być mechanizmem w kodzie z dowodem plik:wiersz: gdzie błąd jest przechwytywany, konwertowany, pozbawiany danych lub wykonywany poza granicą. „Monitoring nie jest skonfigurowany” nigdy nie jest przyczyną źródłową. Nie da się tego zweryfikować z repozytorium, a gdyby było prawdą, ukryłoby każdą lukę na poziomie kodu za jedną poprawką, która nie pomaga.
- **Uporządkuj poprawki** według usuniętej ślepoty na jednostkę wysiłku. Poprawki kodu o szerokim zasięgu (jedna globalna granica, serializacja loggera, zakres czyszczenia, współdzielony helper error-to-response zachowujący przyczynę) zwykle powinny poprzedzać lokalne.

### Krok 6 — Napisz raport (nowy plik dla każdego uruchomienia)

Napisz raport, używając `references/report-template.md`, do:

```
<project-root>/context/audits/observability/<YYYY-MM-DD>_<slug>.md
```

- `<project-root>` to katalog główny audytowanego projektu (`git rev-parse --show-toplevel` lub cwd poza gitem), a nie katalog umiejętności.
- `<slug>` to audytowane obszary w kebab-case, połączone przez `-` (np. `login-checkout`) albo `verify-<areas>` w trybie weryfikacji.
- Utwórz katalog, jeśli jest potrzebny.
- **Nadpisanie przez użytkownika:** jeśli użytkownik przekazał `--out` lub wskazał inną lokalizację, użyj jej. Katalog otrzymuje tę samą nazwę pliku `<YYYY-MM-DD>_<slug>.md`; ścieżka kończąca się na `.md` jest używana bez zmian. We wszystkich pozostałych przypadkach użyj domyślnej i nie pytaj o nią.

- **Nigdy nie nadpisuj ani nie edytuj wcześniejszego raportu.** Jeśli ścieżka istnieje, dodaj `-2`, `-3`. Wcześniejsze raporty są historią, z którą porównują późniejsze uruchomienia.
- Frontmatter raportu zapisuje tożsamość uruchomienia, obszary, tryb, status dowodu środowiska uruchomieniowego i link do poprzedniego raportu. Następne uruchomienie opiera się na tym frontmatter, więc zachowaj stabilność jego kluczy.
- Jeśli istnieje poprzedni raport, wypełnij **Zmiany od ostatniego audytu**: dla każdego wcześniejszego ustalenia w obszarze, który objąłeś ponownie, oznacz je jako `fixed`, `still open`, `changed` lub `not re-checked`, wraz z dowodami.
- Każde ustalenie ogranicz do jego lokalizacji, kategorii, ważności, **tego, co dzieje się na produkcji, gdy nastąpi awaria**, oraz jednoliniowego kierunku poprawki. Konsekwencja produkcyjna sprawia, że ustalenie jest możliwe do wdrożenia, więc nigdy jej nie pomijaj.

### Krok 7 — Przekaż wyniki

Powiedz użytkownikowi w kilku wierszach: ścieżkę raportu, 3 najważniejsze przyczyny źródłowe, liczbę ustaleń według ważności, co zostało potwierdzone w środowisku uruchomieniowym, a co jest wyłącznie statyczne, oraz zalecaną pierwszą poprawkę. Zaproponuj kolejne kroki:

- potwierdzenie konkretnej poprawki uruchomieniem przed/po na tym samym zestawie sond (zobacz *Tryb weryfikacji*);
- przekształcenie najważniejszej poprawki w zmianę za pomocą `/10x-new` + `/10x-plan`.

Wspomnij, że izolowane worktree lub pliki harnessu z Kroku 4 nadal istnieją i gdzie się znajdują. Nie usuwaj ich bez pytania, ponieważ są potrzebne do dowodu przed/po.

## Tryb weryfikacji (`--verify <report>`)

Użyj tego po wdrożeniu poprawek lub aby udowodnić, że proponowana poprawka działa. Przeczytaj wskazany raport i ponownie sprawdź każde ustalenie: przeczytaj ponownie cytowany kod, a jeśli raport zawiera harness sondy, uruchom ponownie ten sam zestaw. Utwórz nowy raport z datą i `mode: verify`, którego treść składa się głównie z **Zmian od ostatniego audytu** i tabeli przed/po. Ten sam katalog sond przed i po zmienia „uważamy, że jest naprawione” w dowód.

## Zasady

- **Kod ponad konfiguracją.** Zakładaj, że logi i tracker są zbierane na produkcji. Pytanie brzmi, co przekazuje im kod. Brakujące ustawienie, którego nie możesz zobaczyć w repozytorium, jest założeniem do potwierdzenia, a nie ustaleniem.
- **Najpierw pokrycie, potem wierność, następnie szum.** Awaria, której tracker nigdy nie widzi, ma większe znaczenie niż taka, którą widzi bez stack trace, a ta z kolei ma większe znaczenie niż taka, którą widzi zbyt często.
- **Oceniaj według tego, co otrzyma osoba reagująca.** Dla każdej luki zapytaj, co inżynier on-call zobaczyłby o 3 nad ranem: alert? zgłoszenie ze stack trace i użytkownikiem/trasą/encją? wiersz logu, którego musiałby już wiedzieć, aby go wyszukać? nic?
- **Łagodne pogorszenie działania potrzebuje własnego sygnału.** Fallbacki, które nie blokują użytkowników, są dobre. Fallbacki, które jednocześnie usuwają jedyny znak awarii, są ustaleniami.
- **Prywatność jest ograniczeniem, a nie wymówką.** Zalecaj poprawki, które zachowują działanie czyszczenia danych (hash lub id zamiast email, zachowaj nazwy/kody błędów i stack traces, odrzucaj tylko wartości). Nigdy nie zalecaj wysyłania PII.
- **Sformułowania niezależne od stosu.** Opisuj mechanizmy („trasa rezygnuje z wrappera raportowania”), a następnie konkretne lokalne API. Taksonomia działa dla każdego języka lub frameworka.