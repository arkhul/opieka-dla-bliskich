---
name: 10x-plan
description: Create detailed implementation plans with thorough research and iteration
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
# Plan implementacji

Twoim zadaniem jest tworzenie szczegółowych planów implementacji w interaktywnym, iteracyjnym procesie. Zachowuj sceptycyzm, bądź dokładny(-a) i współpracuj z użytkownikiem, aby tworzyć wysokiej jakości specyfikacje techniczne.

## Natywna możliwość zadawania pytań

Najpierw rozpoznaj wywołanie: `/10x-plan <change-id> save` (również `$10x-plan <change-id> save`) albo żądanie zapisania już uzgodnionego planu po zmianie trybu wznawia **utrwalanie**, a nie wywiad. Przeczytaj [references/plan-persistence.md](references/plan-persistence.md) i zastosuj jego ścieżkę zapisu przed sprawdzeniem wymagań wstępnych dotyczących pytań. Brak narzędzia do zadawania pytań nie jest blokadą, gdy nie pozostały nierozstrzygnięte decyzje.

`AskUserQuestion` poniżej oznacza rzeczywiste, ustrukturyzowane narzędzie pytań bieżącego środowiska: Claude Code `AskUserQuestion`, Codex `request_user_input` albo OpenCode `question`. Podczas mapowania argumentów zachowaj znaczenie pytań oraz format rekomendacji/kompromisów; rzeczywisty natywny schemat określa liczbę opcji i limity pól. Użyj mniejszej liczby opcji albo podziel niezależne pytania, gdy limit hosta jest bardziej restrykcyjny. Codex wymaga również unikalnego `id` pytania i nie udostępnia `multiSelect`; użyj tam osobnych pytań jednokrotnego wyboru, gdy wybory są niezależne. W OpenCode zamapuj `multiSelect` na `multiple`, zachowaj pytania jednokrotnego wyboru z `multiple: false` oraz niestandardowe wprowadzanie tekstu (`custom: true`).

Przed pierwszym pytaniem sprawdź narzędzie faktycznie dostępne w bieżącej sesji. W Codex CLI/app-server natywne `request_user_input` wymaga **Plan collaboration mode**. Wywołanie tej umiejętności nie zmienia trybu hosta, a `codex exec` nie jest interaktywnym punktem wejścia do pytań. Host/kontroler musi rozpocząć interaktywną turę w trybie Plan. W OpenCode użyj sesji, której natywne narzędzie `question` ma połączonego klienta pytań (na przykład interaktywny terminal); nieobsługiwane tekstowe uruchomienie nie jest dowodem, że użytkownik może odpowiedzieć. Jeśli wymagane natywne narzędzie jest niedostępne, nazwij brakującą możliwość i zatrzymaj się przed przyjęciem odpowiedzi lub utworzeniem planu. Dla Codex wyraźnie zalecaj przełączenie do Plan collaboration mode; dla OpenCode ponownie podłącz interaktywnego klienta pytań i wznów sesję. Nie twierdź, że pytanie zostało wysłane, jeśli jedynie wyświetlono tekst. Jawne nieinteraktywne zadanie, które zatrzymuje się z powodu brakujących wymagań wstępnych, nadal może zgłosić te wymagania bez rozpoczynania wywiadu.

Używaj rozmiaru rundy obsługiwanego przez natywne narzędzie: Claude Code 1–4 pytania; wskazówka Codex 1–3; w OpenCode użyj maksymalnie 4 pytań na rundę i przestrzegaj każdego bardziej restrykcyjnego limitu natywnego. Potwierdzony budżet pytań jest **łączny dla wszystkich rund**, a nie wymogiem upchnięcia wszystkich pytań w pierwszym wywołaniu. Pytaj jako główny agent; podagenci badawczy nie prowadzą wywiadu z użytkownikiem.

Sprawdź możliwość zapisu niezależnie od możliwości zadawania pytań. Gdy host zezwala na pytania, lecz zabrania zapisu do repozytorium (w tym w Codex Plan mode), przeczytaj [references/plan-persistence.md](references/plan-persistence.md). Na początku wyjaśnij, że ta sesja utworzy kompletny plan i brief w rozmowie, po czym nastąpi krok zapisu w Default mode w tej samej rozmowie. Umiejętność nie może zmienić trybu hosta. Zachowaj najnowsze decyzje i korekty podczas tego przejścia; nie rozpoczynaj wywiadu od nowa.

## Pierwsza odpowiedź

Gdy to polecenie zostanie wywołane:

1. **Sprawdź, czy podano parametry**:
   - Jeśli jako parametr podano ścieżkę pliku lub referencję do zgłoszenia, pomiń domyślną wiadomość
   - Natychmiast przeczytaj w CAŁOŚCI wszystkie podane pliki
   - Rozpocznij proces badawczy

2. **Jeśli nie podano parametrów**, odpowiedz:

```
Pomogę Ci utworzyć szczegółowy plan implementacji. Zacznijmy od zrozumienia, co budujemy.

Podaj proszę:
1. Opis zadania/zgłoszenia (lub referencję do pliku zgłoszenia)
2. Wszelki istotny kontekst, ograniczenia lub szczególne wymagania
3. Linki do powiązanych badań lub wcześniejszych implementacji

Im więcej kontekstu z wcześniejszych etapów przekażesz, tym mniej pytań zadam:
- Tylko opis zadania → pełne pytania
- Zadanie + dokument badawczy (`context/changes/<change-id>/research.md`) → mniej pytań; nie będę powtarzać tego, co objęły badania
- Zadanie + brief ramowy (`context/changes/<change-id>/frame.md`) → znacznie mniej pytań; sformułowanie problemu jest już ustalone
- Zadanie + ramy + badania → minimalna liczba pytań; skupiam się wyłącznie na decyzjach dotyczących projektu rozwiązania, które wymagają Twojego wkładu

Wskazówka: wywołaj bezpośrednio z change-id lub ścieżką — `/10x-plan oauth-login` lub `/10x-plan @context/changes/oauth-login/frame.md`
Aby uzyskać głębszą analizę, spróbuj: `/10x-plan think deeply about @context/changes/oauth-login/research.md`
```

Następnie poczekaj na dane wejściowe użytkownika.

## Kroki procesu

### Krok 1: Zbieranie kontekstu i wstępna analiza

#### Krok 1.0: Zidentyfikuj artefakty wcześniejszych etapów i dostosuj głębokość pytań

Przed rozpoczęciem czytania zidentyfikuj rodzaje artefaktów wcześniejszych etapów przekazanych przez użytkownika. Każdy z nich reprezentuje decyzje już podjęte — nie pytaj o nie ponownie.

- **Brief ramowy** — ścieżka pasuje do `context/changes/<change-id>/frame.md` albo zawartość zaczyna się od `# Frame Brief:` / zawiera sekcję `## Reframed`.
- **Dokument badawczy** — ścieżka pasuje do `context/changes/<change-id>/research.md` albo frontmatter YAML zawiera pola `topic:` i `researcher:`.
- **Istniejący plan** — ścieżka pasuje do `context/changes/<change-id>/plan.md` (tryb wznowienia/dopracowania — poza zakresem tej logiki skalowania).
- **Tylko opis zadania** — żadne z powyższych.

**Liczba i zakres pytań skalują się zależnie od przekazanych materiałów:**

| Artefakty wcześniejszych etapów | NISKI | ŚREDNI | WYSOKI | Co zmienia się względem poziomu bazowego |
| --------------------------- | ----- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tylko zadanie (poziom bazowy) | 4–6 | 7–10 | 11–15 | Pełne pytania we wszystkich istotnych kategoriach. |
| Zadanie + badania | 3–5 | 5–7 | 8–11 | Pomiń pytania, na które odpowiedź znajduje się już w dokumencie badawczym. Nie uruchamiaj ponownie podagentów, aby znaleźć to, co badania już zmapowały. |
| Zadanie + ramy | 2–3 | 4–6 | 7–9 | Pomiń kategorie [D]iagnostyczne — ramy ustaliły sformułowanie problemu. Traktuj Przeformułowane (lub Potwierdzone) Stwierdzenie Problemu jako autorytatywne. |
| Zadanie + ramy + badania | 1–2 | 3–5 | 5–7 | Pomiń oba. Zadawaj wyłącznie pytania dotyczące projektu [S]olution, które rzeczywiście wymagają wkładu użytkownika. |

**Wyjątek dotyczący ustalonych danych wejściowych:** jeśli artefakty wcześniejszych etapów już rozstrzygają każdą istotną decyzję dotyczącą rozwiązania, zaproponuj **0 merytorycznych pytań**, krótko wskaż te dowody i uzyskaj zwykłe natywne potwierdzenie złożoności/budżetu. Zachowaj natywne zatwierdzenie struktury. Jeśli uzgodniony budżet staje się niepotrzebny po późniejszych odpowiedziach, potwierdź zmianę zamiast sztucznie dodawać pytania. Powyższe zakresy są wskazówką dla nierozstrzygniętej pracy; nie wymagają wymyślania decyzji.

**Zasada**: każdy przekazany artefakt jest źródłem już podjętych decyzji. Czytanie ich jest równoznaczne ze słuchaniem użytkownika. Nie pytaj użytkownika o to, co już zapisał.

**Gdy obecne są ramy**, przeczytaj je W CAŁOŚCI i traktuj jako autorytatywne:
- Skopiuj **Reported Observation** + **Reframed (lub Confirmed) Problem Statement** jako definicję zadania. Nie zadawaj ponownie pytań o ramy.
- Przenieś tabelę **Hypothesis Investigation** i **Narrowing Signals** do swojej sekcji „Current State Analysis” — ta praca została już wykonana.
- Jeśli oznaczono **Confidence: LOW**, uwidocznij to w sekcji „Open Risks & Assumptions” planu i zadaj JEDNO pytanie wyjaśniające o dalsze postępowanie (najpierw weryfikować czy planować z uznanym ryzykiem).
- NIE badaj ponownie ram problemu. Ramy są właścicielem sformułowania problemu; Ty jesteś właścicielem projektu rozwiązania.

**Gdy obecne są badania**, przeczytaj je W CAŁOŚCI i użyj jako punktu odniesienia dla bazy kodu:
- Sekcja „Code References” JEST Twoim ugruntowaniem w bazie kodu — nie uruchamiaj ponownie agentów Explore, aby znaleźć te same pliki.
- „Architecture Insights” trafiają bezpośrednio do „Current State Analysis.”
- Uruchamiaj podagentów tylko po to, by uzupełnić konkretne luki, których badania nie objęły (np. dokładne pliki, które zmodyfikuje ten plan, jeśli badania miały szerszy zakres).

#### Krok 1.1: Czytanie i badanie

1. **Natychmiast przeczytaj W CAŁOŚCI wszystkie wspomniane pliki**:
   - Pliki referencyjne (np. `context/changes/<change-id>/research.md`, `context/changes/<change-id>/frame.md`)
   - Dokumenty badawcze
   - Briefy ramowe
   - Powiązane plany implementacji
   - Wszelkie wspomniane pliki JSON/danych
   - `context/foundation/lessons.md`, jeśli istnieje — traktuj jego zasady jako wcześniejsze założenia podczas badania zakresu, przypadków brzegowych i wyborów architektonicznych; zasady już zaakceptowane przez zespół zawężają zakres pułapek projektowych, które nadal wymagają nowych pytań.
   - **WAŻNE**: używaj narzędzia Read BEZ parametrów limit/offset, aby czytać całe pliki
   - **KRYTYCZNE**: NIE uruchamiaj podzadań, zanim samodzielnie nie przeczytasz tych plików w głównym kontekście
   - **NIGDY** nie czytaj plików częściowo — jeśli plik jest wspomniany, przeczytaj go w całości

2. **Uruchom równoległe badania przed wywiadem**:
   Przed zadaniem użytkownikowi jakichkolwiek pytań deleguj nierozstrzygnięte luki dowodowe do podagentów pracujących równolegle — domyślnie 2–3 w jednej wiadomości, każdy w innym wymiarze wyszukiwania (np. „znajdź wszystkie pliki związane z X”, „znajdź podobne implementacje Y”, „znajdź wcześniejsze decyzje dotyczące Z w `context/changes/**/` i `context/archive/**/`”), prosząc każdego o zakotwiczenia `file:line`. Przeczytaj [references/task-orchestration.md](references/task-orchestration.md) przed pierwszym wysłaniem zadań, aby poznać kontrakt wysyłki, fallback możliwości i wymagania dowodowe. Rozstrzygnij pojedynczy zlokalizowany fakt poprzez lokalny odczyt o zawężonym zakresie zamiast delegacji oraz zachowaj pytania produktowe i decyzje międzykomponentowe dla głównego agenta. W Claude Code deleguj za pomocą narzędzia `Agent` (`Task` w starszych wersjach Claude Code) — `subagent_type: "Explore"` do lokalizowania kodu, `"general-purpose"` do analizy; w innych hostach użyj natywnego odpowiednika. Poczekaj, aż wszyscy wysłani podagenci zakończą pracę przed integracją wyników.

3. **Przeczytaj wszystkie pliki zidentyfikowane przez zadania badawcze**:
   - Po zakończeniu zadań badawczych przeczytaj WSZYSTKIE pliki, które wskazały jako istotne
   - Przeczytaj je W CAŁOŚCI do głównego kontekstu
   - Zapewnia to pełne zrozumienie przed kontynuowaniem

4. **Przeanalizuj i zweryfikuj zrozumienie**:
   - Skonfrontuj wymagania zgłoszenia z rzeczywistym kodem
   - Zidentyfikuj wszelkie rozbieżności lub nieporozumienia
   - Odnotuj założenia wymagające weryfikacji
   - Ustal rzeczywisty zakres na podstawie realiów bazy kodu
   - **Zbadaj słowa pozostawione niezdefiniowane przez żądanie.** Terminy rankingu, wyboru i stanu — „top N”, „latest”, „first”, „winner”, „duplicate”, „active”, „until the end” — ustalaj tylko zgodnie z ich dosłownym brzmieniem. Dla każdego utwórz najmniejszy przypadek, w którym dwa odczytania dają różne widoczne dla użytkownika wyniki, a następnie sprawdź, co robi tam kod; rozstrzyganie remisu według id, kolejności wstawienia lub pozycji tablicy nie jest decyzją, którą ktokolwiek podjął, więc nie rozstrzyga terminu. Każdy termin, którego odczytania się różnią, staje się pytaniem pierwszej rundy. Zobacz [references/question-examples.md](references/question-examples.md#undefined-terms-in-the-request), aby dowiedzieć się, jak zbudować przypadek, sformułować opcję i zapisać wynik.

5. **Przedstaw świadome zrozumienie i oceń złożoność**:

   Najpierw przedstaw krótkie podsumowanie tego, co znaleziono:

   ```
   Na podstawie [zgłoszenia i moich badań bazy kodu / Twojego opisu i mojej analizy] rozumiem, że musimy [dokładne podsumowanie].

   Odkryłem(-am), że:
   - [Kluczowe odkrycie — referencja do kodu, istniejący zasób, wcześniejsza praca lub ograniczenie domenowe]
   - [Istotny wzorzec, konwencja lub ograniczenie]
   - [Zidentyfikowana potencjalna złożoność lub przypadek brzegowy]
   ```

   Następnie oceń złożoność zadania i przedstaw ją użytkownikowi do potwierdzenia:

   ```
   **Ocena złożoności: [HIGH / MEDIUM / LOW]**

   [2-3 zdania wyjaśniające, DLACZEGO wybrano ten poziom złożoności, z odniesieniem do konkretnych czynników:
   liczby dotkniętych systemów, punktów integracji, potrzeb zarządzania stanem,
   zmian modelu danych, nieznanych niewiadomych, powierzchni testowej itp.]

   Chciałbym(-abym) zadać **[N] pytań** w wielu rundach, aby doprecyzować istotne
   decyzje dotyczące [lista kluczowych obszarów decyzji: architektura, przypadki brzegowe, model danych, UX, testowanie itp.].

   Czy to wydaje się właściwe, czy zmienił(a)byś poziom złożoności?
   ```

   Użyj AskUserQuestion do potwierdzenia:
   - question: "Czy ta ocena złożoności odpowiada Twoim oczekiwaniom?"
     header: "Złożoność"
     options:
     - label: "⭐ Recommended: [N] pytań (Recommended)"
       description: "Użyj zaproponowanego budżetu pytań. · Strength: Skupia się na zidentyfikowanych decyzjach. · Tradeoff: Nowo odkryte luki mogą wymagać dostosowania."
     - label: "Wyższa — zadaj więcej pytań"
       description: "Rozszerz wywiad o brakujące kwestie. · Strength: Obejmuje dodatkowe ryzyka. · Tradeoff: Wymaga więcej czasu użytkownika."
     - label: "Niższa — potrzeba mniej pytań"
       description: "Ogranicz wywiad do pozostałych decyzji. · Strength: Unika zbędnych pytań. · Tradeoff: Wymaga zidentyfikowania kwestii, które są już ustalone."
       multiSelect: false

   **Skala złożoności:**

   | Poziom | Pytania | Kiedy używać |
   | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **LOW** | 4-6 | Proste zadanie z jasnymi wymaganiami. Niewiele ruchomych części, podąża za ustalonymi wzorcami lub konwencjami, ograniczone niewiadome. Przykłady programistyczne: zmiana w pojedynczym pliku, korekta konfiguracji. Przykłady nieprogramistyczne: konspekt jednego tematu, prosta korekta procesu. |
   | **MEDIUM** | 7-10 | Wiele współdziałających komponentów lub zagadnień. Wymaga decyzji projektowych, ma warte omówienia przypadki brzegowe, pewną niejednoznaczność podejścia. Przykłady programistyczne: funkcja obejmująca wiele plików, nowy punkt końcowy API. Przykłady nieprogramistyczne: plan treści z wieloma częściami, przeprojektowanie przepływu pracy, moduł kursu. |
   | **HIGH** | 11-15 | Przekrojowe zagadnienia, znaczące niewiadome, wielu interesariuszy lub ograniczeń. Wymaga myślenia architektonicznego, niesie ryzyko kosztownej przeróbki w razie błędu. Przykłady programistyczne: przeprojektowanie systemu, migracja danych. Przykłady nieprogramistyczne: strategia uruchomienia w wielu kanałach, przebudowa programu nauczania, zmiana procesu organizacyjnego. |

   Po potwierdzeniu (lub dostosowaniu) przez użytkownika przejdź do zadawania pytań.

6. **Zadawaj pogłębione pytania sondujące za pomocą AskUserQuestion**:

   Pytaj o pozostałe decyzje w ramach potwierdzonego łącznego budżetu, korzystając z powyższego natywnego rozmiaru rundy. Budżet obejmuje merytoryczne doprecyzowania; nie jest limitem do zapełnienia ani pozwoleniem na ponowne otwieranie ustalonych interfejsów.

   **Zasady strukturyzowania pytań:**
   - Każde pytanie powinno mieć 2–4 konkretne opcje w ramach rzeczywistego natywnego schematu; użyj 2–3, gdy taki jest limit hosta
   - Używaj `multiSelect: true` tylko wtedy, gdy wybory nie wykluczają się wzajemnie
   - Utrzymuj `header` krótki (maks. 12 znaków): „Zakres”, „Przypadki”, „Priorytet”
   - Użytkownik zawsze może wybrać „Inne”, aby wprowadzić dowolny tekst

   **Każde pytanie MUSI mieć jedną rekomendację; każda opcja MUSI zawierać analizę kompromisów:**
   - Umieść dokładnie jedną rekomendowaną opcję **jako pierwszą**, z dokładnym szablonem etykiety `⭐ Recommended: [short choice] (Recommended)`. Zachowaj razem dosłowny znacznik `⭐ Recommended` i natywny przyrostek `(Recommended)`; skracaj tekst wyboru, nigdy nie skracaj znacznika do `⭐ Rec`. Spełnia to zarówno format umiejętności, jak i natywne umieszczenie rekomendacji.
   - `description` każdej opcji musi mieć format:
     `[1-sentence what this does] · Strength: [key advantage] · Tradeoff: [key cost or risk]`
   - Rekomendacja powinna być oparta na badaniach (wzorcach bazy kodu dla oprogramowania, wiedzy domenowej i kontekście dla zadań nieprogramistycznych) — nie na zgadywaniu

   **Sprawdź payload przed wywołaniem narzędzia:** każdy `header` ma 1–12 znaków (wliczając spacje), każde pytanie ma 2–4 odrębne wybory w rzeczywistym limicie hosta, tylko pierwsza etykieta zawiera dokładny znacznik `⭐ Recommended`, a każdy opis zawiera zarówno ` · Strength: `, jak i ` · Tradeoff: ` z konkretną treścią. Używaj `Format` zamiast 13-znakowego `Output format`. Zweryfikuj same argumenty natywnego wywołania, a nie tylko podgląd w tekście.

   **Przykładowe wywołanie AskUserQuestion z rekomendacjami (oprogramowanie — dostarczanie):** `Rollout` to `[S]` — strategia dostarczania; pytaj tylko, gdy zmiana może zawieść na produkcji w sposób, który ścieżka wydania musiałaby ograniczyć, w przeciwnym razie dziedzicz domyślny sposób zespołu.

   AskUserQuestion z pytaniami:
   - question: "W jaki sposób nowe wyliczanie cen powinno trafić do kont produkcyjnych?"
     header: "Rollout"
     options:
     - label: "⭐ Recommended: Flagged canary (Recommended)"
       description: "Wdróż za flagą funkcji, najpierw włączoną dla 10% kont, a następnie rozszerzaj. · Strength: Błędna cena dotknie ograniczoną grupę i zostanie cofnięta przez zmianę flagi, bez ponownego wdrożenia — wykorzystuje wrapper flagi już ograniczający przeprojektowanie checkoutu. · Tradeoff: Obie ścieżki wyliczeń pozostają aktywne do czasu sprzątania, więc testy cen muszą objąć każdą z nich."
     - label: "Wdróż wszystkim naraz"
       description: "Wdróż nowe wyliczanie dla wszystkich kont w jednym wydaniu. · Strength: Jedna ścieżka kodu od pierwszego dnia — nic do sprzątania i bez zarządzania flagą. · Tradeoff: Wycofanie wymaga ponownego wdrożenia, a błędne faktury już dotarły do klientów."
     - label: "Najpierw uruchom shadow run"
       description: "Obliczaj stare i nowe ceny równolegle, loguj różnice, przez dwa tygodnie serwuj wyłącznie stary wynik. · Strength: Ujawnia rozbieżności na rzeczywistym ruchu bez wpływu na klientów. · Tradeoff: Opóźnia uruchomienie o okno obserwacji i dodaje log różnic, za który nikt jeszcze nie odpowiada."
     multiSelect: false

   **Przykładowe wywołanie AskUserQuestion z rekomendacjami (oprogramowanie):** `Conflicts` to `[S]` — architektura rozwiązania; pytaj tylko, jeśli decyzja pozostaje nierozstrzygnięta po przeczytaniu artefaktów wcześniejszych etapów.

   AskUserQuestion z pytaniami:
   - question: "Jak system powinien obsługiwać konflikty, gdy dwóch użytkowników edytuje równocześnie?"
     header: "Conflicts"
     options:
     - label: "⭐ Recommended: Guided merge (Recommended)"
       description: "Pokaż konflikt użytkownikowi i pozwól mu wybrać, którą wersję zachować. · Strength: Zapobiega utracie danych przy zachowaniu prostego UX — odpowiada wzorcowi w istniejącym komponencie EditPanel. · Tradeoff: Dodaje modal rozwiązywania konfliktów i subskrypcję WebSocket do wykrywania w czasie rzeczywistym."
     - label: "Ostatni zapis wygrywa"
       description: "Późniejszy zapis po cichu nadpisuje wcześniejszy. · Strength: Brak dodatkowej złożoności, nie są potrzebne zmiany UI. · Tradeoff: Użytkownicy mogą stracić pracę bez ostrzeżenia — akceptowalne wyłącznie, jeśli edycje są rzadkie lub mało istotne."
     - label: "Oparte na blokadzie"
       description: "Pierwszy edytor blokuje zasób; inni widzą tryb tylko do odczytu do czasu zwolnienia. · Strength: Całkowicie zapobiega konfliktom — najprostszy model mentalny dla użytkowników. · Tradeoff: Nieaktualne blokady wymagają logiki TTL + czyszczenia; blokuje uzasadnioną pracę równoległą."
     multiSelect: false

   **Przykładowe wywołanie AskUserQuestion z rekomendacjami (nieprogramistyczne — treść/strategia):** `Depth` to `[D]` — diagnostyczne pytanie o odbiorców/zakres; pomiń je, jeśli brief ramowy ustalił już, dla kogo to jest.

   AskUserQuestion z pytaniami:
   - question: "Jaki poziom szczegółów technicznych powinien obejmować moduł kursu?"
     header: "Depth"
     options:
     - label: "⭐ Recommended: Guided practice (Recommended)"
       description: "Koncepcje połączone z ćwiczeniami krok po kroku. · Strength: Równoważy zrozumienie i praktykę — odpowiada formatowi, który uzyskał najwyższe wskaźniki ukończenia w 10xDevs2. · Tradeoff: 2-3x więcej czasu przygotowania na lekcję; wymaga działających repozytoriów przykładowych."
     - label: "Przegląd koncepcyjny"
       description: "Zasady na wysokim poziomie, bez kodu. · Strength: Dostępny dla wszystkich poziomów umiejętności, szybszy w przygotowaniu. · Tradeoff: Zaawansowani uczestnicy mogą uznać go za zbyt płytki — ryzyko utraty zaangażowania."
     - label: "Dogłębna analiza z otwartymi wyzwaniami"
       description: "Minimalne rusztowanie, problemy z rzeczywistego świata. · Strength: Wymusza autentyczne rozwiązywanie problemów, najwyższa retencja nauki. · Tradeoff: Wysokie ryzyko rezygnacji mniej doświadczonych uczestników; trudniejsze wsparcie na dużą skalę."
     multiSelect: false

   **O co pytać** — dostosuj kategorie do domeny zadania:

   Najpierw zidentyfikuj domenę zadania: **software**, **content/education**, **strategy/process** albo **hybrid**. Następnie wybierz pasujące kategorie pytań. Poniższe kategorie są zorganizowane według domen — wybieraj to, co istotne, nie narzucaj kategorii programistycznych zadaniom nieprogramistycznym.

   **Każda kategoria jest oznaczona jako `[D]` (diagnostyczna — o problemie) albo `[S]` (rozwiązanie — o sposobie jego budowy).** Gdy w Kroku 1.0 przekazano brief ramowy, **pomiń wszystkie kategorie `[D]`** — ramy je ustaliły. Zawsze pytaj o kategorie `[S]`, do których prowadzenia nadal potrzebny jest wkład użytkownika.

   **Uniwersalne kategorie (wszystkie domeny, wszystkie poziomy):**
   - **Granice zakresu** `[D]`: Co jest w zakresie, a co poza nim
   - **Przypadki brzegowe / tryby awarii** `[S]`: Co się dzieje, gdy coś pójdzie źle lub stanie się nietypowe (obsługa implementacyjna, nawet jeśli ramy nazwały klasę obserwacji). Zacznij od niezdefiniowanych terminów ujawnionych w Kroku 1.1 — umieść konkretny przypadek w pytaniu zamiast nazywać kategorię
   - **Kryteria sukcesu** `[D]`: Skąd wiemy, że to zadziałało — z perspektywy użytkownika końcowego lub interesariusza
   - **Priorytet** `[D]`: Must-have kontra nice-to-have — co zostaje odcięte, jeśli czas jest ograniczony

   **Kategorie specyficzne dla oprogramowania (dodawaj zależnie od złożoności):**

   MEDIUM+:
   - **Decyzje dotyczące modelu danych** `[S]`: Schemat, relacje, ograniczenia, migracje
   - **Strategia obsługi błędów** `[S]`: Tryby awarii, logika ponawiania, komunikaty dla użytkownika
   - **Podejście do testowania** `[S]`: Poziom pokrycia, które przypadki brzegowe testować jawnie
   - **Granice wydajności** `[S]`: Oczekiwane obciążenie, akceptowalne opóźnienia, cache'owanie

   HIGH:
   - **Wybory architektoniczne** `[S]`: Granice usług, synchronicznie kontra asynchronicznie, sterowane zdarzeniami kontra request-response
   - **Zarządzanie stanem** `[S]`: Gdzie żyje stan, gwarancje spójności, rozwiązywanie konfliktów
   - **Model bezpieczeństwa** `[S]`: Granice autoryzacji, dostęp do danych, walidacja wejścia
   - **Migracja i wycofanie** `[S]`: Wdrożenie przyrostowe, strategia cofania
   - **Obserwowalność** `[S]`: Kluczowe metryki, alertowanie, powierzchnia debugowania

   **Kategorie treści / edukacji (dodawaj zależnie od złożoności):**

   MEDIUM+:
   - **Odbiorcy i wymagania wstępne** `[D]`: Dla kogo to jest, co już wiedzą
   - **Format i medium** `[S]`: Pisemne, wideo, interaktywne, na żywo — i dlaczego
   - **Łuk narracyjny** `[S]`: Jaką podróż odbywa czytelnik/uczeń
   - **Przykłady i ćwiczenia** `[S]`: Co utrwala koncepcje

   HIGH:
   - **Zależności programu nauczania** `[D]`: Czego należy nauczyć się przed czym
   - **Strategia oceny** `[S]`: Jak zweryfikować, że nauka się odbyła
   - **Ponowne użycie i modułowość** `[S]`: Czy części mogą być używane samodzielnie lub w innych kontekstach
   - **Dystrybucja i dostęp** `[D]`: Gdzie to znajduje się i jak ludzie to znajdują

   **Kategorie strategii / procesu (dodawaj zależnie od złożoności):**

   MEDIUM+:
   - **Interesariusze i role** `[D]`: Kto jest zaangażowany, kto decyduje, kto wykonuje
   - **Harmonogram i kamienie milowe** `[S]`: Kluczowe daty, zależności, ścieżka krytyczna
   - **Identyfikacja ryzyk** `[S]`: Co może pójść źle, jaki jest plan awaryjny
   - **Ograniczenia zasobów** `[D]`: Budżet, czas, ludzie, narzędzia

   HIGH:
   - **Zarządzanie zmianą** `[S]`: Jak osoby, których to dotyczy, dowiedzą się o tym i przyjmą to
   - **Ramy pomiarowe** `[D]`: Wskaźniki wyprzedzające kontra opóźnione, jak korygować kurs
   - **Zależności i sekwencjonowanie** `[S]`: Co blokuje co, co może działać równolegle
   - **Plan komunikacji** `[S]`: Kto musi wiedzieć co, kiedy i przez który kanał

   **O co NIE pytać:**
   - O nic, co zostało już ustalone w artefaktach wcześniejszych etapów (brief ramowy, dokument badawczy) — zadawanie ponownych pytań jest trybem awarii, któremu to skalowanie ma zapobiegać
   - O niskopoziomowe szczegóły implementacji, które możesz ustalić samodzielnie (na podstawie badań bazy kodu dla oprogramowania, plików kontekstowych i wcześniejszej pracy dla zadań nieprogramistycznych)
   - O pytania z oczywistymi odpowiedziami na podstawie już przekazanego kontekstu
   - O preferencje, które nie wpływają na strukturę lub sukces planu

   Użyj Kroku 1.0, aby zaproponować budżet odpowiedni do złożoności i dowodów z wcześniejszych etapów. Objęcie każdej istotnej nierozstrzygniętej decyzji w ramach budżetu potwierdzonego przez użytkownika; w razie potrzeby poproś o rozszerzenie przed zadaniem kolejnego merytorycznego pytania. Nie wypełniaj sztucznie wywiadu ani nie otwieraj ponownie ustalonych wyborów, aby osiągnąć sugerowany zakres. Każde pytanie powinno rozstrzygać rzeczywistą lukę.

   Prowadź wewnętrzny zapis nierozstrzygniętych decyzji użytkownika i najnowszej jawnej odpowiedzi dla każdej z nich. Częściowa odpowiedź lub „nie wiem” pozostawia tę decyzję otwartą, chyba że użytkownik jawnie deleguje wybór. Mechanizm już obecny w kodzie nie rozstrzyga nierozstrzygniętego wyboru produktowego dotyczącego sposobu jego użycia. Korekty zastępują wcześniejszą decyzję, zachowując pozostałe odpowiedzi.

   Przed przedstawieniem podejścia sprawdź, czy każda nierozstrzygnięta decyzja ma odpowiedź albo jawną delegację. Uzgodniony budżet pytań obejmuje rundy doprecyzowujące; nie wypełniaj go nowymi tematami, gdy wcześniejsze odpowiedzi nadal wymagają wyjaśnienia. Jeśli budżet wyczerpie się przy otwartej decyzji, wskaż, co pozostaje, i zapytaj, czy rozszerzyć wywiad, zamiast milcząco wybierać lub twierdzić, że wywiad jest zakończony.

   Przenoś dokładne predykaty decyzji do podsumowań, przykładów i rezultatów. Zachowuj granice, wyjątki, jednostki i kierunek podczas skracania odpowiedzi; węższa lub szersza reguła jest nową decyzją. Sprawdź proponowane brzmienie na przypadku granicznym. Przy korekcie zaktualizuj zależne przykłady i brief, a także zapis decyzji, pozostawiając niepowiązane wybory ustalone.

### Krok 2: Badania i odkrywanie

Po uzyskaniu wstępnych wyjaśnień od użytkownika, TERAZ zajmij się szczegółami implementacji:

1. **Zbadaj wzorce implementacyjne i wcześniejszą pracę**:
   W tej fazie samodzielnie odpowiadaj na pytania implementacyjne — nie proś użytkownika o podejmowanie tych decyzji.

   **Dla zadań programistycznych** zbadaj bazę kodu:
   - Jakich wzorców używa baza kodu dla podobnych funkcji?
   - Jakie jest ustalone podejście do obsługi błędów / logowania / testowania?
   - Które istniejące komponenty lub narzędzia pomocnicze można wykorzystać ponownie?
   - Jakie ograniczenia narzuca bieżąca architektura?

   **Dla zadań nieprogramistycznych** zbadaj pliki kontekstowe i wcześniejszą pracę:
   - Jakie formaty, struktury lub szablony stosowano wcześniej do podobnej pracy?
   - Jakie ograniczenia wynikają z wcześniejszych decyzji, odbiorców lub platformy?
   - Jakie powiązane treści lub procesy już istnieją, z którymi to powinno być zgodne?
   - Co działało dobrze (lub nie) w poprzednich iteracjach?

   **To NIE jest decyzja dla użytkowników** — ustalasz to przez badanie istniejących wzorców, plików i kontekstu.

2. **Jeśli użytkownik skoryguje jakiekolwiek nieporozumienie**:
   - Przyjmij zmienione preferencje jako najnowszą decyzję użytkownika; nie żądaj dowodu źródłowego dla preferencji.
   - Zweryfikuj skorygowane twierdzenia faktyczne w nazwanym źródle; deleguj tylko, jeśli niezależne dochodzenie jest użyteczne
   - Przeczytaj objęte korektą pliki lub sekcje, zachowując niepowiązane zweryfikowane ustalenia
   - Kontynuuj dopiero po samodzielnym zweryfikowaniu faktów

3. **Zaktualizuj nierozstrzygnięte pytania i właścicieli**:
   Ponownie użyj roboczej listy z Kroku 1. Śledź pracę w wielu obszarach za pomocą natywnych narzędzi zadań, jeśli są dostępne; dla pojedynczego sprawdzenia nie jest potrzebna dodatkowa formalność śledzenia.

4. **Badaj tylko pozostałe luki**:
   Zastosuj referencję orkiestracji dla delegacji o zawężonym zakresie, dostępnych wyborów modeli, awarii uruchomień i nieaktualnych wyników. Niezależne zadania mogą działać równolegle; zadania zależne czekają na warunek wstępny. Ponownie użyj istniejącego workera do skoncentrowanego follow-upu.

5. **Zamknij odkrywanie na granicy dowodów**:
   Syntetyzuj wyniki w miarę ich napływu; zweryfikuj istotne twierdzenia i rozstrzygnij materialne konflikty. Zatrzymaj się, gdy potrafisz wyjaśnić dotknięte kontrakty, wzorce do ponownego użycia, weryfikację i pozostałe decyzje użytkownika. Anuluj nieistotne eksploracje. Niezakończone wymagane sprawdzenia pozostają blokujące; nie zastępuj dowodów budżetem czasu.

6. **Przedstaw ustalenia i opcje projektowe za pomocą AskUserQuestion**:

   Najpierw przedstaw krótkie podsumowanie ustaleń badawczych:

   ```
   Na podstawie moich badań oto, co znalazłem(-am):

   **Stan bieżący:**
   - [Kluczowe odkrycie dotyczące istniejącego kodu]
   - [Wzorzec lub konwencja do zastosowania]
   ```

   Sprawdź podejścia względem ustalonych wymagań, zanim je zaoferujesz. Odrzuć opcje, które pomijają wymagane gwarancje; nie wymyślaj alternatyw, aby wypełnić limit. Rozróżniaj decyzje użytkownika od brakujących dowodów i szczegółów implementacji, które agent może wyprowadzić.

   Następnie, jeśli istnieje wiele poprawnych podejść, przedstaw je jako ustrukturyzowane wybory za pomocą AskUserQuestion:

   AskUserQuestion:
   - question: "Którego podejścia implementacyjnego powinniśmy użyć?"
     header: "Podejście"
     options:
     - label: "⭐ Recommended: [Option A] (Recommended)"
       description: "[Co robi A]. · Strength: [Zaleta poparta dowodami]. · Tradeoff: [Konkretny koszt lub ograniczenie]."
     - label: "[Nazwa opcji B]"
       description: "[Co robi B]. · Strength: [Zaleta poparta dowodami]. · Tradeoff: [Konkretny koszt lub ograniczenie]."

   Jeśli wyraźnie istnieje jedno najlepsze podejście, pomiń AskUserQuestion i wyjaśnij, dlaczego je wybrano.
   Pytaj tylko wtedy, gdy wybór rzeczywiście ma znaczenie i nie możesz ustalić odpowiedzi na podstawie wzorców bazy kodu.

### Krok 3: Opracowanie struktury planu

Po uzgodnieniu podejścia:

1. **Przedstaw zarys planu i uzyskaj ustrukturyzowaną opinię**:

   Najpierw wypisz proponowane fazy jako tekst (informacyjnie):

   ```
   Oto moja proponowana struktura planu:

   ## Przegląd
   [Podsumowanie w 1-2 zdaniach]

   ## Fazy implementacji:
   1. [Nazwa fazy] - [co realizuje]
   2. [Nazwa fazy] - [co realizuje]
   3. [Nazwa fazy] - [co realizuje]
   ```

   Następnie użyj AskUserQuestion:
   - question: "Czy ten podział na fazy wygląda właściwie?"
     header: "Fazy"
     options:
     - label: "⭐ Recommended: Approve phases (Recommended)"
       description: "Napisz szczegółowy plan z tymi fazami. · Strength: Wykorzystuje przejrzaną strukturę. · Tradeoff: Późniejsze zmiany zakresu wymagają jej ponownego przejrzenia."
     - label: "Wymaga dostosowania"
       description: "Zrewiduj zakres lub kolejność faz. · Strength: Rozwiązuje brakujące ograniczenia teraz. · Tradeoff: Dodaje rundę planowania."
     - label: "Zbyt szczegółowo"
       description: "Połącz fazy w większe jednostki. · Strength: Zmniejsza narzut koordynacyjny. · Tradeoff: Każdy krok weryfikacji obejmuje więcej pracy."
       multiSelect: false

### Krok 4: Pisanie szczegółowego planu

Po zatwierdzeniu struktury:

Jeśli zapis do repozytorium jest zabroniony, przygotuj kompletny plan przy użyciu [references/plan-templates.md](references/plan-templates.md) oraz briefu z Kroku 4.5 **w rozmowie**, a następnie uruchom przekazanie utrwalania z `references/plan-persistence.md`. Nie twórz folderów, nie aktualizuj metadanych, nie zapisuj wersji roboczej gdzie indziej ani nie deleguj zapisów, aby obejść ograniczenie hosta. To jest `awaiting_persistence`, a nie zapisany lub ukończony plan. Host z możliwością zapisu stosuje bezpośrednio poniższą normalną ścieżkę.

1. **Rozwiąż folder zmiany, a następnie zapisz plan** do `context/changes/<change-id>/plan.md`.
   - Jeśli użytkownik wywołał `/10x-plan <change-id>`, a `context/changes/<change-id>/` już istnieje, użyj go.
   - W przeciwnym razie wyprowadź kebab-case `<change-id>` z tematu i utwórz folder + `change.md` (odzwierciedlając semantykę `/10x-new`) przed zapisem.
   - Odmów, jeśli rozwiązana ścieżka zaczyna się od `context/archive/` — wypisz: "This change is archived. Open a new change with `/10x-new` instead." i ZATRZYMAJ SIĘ.
   - Po zapisaniu i zweryfikowaniu zarówno planu, jak i briefu, przeprowadź wyłącznie `new`/`preparing` do `planned` oraz ustaw `updated: <today>`; zachowaj tożsamość, niepowiązane metadane i późniejsze stany cyklu życia. Użyj ograniczonego helpera metadanych/fallbacku w [plan-persistence.md](references/plan-persistence.md#reuse-the-metadata-helper).
   - **Zsynchronizuj roadmapę** (best effort): jeśli `context/foundation/roadmap.md` zawiera pozycję, której `Change ID` jest równe `<change-id>`, ustaw status tej pozycji na `Status: planning`. Zobacz „## Roadmap status sync” poniżej. Nigdy nie blokuje; większości zmian nie da się powiązać z roadmapą.
2. **Teraz przeczytaj [references/plan-templates.md](references/plan-templates.md) i użyj jego struktury pełnego planu.** Bloki faz zawierają zwykłe wypunktowania — `- `, a nie `- [ ]` — a pojedyncza kanoniczna sekcja `## Progress` na dole zarządza stanem checkboxów; zobacz `references/progress-format.md`. Nie ładuj szablonów artefaktów podczas odkrywania tylko po to, by przygotować się do późniejszego zapisu.

Sekcja Progress jest mechaniczna — utwórz po jednym `### Phase N: <name>` dla każdej fazy, z podsekcjami `#### Automated` / `#### Manual` wyliczającymi każde wypunktowanie Success Criteria z tej fazy jako `- [ ] <phase>.<index> <title>`. Pomiń puste podsekcje. Same bloki faz zawierają zwykłe wypunktowania `- ` (bez checkboxów); sekcja `## Progress` jest jedynym miejscem, gdzie pojawiają się `[ ]` / `[x]`.

### Krok 4.5: Brief planu (dwie strony)

Po napisaniu pełnego planu utwórz zwięzły brief, który daje czytelnikowi obraz całości, zanim zagłębi się w szczegółowy plan. Brief jest pierwszą rzeczą, którą czyta użytkownik — jego przeczytanie powinno zająć mniej niż 2 minuty i pozostawić jasny model mentalny tego, co robi plan, dlaczego oraz jakie były kluczowe decyzje.

1. **Zapisz brief** do `context/changes/<change-id>/plan-brief.md` (obok `plan.md` w tym samym folderze zmiany).

2. **Użyj szablonu briefu z [references/plan-templates.md](references/plan-templates.md)**:

3. **Kluczowe zasady briefu**:
   - Musi mieścić się na około 2 wydrukowanych stronach (~60-80 linii Markdown). Jeśli jest dłuższy, skróć go.
   - Tabela „Key Decisions” jest sednem — pokazuje, co zdecydowano podczas pytań, aby każdy, kto czyta plan później, rozumiał wybory bez ponownego czytania wszystkich pytań.
   - „Starting Point” osadza czytelnika w tym, co istnieje obecnie — bez niego osoba nieznająca projektu nie może zrozumieć różnicy.
   - „Prerequisites & Estimated effort” na dole tabeli Phases zapewnia czytelnikowi szybkie sprawdzenie wykonalności przed zobowiązaniem się do przeczytania całego planu.
   - Pisz dla kogoś, kto nie uczestniczył w rozmowie planistycznej — powinien zrozumieć kształt i uzasadnienie planu wyłącznie na podstawie briefu.
   - Umieść link do pełnego planu na górze, aby czytelnik mógł zagłębić się w dowolną sekcję.
   - Wyprowadź brief z tego samego najnowszego zapisu decyzji co plan. Podczas istniejącego przebiegu przeglądu porównaj twierdzenia, liczby, przykłady i wykluczenia w obu dokumentach; popraw sprzeczności przed utrwaleniem. Dla każdego zmienionego parametru wygeneruj ponownie zależne literalne przykłady i oczekiwane wyniki na podstawie tego parametru; nie zachowuj poprzedniego oczekiwanego ciągu, aktualizując jedynie tabelę decyzji. Sprawdź wymagane sekcje, w tym References, względem już załadowanego szablonu. Strukturalnie poprawna tabela nie ustanawia zgodności z otaczającym ją tekstem.

### Krok 5: Synchronizacja i przegląd

Przy `$10x-plan <change-id> save` (oraz ścieżce utrwalania w [plan-persistence.md](references/plan-persistence.md)) **pomiń tę sekcję**. Ta ścieżka już obsługuje jeden preflight `inspect`, jeden zapis, jedno przejście weryfikacji oraz jedno `mark-planned`. Nie dodawaj drugiego odczytu zwrotnego, drugiego uruchomienia helpera ani własnoręcznie stworzonego walidatora Markdown.

1. **Potwierdź, że plan + brief trafiły do folderu zmiany** (tylko planowanie w sesji z możliwością zapisu; nie ścieżka zapisu):
   - `ls context/changes/<change-id>/plan.md context/changes/<change-id>/plan-brief.md` — oba powinny istnieć.
   - Przeczytaj zapisaną treść ponownie jeden raz. Zweryfikuj, że najnowsze decyzje i korekty są zgodne w obu dokumentach, wymagane sekcje planu/briefu są obecne oraz że Success Criteria każdej fazy mapują się jeden do jednego na kanoniczny wiersz Progress. Tylko nowe wiersze planowania muszą być niezaznaczone; powtórne zapisy zachowują istniejący Progress wykonania i późniejszy stan cyklu życia w ścieżce utrwalania. Zachowaj niepowiązane metadane. Kontrole mechaniczne mogą czytać całe pliki, zwracając jedynie liczby, hashe i możliwe do wykonania błędy; sprawdzaj treść semantyczną względem uzgodnionego planu. Nie wyświetlaj wielokrotnie wszystkich trzech dokumentów. Zgłoś ukończenie dopiero po tych kontrolach; samo istnienie pliku nie wystarcza.

2. **Skopiuj polecenie szybkiego startu do schowka**:
   - Po zapisaniu planu skopiuj do schowka polecenie implementacji:

   ```bash
   echo -n "/10x-implement <change-id> phase 1" | pbcopy 2>/dev/null || echo -n "/10x-implement <change-id> phase 1" | clip.exe 2>/dev/null || echo -n "/10x-implement <change-id> phase 1" | xclip -selection clipboard 2>/dev/null || true
   ```

   ```powershell
   # PowerShell (Windows)
   Set-Clipboard "/10x-implement <change-id> phase 1"
   ```

3. **Przedstaw zarówno brief, jak i pełny plan**:

   ```
   Utworzyłem(-am) plan implementacji:

   📋 Brief (zacznij tutaj): `context/changes/<change-id>/plan-brief.md`
   📄 Pełny plan: `context/changes/<change-id>/plan.md`

   → /10x-implement <change-id> phase 1 (✓ skopiowano)

   Najpierw przejrzyj brief, a następnie sprawdź pełny plan pod kątem elementów wymagających dostosowania:
   - Czy fazy mają właściwy zakres?
   - Czy kryteria sukcesu są wystarczająco konkretne?
   - Czy jakieś szczegóły techniczne wymagają dostosowania?
   - Czy brakuje przypadków brzegowych lub kwestii do rozważenia?
   ```

4. **Iteruj na podstawie opinii** — bądź gotowy(-a), aby:
   - Dodać brakujące fazy
   - Dostosować podejście techniczne
   - Doprecyzować kryteria sukcesu (zarówno automatyczne, jak i ręczne)
   - Dodać/usunąć elementy zakresu

5. **Kontynuuj dopracowywanie**, aż użytkownik będzie zadowolony

## Synchronizacja statusu roadmapy

`context/foundation/roadmap.md` (tworzona przez `/10x-roadmap`) indeksuje każdą Foundation/Slice za pomocą stabilnego **Change ID**. Gdy planowanie przekształca pozycję roadmapy w konkretny folder zmiany + plan, oznacz tę pozycję jako **`planning`**, aby roadmapa odzwierciedlała, że element opuścił backlog i wszedł do aktywnej pracy. `/10x-implement` później przeprowadza tę samą pozycję do `in-progress`, a `/10x-archive` zamyka ją jako `done`.

Wykonaj to w Kroku 4 (tuż po stemplu `change.md` → `planned`). Wyszukiwanie jest **obowiązkowe**; „best effort” dotyczy wyłącznie *edycji* — brak roadmapy lub nieznaleziony cel jest pomijany po cichu i nigdy nie blokuje, nie wyświetla pytań ani nie przerywa działania. Nie pomijaj sprawdzenia, zakładając, że nie ma roadmapy.

1. `test -f context/foundation/roadmap.md`. Jeśli nie istnieje, pomiń ten krok po cichu.
2. Przeczytaj plik. Szukaj `<change-id>` użytego jako `Change ID`:
   - w tabeli `## At a glance` — wiersz, którego komórka kolumny **Change ID** jest dokładnie równa `<change-id>`;
   - oraz w treści `## Foundations` / `## Slices` — blok `### <ID>: …`, który zawiera linię `- **Change ID:** <change-id>`.

   Dopasowanie wyłącznie na zasadzie dokładnego ciągu. **Brak dopasowania** → wypisz `ℹ context/foundation/roadmap.md has no item with Change ID "<change-id>" — roadmap left untouched.` i zakończ tutaj.
3. **Znaleziono dopasowanie** → jeśli `- **Status:**` pozycji ma już wartość `planning`, `in-progress` lub `done`, pozostaw ją bez zmian (**tylko do przodu**: nigdy nie cofaj bardziej zaawansowanego statusu) i zakończ. W przeciwnym razie zastosuj obie edycje za pomocą narzędzia Edit — każdą niezależnie i best effort; pomiń podedycję, której cel nie znajduje się tam, gdzie umieszcza go szablon `/10x-roadmap`, i odnotuj pominięcie. Zmieniaj tylko pole `Status`:
   1. **`## At a glance`** — ustaw komórkę **Status** dopasowanego wiersza na `planning`.
   2. **Treść pozycji** — przepisz linię `- **Status:**` pozycji na `- **Status:** planning`.

   Następnie zaktualizuj roadmap frontmatter `updated:` do `<today>` (pomiń, jeśli nie ma frontmatter).
4. `/10x-plan` nie commitują własnych artefaktów; pozostaw zmianę w drzewie roboczym. Jest commitowana później razem z pierwszą fazą `/10x-implement` zmiany (która ponownie przełącza tę samą pozycję na `in-progress`).

## Ważne wytyczne

1. **Bądź sceptyczny(-a)**:
   - Kwestionuj niejasne wymagania
   - Wcześnie identyfikuj potencjalne problemy
   - Pytaj „dlaczego” i „a co z”
   - Nie zakładaj — weryfikuj w kodzie, plikach lub kontekście

2. **Bądź interaktywny(-a)**:
   - Nie pisz całego planu jednorazowo
   - Uzyskuj akceptację na każdym głównym etapie
   - Pozwalaj na korekty kursu
   - Współpracuj

3. **Bądź dokładny(-a)**:
   - Przeczytaj CAŁKOWICIE wszystkie pliki kontekstowe przed planowaniem
   - Badaj nierozstrzygnięte wzorce lokalnie lub przez niezależne zadania o zawężonym zakresie, używając referencji orkiestracji
   - Dołączaj konkretne referencje (`file:line` dla kodu, ścieżki dokumentów dla treści)
   - Pisz mierzalne kryteria sukcesu z wyraźnym rozróżnieniem automatycznych i ręcznych

4. **Bądź praktyczny(-a)**:
   - Skupiaj się na przyrostowych, testowalnych zmianach
   - Rozważ migrację i wycofanie
   - Myśl o przypadkach brzegowych
   - Uwzględniaj „czego NIE robimy”

5. **Śledź postęp**:
   - Ponownie używaj listy nierozstrzygniętych pytań; natywne narzędzia zadań są opcjonalne i zależne od hosta
   - Dokładnie oznaczaj ukończoną, zablokowaną i anulowaną pracę; unikaj ewidencji dla pojedynczego sprawdzenia

6. **OBOWIĄZKOWE: Dogłębne pytania skalowane według złożoności przez AskUserQuestion**:
   - **PRZED** napisaniem jakiegokolwiek planu MUSISZ ocenić złożoność (HIGH/MEDIUM/LOW) i uzyskać potwierdzenie użytkownika
   - Używaj skalowania wcześniejszych etapów z Kroku 1.0, jego wyjątku dla ustalonych danych wejściowych oraz łącznego budżetu pytań potwierdzonego przez użytkownika; zakresy dla samego zadania nie zastępują zaakceptowanych decyzji z wcześniejszych etapów
   - Każde pytanie musi umieszczać jeden wybór `⭐ Recommended: [short choice] (Recommended)` jako pierwszy; każda opcja wymaga dokładnego formatu opisu Strength/Tradeoff oraz nagłówka o długości maksymalnie 12 znaków
   - Uwzględniaj zakres, przypadki brzegowe, architekturę, model danych, testowanie i wydajność odpowiednio do złożoności
   - Pytaj w rundach obsługiwanych natywnie (Claude 1–4, wskazówka Codex 1–3) w ramach potwierdzonego łącznego budżetu; jawnie rozszerzaj go wyłącznie dla nierozstrzygniętych decyzji
   - Zachowaj potwierdzony wywiad oraz zatwierdzenie natywnej struktury. Dostosowuj budżet wspólnie z użytkownikiem, gdy zmienia się zakres; nigdy nie powtarzaj ustalonych pytań wyłącznie po to, by wypełnić bazowy zakres
   - Poczekaj na odpowiedzi użytkownika przed przejściem do szczegółowego planowania

7. **Brak otwartych pytań w końcowym planie**:
   - Jeśli podczas planowania napotkasz otwarte pytania, ZATRZYMAJ SIĘ
   - Natychmiast zbadaj je lub poproś o wyjaśnienie
   - NIE pisz planu z nierozstrzygniętymi pytaniami
   - Plan implementacji musi być kompletny i możliwy do realizacji
   - Każda decyzja musi zostać podjęta przed finalizacją planu
   - Termin, o którym użytkownik zdecydował, trafia do już istniejących sekcji — do nazwanego testu lub kryterium sukcesu, gdy zaakceptowany, albo do „What We're NOT Doing”, gdy odrzucony. Nie twórz dla niego nowej sekcji
   - Podsekcje „Critical Implementation Details” są opt-in: uwzględniaj je tylko wtedy, gdy występuje rzeczywiste ograniczenie, pułapka lub wymaganie dotyczące kolejności. Domyślnie pomijaj. Plan bez tej sekcji nie jest niekompletny.

8. **Opisuj intencję, a nie implementację**:
   - Plan mówi implementującemu **co zmienić i dlaczego**, a nie jak pisać kod
   - Każda pozycja zmiany w `### Changes Required:` rozdziela `**Intent**` (co i dlaczego) od `**Contract**` (interfejs, sygnatura, pole schematu, trasa, struktura lub niezmiennik, którego dotyka zmiana). Fragmenty kodu, gdy są potrzebne, znajdują się na końcu `**Contract**`
   - Domyślnie nie umieszczaj fragmentów kodu. Dodaj fragment TYLKO wtedy, gdy zmiana nie jest oczywista (trudne regex, nietypowe wywołanie API, nieintuicyjne uporządkowanie, obejście, kontrakt sygnatury, od którego zależą inne fazy)
   - W przypadku rutynowych edycji — dodawania pola, podłączania handlera, stosowania istniejącego wzorca — opisz `**Intent**` w 1-2 zdaniach, nazwij `**Contract**` w jednym i zakończ. Implementujący (człowiek lub agent) ustala kod na podstawie ścieżki pliku, otaczającego wzorca i intencji
   - Ścieżki plików oraz krótkie opisy Intent/Contract zazwyczaj wystarczą. Oprzyj się pokusie wcześniejszego pisania kodu

## Wytyczne dotyczące kryteriów sukcesu

**Zawsze rozdzielaj kryteria sukcesu na dwie kategorie:**

1. **Automated Verification** — polecenia, które agenci mogą uruchomić: `make test`, `npm run lint`, sprawdzenia typów, istnienie konkretnych plików
2. **Manual Verification** — testowanie przez człowieka: UI/UX, wydajność w rzeczywistych warunkach, przypadki brzegowe, akceptacja użytkownika

Kryteria sukcesu każdej fazy używają zwykłych wypunktowań `- ` pod nagłówkami `#### Automated Verification:` i `#### Manual Verification:`. Skopiuj każde kryterium dokładnie raz do kanonicznej sekcji `## Progress` jako niezaznaczony numerowany wiersz; Progress jest jedynym miejscem dla checkboxów wykonania.

## Typowe wzorce

- **Zmiany bazy danych**: schemat/migracja → metody przechowywania → logika biznesowa → API → klienci
- **Nowe funkcje**: badanie wzorców → model danych → backend → API → UI
- **Refaktoryzacja**: udokumentowanie zachowania → zmiany przyrostowe → kompatybilność wsteczna → migracja

## Koordynacja zadań

[Referencja orkiestracji](references/task-orchestration.md) zarządza wyborem zadań, delegacją, fallbackiem możliwości modeli, przeglądem dowodów i zatrzymywaniem. Nie zastępuje natywnych pytań, zatwierdzenia struktury ani ścieżki zapisu zależnej od trybu. Nie wywołuj rekomendatora modelu implementacyjnego jedynie po to, aby zakończyć badania lub zapisać uzgodniony plan.

- **Uruchamiaj wielu podagentów równolegle** w jednej wiadomości — 2–3 w fazie badawczej — zamiast jednego po drugim.
- **Utrzymuj każde zadanie skupione** na konkretnym obszarze, z szczegółowymi instrukcjami (katalogi, co wyodrębnić, oczekiwany format).
- **Żądaj konkretnych referencji `file:line`** w odpowiedziach.
- **Poczekaj, aż wszyscy wysłani podagenci zakończą pracę**, zanim zsyntetyzujesz ustalenia.
- **Weryfikuj wyniki podagentów** — jeśli ustalenie jest nieoczekiwane, wyślij follow-up i skonfrontuj je z rzeczywistym kodem.

## Zarządzanie kontekstem

Planowanie może być obciążające dla kontekstu ze względu na badania + iteracje. Utrzymuj efektywność kontekstu:

- **Deleguj badania do podagentów** — zwracają oni podsumowania, utrzymując zwięzłość głównego kontekstu. Nie czytaj ponownie plików przeanalizowanych już przez podagentów, chyba że potrzebujesz zweryfikować konkretne szczegóły.
- **Syntetyzuj, nie gromadź** — po powrocie podagentów syntetyzuj ustalenia w swoim zrozumieniu, zamiast cytować dosłownie duże bloki.
- **Jeśli kontekst wydaje się pogarszać podczas planowania** — jeśli odpowiedzi stają się powolne lub powtarzalne, zapisz bieżącą wersję roboczą planu do pliku i zaproponuj użytkownikowi kontynuację w świeżym kontekście:
  Rób to tylko, gdy host zezwala na zapis do repozytorium. W trybie planowania tylko do odczytu użyj przekazania rozmowy z `references/plan-persistence.md`; nie twierdź, że wersja robocza została zapisana, ani nie obiecuj, że nowa rozmowa odzyska niedostępne decyzje.
  ```
  Wersja robocza planu jest zapisana w: context/changes/<change-id>/plan.md
  Czy chcesz kontynuować dopracowywanie w świeżym oknie?
  → /10x-plan <change-id> (✓ skopiowano)
  ```
  Dzięki temu `/10x-plan` może ponownie załadować wersję roboczą i kontynuować iteracje z pełnym dostępnym kontekstem.

## Dodatkowe przykłady pytań

Jeśli trudno sformułować pytanie specyficzne dla funkcji, zapoznaj się z [references/question-examples.md](references/question-examples.md). Powyższy format pytań i skalowanie wcześniejszych etapów pozostają autorytatywne; przykłady nie ustanawiają zmierzonych korzyści wydajnościowych.