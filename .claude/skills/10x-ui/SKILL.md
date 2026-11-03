---
name: 10x-ui
description: >
  Audit and improve ONE view that already renders, as a normal 10x change with a
  design-system contract — audit into 3–5 charges (missing tokens, missing shared
  component, accidental architecture), fix the contract before the pixels, cover a
  7-state matrix, gate with a screenshot, and leave a rule so the next agent keeps
  using the tokens and components. The UI entry point to the chain: it pre-audits the
  view, suggests a change-id and hands you /10x-new, then the audit brief for
  /10x-research → /10x-plan → /10x-implement, sharing the same change folder and Progress. Use when the user wants
  a theme, a restyle, "make it prettier", shadcn/Tailwind work, design tokens, dark
  mode, a visible-focus pass, or cleanup of UI an agent built feature by feature. Not a
  generator for a view that does not exist yet, not a component catalog, not a
  Playwright course.
argument-hint: "<change-id> | <route or view file>"
---
# 10x-ui — kontrakt systemu projektowego dla pojedynczej zmiany wizualnej

UI to zwykła zmiana 10x. Nie otwieraj czatu vibes w wątku CRUD i nie zaczynaj
od promptu, który mówi tylko „zrób to ładniej”.

**Ta umiejętność iteruje po UI, które już istnieje.** Zakłada widok, który możesz otworzyć i
zrobić mu zrzut ekranu: markup się renderuje, dane przepływają, ekran spełnia swoje zadanie i po prostu nie jest
wystarczająco dobry. Utworzenie tego pierwszego widoku to zwykła praca nad funkcją w ramach Core Skills Chain; ta
umiejętność przejmuje pracę w chwili, gdy jest on na ekranie.

Nie zastępuje łańcucha ani nie uruchamia za Ciebie jego umiejętności. Jest punktem
wejścia: wstępnie audytuje widok, sugeruje change-id i przekazuje Ci `/10x-new`, następnie
przekazuje brief audytu do `/10x-research`. Potem kształtuje plan, który zapisuje `/10x-plan`,
i dodaje kontrole UI do każdej fazy `/10x-implement`. Uruchamiasz każde polecenie; te umiejętności
zachowują własne kontrakty — ten sam `plan.md`, ten sam `## Progress`, ten sam rytuał commitów.

Cel: `$ARGUMENTS`

Jeśli istnieje `context/foundation/lessons.md`, przeczytaj go raz pod kątem powtarzających się błędów UI w tym repozytorium.

## Kiedy je uruchomić — i na którym widoku

- **Kiedy:** po wyrenderowaniu pierwszego pionowego wycinka z prawdziwymi danymi — główny przepływ działa
  od początku do końca, ale wygląda, jakby był budowany funkcja po funkcji. Wcześniej nie ma czego
  audytować; znacznie później każdy nowy widok kopiuje dryf. Najlepszy moment jest przed drugim
  lub trzecim widokiem, aby odziedziczyły kontrakt zamiast literałów.
- **Który widok:** ten, na który użytkownicy trafiają najczęściej w głównym przepływie (lista/dashboard po logowaniu,
  nie strona ustawień). Landing page liczy się tylko wtedy, gdy już istnieje i jest
  zmianą, na której Ci zależy — otrzymuje własną zmianę, a nie przejazd przy okazji.
- **Nie teraz:** widok, który jeszcze nie istnieje (zbuduj go zwykłym łańcuchem, a potem wróć),
  rebranding całego MVP, równoległe agenty lub `/goal` dla przepustowości (późniejsza lekcja),
  plik narzędzia projektowego jako jedyne źródło prawdy (ta umiejętność działa na uruchomionej aplikacji).

## Przy wywołaniu

1. **Rozwiąż cel.**
   - `context/changes/<arg>/` istnieje → ta zmiana; przeczytaj `change.md` oraz ewentualne `research.md`
     i `plan.md`, a następnie wznów od pierwszego kroku routera, który nie został jeszcze wykonany.
   - Trasa lub plik widoku → widok do audytu. Zasugeruj change-id i skopiuj
     `/10x-new <change-id>` do schowka; w `change.md` nazwij **jeden** widok oraz źródło tokenów
     (lub motyw), względem którego pracuje ta zmiana.
   - Brak argumentu → zapytaj, który widok, korzystając z powyższych wskazówek, i zatrzymaj się do czasu odpowiedzi.
   - Odrzuć ścieżki `context/archive/`: „Ta zmiana jest zarchiwizowana. Otwórz nową zmianę za pomocą
     `/10x-new`.”
2. **Wstępny audyt (minuty, nie research):** znajdź źródło wartości, katalog współdzielonych komponentów,
   plik(i) zasad agenta (`CLAUDE.md`, `AGENTS.md`, `.cursor/rules/*`,
   `.windsurfrules`, `copilot-instructions.md`) i uruchom poniższy skan wartości zakodowanych na sztywno
   na plikach widoku. Zgłoś liczby — mówią, który wariant kontraktu ma zastosowanie.
3. **Przekaż do `/10x-research`** brief audytu z *Audytu* poniżej; skopiuj
   polecenie do schowka. Zarzuty trafiają do `research.md` pod `## Charges`.

> **Schowek.** Przekaż dokładne polecenie przez `pbcopy` / `clip.exe` / `xclip -selection
> clipboard` / `Set-Clipboard`, przejdź po cichu do fallbacku, jeśli żadne nie istnieje, a następnie wypisz je w osobnej
> linii z sufiksem `(✓ copied)`.

## Router

1. `/10x-new <change-id>` — jeden widok, jedno źródło tokenów lub motyw.
2. `/10x-research <change-id>` — dwukierunkowy audyt poniżej. Wynik: `## Charges` w `research.md`.
3. `/10x-plan <change-id>` — fazy w tej kolejności: **środowisko/biblioteka → wartości tokenów →
   jeden widok → stany**. Każdy zarzut mapuje się na fazę lub jest wymieniony jako odroczony. Faza stanów
   zawiera 7-stanową macierz jako kryteria sukcesu.
4. `/10x-implement <change-id>` faza po fazie. Po każdej fazie wizualnej: zrzut ekranu w wersji
   desktopowej i przy jednej szerokości mobilnej oraz ponowne uruchomienie skanu wartości zakodowanych na sztywno na widoku.
5. **Bramka wizualna** — kitchen sink lub `toHaveScreenshot` na tym jednym widoku.
6. **Zostaw zabezpieczenie** — regułę (oraz, jeśli repo ma linter, kontrolę), która utrzyma kolejnego
   agenta przy kontrakcie. Zobacz *Utrwal to*.
7. `/10x-impl-review` — ustalenia UI domyślnie nie są „pomijane jako kosmetyczne”. Następnie pętla przeglądu.

## Audyt: trzy kategorie zarzutów

Przed jakimkolwiek CSS przejdź przez widok i zapisz **3–5 zarzutów**. Każdy zarzut otrzymuje **plik i
linię** oraz **jedno zdanie o wpływie na użytkownika**. Lista zarzutów jest wejściem do
planu; „zrób to ładniej” nim nie jest.

Audyt przebiega w **dwóch kierunkach**:

- **Źródło → widoki.** Gdzie znajdują się wartości, gdzie znajdują się współdzielone komponenty i które
  widoki faktycznie je odczytują? Policz użycia klas/zmiennych tokenów oraz importy z
  katalogu komponentów na widok. Plik tokenów, którego nic nie odczytuje, to ustalenie, a nie baza odniesienia.
- **Widok → źródło.** Dla każdego literału w widoku: który token lub komponent powinien był
  go pokryć? To jest dowód zarzutu.

Przeczytaj też plik(i) zasad agenta pod kątem instrukcji UI. Reguła, która mówi agentowi, aby używał
wartości jednorazowych (np. „use arbitrary values like `w-[123px]` for precise designs”), jest
zarzutem przypadkowej architektury: to dlatego widoki się rozjechały i cofnie poprawkę.

| Kategoria | Jak to wygląda | Dowody do zapisania | Typowa poprawka |
| --- | --- | --- | --- |
| **Brakujące tokeny** | literalne kolory w widoku — hex/rgb/oklch, a w Tailwind **klasy palety** (`bg-blue-900`, `text-purple-200`, `from-indigo-900`) i wartości arbitralne (`p-[13px]`); trzy odcienie tego samego „primary”; odstępy wymyślane w każdym pliku | plik:linia literału oraz token, który powinien go pokryć | przenieś wartość do źródła tokenów tego repo i odwołaj się do niej przez rolę (`bg-primary`, `text-muted-foreground` w wariancie Tailwind) |
| **Brakujący współdzielony komponent** | drugi `Button` zbudowany z `div`+klas, karta kopiująca kartę DS, kopiowane-wklejane pole formularza | plik:linia duplikatu oraz komponent, który zasłania (lub ten, który należy dodać) | zaimportuj właściwy komponent lub dodaj go ścieżką stosu (np. `npx shadcn add <name>`) |
| **Przypadkowa architektura** | ekran odzwierciedla kolejność dodawania funkcji: nieuwierzytelniona trasa zwracająca surowy JSON, modal będący stroną, karta „settings” zawierająca cztery niezwiązane rzeczy, reguła agenta zachęcająca do stylów jednorazowych | ścieżka trasy/komponentu/reguły oraz to, co użytkownik widzi, gdy trafia tą drogą | popraw punkt wejścia (guard, redirect, layout) lub regułę, nie kolor |

Trzecia kategoria jest najtrudniejsza do zobaczenia na zrzucie ekranu i najłatwiejsza do pominięcia. Zapytaj
wprost: *co się stanie, jeśli ktoś dotrze do tego widoku wylogowany, bez danych lub bezpośrednio
z linku?*

Zarzuty, których plan nie adresuje, pozostają w `## Charges` oznaczone jako **deferred** z powodem —
nie są usuwane.

### Skan wartości zakodowanych na sztywno

Lista kandydatów, nie werdykt — każde trafienie jest możliwym zarzutem braku tokenu. Uruchamiaj go na
plikach widoku (nigdy na samym źródle tokenów), podczas wstępnego audytu i po każdej fazie wizualnej:

```bash
grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b' <view files>
```

Stosy inne niż Tailwind: zachowaj część dotyczącą funkcji kolorów, usuń część dotyczącą klas palety i dodaj
własną formę literału stosu (hex wewnątrz styled-component, kolor w propie `sx`).
Liczba powinna spadać faza po fazie; liczba, która rośnie, jest regresją.

## Kontrakt systemu projektowego

Kontrakt ma dwie połowy i żadna nie nazywa narzędzia:

1. **Semantyczne tokeny** — jedno źródło wartości, z nazwami opisującymi **rolę** (`primary`,
   `surface`, `muted`, `destructive`), nigdy kolor (`purple-600`).
2. **Importowalne komponenty, które znajdują się w repo** — czytelne dla agenta, a nie zależność czarnej skrzynki,
   którą może tylko zgadywać.

Bez obu agent wymyśla prymitywy na nowo w każdym widoku. Z obiema ma miejsce, do którego może zajrzeć.

| Stos | Gdzie znajdują się wartości | Gdzie znajdują się komponenty |
| --- | --- | --- |
| **Tailwind v4 + shadcn/ui** (wariant kursu) | `:root` / `.dark` w CSS, publikowane przez `@theme` / `@theme inline` | skopiowane do repo, zwykle `src/components/ui` |
| **CSS Modules / zwykłe zmienne CSS** | plik zmiennych (`:root`, często `theme.css` / `variables.css`) | katalog współdzielonych komponentów, importowany ścieżką |
| **CSS-in-JS z motywem** (styled-components, vanilla-extract, Panda) | obiekt motywu lub plik tokenów `.css.ts` | stylizowane prymitywy eksportowane z jednego modułu |
| **Biblioteka komponentów z motywem** (MUI, Chakra, Mantine) | obiekt motywu/config biblioteki, rozszerzony w Twoim kodzie | komponenty biblioteki, opakowane lokalnie tam, gdzie je dostosowujesz |

Szczegół Tailwind: `:root` / `.dark` przechowują **wartości**, `@theme inline` **publikuje** je jako
`--color-*`, i dopiero wtedy istnieje `bg-primary`. Surowe kolory zapisane bezpośrednio do
`@theme inline` to klasyczne uszkodzenie dark mode — wartości `.dark` są tam, przełącznik
nic nie robi. Inne stosy mają własną wersję tego podziału; znajdź ją przed edycją.

Wybierz wariant pasujący do repo i zapisz go w `change.md`:

- **Istniejący system projektowy** — przeczytaj jego źródło wartości, współdzielone komponenty i notatki projektowe,
  zanim cokolwiek zaproponujesz. Rozszerz go; nie twórz drugiej palety ani nie uruchamiaj drugiego
  `shadcn init`. Istniejący, gorszy system jest lepszy niż lepszy, który wnosisz.
- **Świeży starter z martwym plikiem tokenów** — najczęstszy przypadek greenfield: starter
  dostarcza tokeny i jeden lub dwa komponenty, ekrany używają klas literalnych. Faza 1 nie polega na
  wyborze motywu; polega na tym, by istniejący widok odczytywał tokeny, które już tam są. Dopiero wtedy
  warto wybierać nowe wartości.
- **Brak systemu projektowego** — wprowadzenie kontraktu **jest** zmianą. Zaproponuj go przy trzech
  warunkach zapisanych w `change.md`: (1) oznaczony jako dodanie zależności — decyzję podejmuje uczestnik;
  (2) ograniczony do bloku tokenów oraz 2–3 komponentów używanych przez ten widok, nie całej biblioteki;
  (3) przegrywa z czymkolwiek, co repo już posiada.
- **Nazwany motyw lub preset** — zmapuj jego wartości na istniejące nazwy zmiennych; zachowaj niewielką liczbę
  (primary, surface, border, muted, destructive oraz radius i skalę odstępów).

Niezależnie od źródła wartości, **zapisz je w repo**: surowe wartości w pliku w
folderze zmiany oraz linię wskazującą, skąd pochodzą, obok edytowanego bloku.
Wartości żyjące tylko w oknie czatu to wartości, które kolejna sesja wymyśli ponownie.

Dodawanie komponentu: użyj własnej ścieżki stosu — `npx shadcn add <name>` (lub shadcn MCP, jeśli
jest już skonfigurowany) w wariancie kursu. Nie wymagaj `mcp init`, aby ukończyć zmianę.

## Definicja ukończenia: 7-stanowa macierz

Faza stanów jest ukończona, gdy każda komórka jest **pokazana** (w kitchen sink) albo oznaczona jako
**N/A z powodem** — nie wtedy, gdy happy path wygląda właściwie.

| Stan | Co sprawdzić |
| --- | --- |
| default | zbudowany wyłącznie z tokenów i komponentów repo |
| hover | widoczna zmiana, sterowana tokenami |
| focus-visible | fokus klawiatury widoczny na każdej kontrolce; własny token (`--ring` w shadcn), nie domyślny przeglądarki |
| disabled | wygląda i zachowuje się jak wyłączony, nadal czytelny |
| error | komunikat obok pola/akcji, token `destructive`, nie sam kolor |
| empty | brak danych: prawdziwy stan pusty, nie pusta ramka ani surowy JSON |
| loading | skeleton lub spinner; brak przeskoku layoutu po nadejściu danych |

`disabled`, `error` i `focus-visible` rozjeżdżają się jako pierwsze, ponieważ nic w happy path
ich nie ćwiczy. Przeniesienie akcentu nie przenosi tokenu fokusu — sprawdź go osobno.

Minimum, nie kurs WCAG: każda kontrolka ma dostępną nazwę, a kontrast przy zmianach tokenów
przetrwa oba motywy, jeśli aplikacja ma dark mode. Dark mode zmienia się na warstwie tokenów; przebieg
dark mode edytujący klasy komponentów jest zamaskowanym zarzutem brakujących tokenów.
Desktop plus **jedna** szerokość mobilna — nie macierz responsywności.

## Bramka wizualna

Jeden widok, każdy stan widoczny naraz. Najtańsza forma nie potrzebuje runnera testów: strona
**kitchen-sink** renderująca widok we wszystkich siedmiu stanach obok siebie, ze zrzutami ekranu dla
desktopu i jednej szerokości mobilnej. Służy też jako dowód do przeglądu i działa na każdym stosie.

Jeśli repo ma już narzędzie do testów zrzutów ekranu, podłącz do niego bramkę — np.
`await expect(page).toHaveScreenshot({ maxDiffPixels: 100 })` z Playwright, maskując
zmienne regiony (daty, avatary, liczniki). Nie instaluj go tylko po to, by spełnić tę umiejętność.
Nigdy nie aktualizuj baseline, aby CI było zielone, bez uprzedniego wyjaśnienia delty wizualnej.

## Utrwal to

Poprawka trwa jedną sesję, chyba że kolejnemu agentowi zostanie powiedziane, gdzie patrzeć. Przed przeglądem:

1. **Reguła.** Dodaj krótki blok UI do pliku zasad agenta repo (tego, który znalazł wstępny audyt;
   rozszerz go, nie twórz drugiego; zapisz go **poza** blokiem
   `<!-- BEGIN @przeprogramowani/10x-cli -->` … `<!-- END … -->`, który CLI nadpisuje
   przy każdym `get`): gdzie znajdują się tokeny, gdzie są komponenty,
   „sprawdź `<components dir>` przed utworzeniem komponentu; dodaj brakujące przez
   `<stack's path>`”, „brak literalnych kolorów lub wartości arbitralnych w widokach — używaj tokenów” oraz
   gdzie znajduje się kitchen sink. Usuń lub przepisz każdą regułę zachęcającą do wartości jednorazowych.
2. **Kontrola.** Jeśli repo ma już linter lub hook pre-commit, dodaj skan wartości zakodowanych na sztywno
   (lub własną regułę lintera dla tego) ograniczony do widoków oczyszczonych przez tę zmianę —
   nieudana kontrola jest lepsza niż reguła, o której agent zapomniał. Nowa zależność lint podlega tym samym trzem
   warunkom co nowy system projektowy: zaproponowana, ograniczona zakresem, a decyzję podejmuje uczestnik.
3. **Dokumentacja jako kontekst.** Jeśli repo ma Storybook lub dokumentację komponentów, wskaż je w regule
   zamiast je powtarzać.

## Pętla przeglądu: od zarzutu do PR

Widok może być technicznie poprawny, a nadal nieczytelny — nagłówek konkurujący z głównym
przyciskiem, każda informacja o tej samej wadze, każda drobna rzecz na osobnej karcie.
Oceniaj layout **po** zbudowaniu widoku z tokenów i komponentów repo; na ekranie sklejonych
z klas jednorazowych krytyka layoutu sprowadza się do kosmetycznych poprawek.

1. Uzyskaj krytykę: `/10x-impl-review` oraz opcjonalny przebieg layoutu (Impeccable,
   `frontend-design`), jeśli uczestnik ma go zainstalowanego. Nie dodawaj tych narzędzi do repo.
2. Priorytetyzuj każde ustalenie według **wpływu na użytkownika**: brakujący focus ring lub martwa zakładka zasługują
   na tak samo konkretną decyzję jak błąd logiki.
3. Popraw lub zapisz ustalenie jako odroczone z powodem. Cisza nie jest triage.
4. Uruchom ponownie bramkę wizualną. Ustalenie, które zmieniło widok bez zmiany baseline, jest
   sygnałem ostrzegawczym.

Lista kontrolna merge: [`ui-quality-checklist`](references/ui-quality-checklist.md). Samo zielone CI
nie jest bramką — test zrzutu ekranu z radością przejdzie na widoku, którego stan `disabled` nigdy nie został wyrenderowany.

## Routing modeli (najpierw faza, potem dostępność)

Nie jest wymagany konkretny model; praca potrzebuje **wizji** (odczytania zrzutu ekranu) i **użycia narzędzi**.
Kieruj według fazy: najsilniejszy dostępny model do audytu, planu i przeglądu (zła decyzja tam
kosztuje kilkanaście edycji w złym kierunku; dla przeglądu najlepiej nie ten, który napisał
kod); tańszy poziom roboczy do implementowania zarzutów w pętli render → compare → fix.
Eskaluj tylko wtedy, gdy **ten sam zarzut przetrwa dwie rundy**. Jeden model do wszystkiego jest w porządku —
podział zmienia rachunek, nie metodę. W ogóle brak wizji? Wyrenderuj kitchen sink,
opisz stany tekstowo, zachowaj bramkę zrzutów ekranu w CI.

## Twarde zasady

- Żadnego promptu, który mówi tylko „zrób to ładniej / estetyczniej”.
- Każdy zarzut zawiera plik, linię i wpływ na użytkownika, zanim trafi do planu.
- Kolory, typografia, radius, odstępy: token z systemu **tego repo**, nie literał w widoku.
- Użyj ponownie istniejącego komponentu albo dodaj go własną ścieżką stosu; nigdy drugiego `Button`.
- Jeden widok plus globalne tokeny na zmianę. Nie rebranding całego MVP.
- Zmiana kończy się regułą w pliku zasad agenta, nie tylko ładniejszym zrzutem ekranu.

## Błędy, których należy odmówić

| Zapach | Zrób to zamiast tego |
| --- | --- |
| Domyślny fioletowo/niebieski gradient „AI landing” | Najpierw zmień `--primary` / tokeny motywu |
| Nowy prymityw `div`+CSS kopiujący komponent DS | Zaimportuj właściwy komponent |
| Zakładka „Selected”, która jest tylko CSS i nie można jej kliknąć | Podłącz stan |
| Nieuwierzytelnione wejście lub stan pusty, który wyrzuca surowy JSON / pustą ramkę | Popraw punkt wejścia; to zarzut architektury |
| `shadcn init` (lub odpowiednik) w repo, które już dostarcza tokeny i komponenty | Rozszerz pierwszy system |
| Aktualizowanie baseline zrzutu ekranu, aby CI było zielone | Wyjaśnij deltę wizualną; aktualizuj tylko, jeśli jest zamierzona |
| „Napraw design” jako jedno zadanie agenta w wątku CRUD | Nowy folder zmiany, audyt, plan, bramka |

## Playbooki

Wszystkie zachowują listę zarzutów.

- **Motyw lub restyle jednego widoku** — domyślna ścieżka, zacznij od tokenów.
- **Odziedziczony bałagan agenta** — spodziewaj się wszystkich trzech kategorii; popraw tokeny i współdzielony komponent
  przed dotknięciem layoutu oraz sprawdź plik zasad agenta pod kątem instrukcji, która go spowodowała.
- **Pojedynczy komponent** — pomiń fazę tokenów tylko wtedy, gdy jego wartości już pochodzą z tokenów.
- **Dark mode** — warstwa tokenów, oba motywy w kitchen sink, kontrola kontrastu w bramce.
- **Przebieg focus/klawiatury** — obejmuje go faza stanów: focus-visible, nazwy kontrolek, kolejność tabulacji.