---
name: 10x-opportunity-map
description: >
  Turn recurring friction or an unmet need into a
  build-vs-buy-vs-complement-vs-wait decision artifact: an opportunity map with
  the existing/default response, a thin complement, a first useful version, and a
  data-risk caveat, plus one recommended candidate to try. Works for any idea —
  product, feature, internal tool, service, or automation — with a worked
  internal-builder lens. Use when someone wants to classify pain or signals,
  decide whether something is worth building before writing code, or sort a "let's
  build a dashboard / agent / app / automation" idea into build, buy, complement,
  or wait.
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
# Mapa Okazji: Klasyfikuj Pomysły Przed Budowaniem

Ta umiejętność pomaga użytkownikowi zdecydować, czy powtarzające się tarcie lub niezaspokojona potrzeba powinny zostać obsłużone przez istniejące narzędzie lub domyślny przepływ pracy, przez cienkie uzupełnienie wokół tego, co już istnieje, przez pełniejszą realizację później, czy w ogóle bez budowania. Działa dla każdego pomysłu — produktu, funkcji, narzędzia wewnętrznego, usługi lub automatyzacji. Mapowanie okazji jest techniką ogólną; bieżące przykłady wykorzystują **perspektywę wewnętrznego twórcy** (narzędzia zespołowe, usługi, automatyzacje), ponieważ właśnie tam dylemat budować-czy-kupować jest najbardziej odczuwalny i tam podejmuje go ścieżka 10xDevs dla wewnętrznych twórców.

Wynikiem jest artefakt decyzyjny, a nie plan implementacji. Nie pisz kodu SDK, konfiguracji CI, pakietowania, uwierzytelniania, wdrożenia, harmonogramowania ani kroków backlogu/procesu produktowego. Jeśli kandydat okaże się wartościowy, skieruj tę pracę dalej (zobacz Krok 5).

Domyślnie używaj angielskiego. Przełącz się na polski (lub dowolny inny język), jeśli użytkownik pisze do Ciebie w tym języku.

## Początkowa Odpowiedź

Po wywołaniu:

1. Jeśli użytkownik podał sygnały tarcia, notatki, tickety, notatki ze spotkań lub ścieżkę do pliku, odczytaj/przechwyć je i kontynuuj.
2. Jeśli nie podano konkretnych danych wejściowych, poproś o **3–5 powtarzających się tarć lub niezaspokojonych potrzeb** oraz **źródła**, które za nimi stoją (GitHub, Linear/Jira, CI, Slack, dokumentacja, tickety wsparcia, analityka, wewnętrzna DB, CSV/dane mock). Zachowaj otwartość — tarcie ma dowolną formę; nie zmuszaj go do dopasowania do opcji.
3. Przechwyć **ograniczenie dotyczące danych** za pomocą AskUserQuestion, ponieważ zmienia ono to, jak lekka może być pierwsza wersja:

```
AskUserQuestion:
- question: "What data will the first version run on?"
  header: "Data"
  options:
  - label: "Mock / local / read-only / non-sensitive (Recommended)"
    description: "You can start light — no access control or auditing up front."
  - label: "Real company / customer / production data"
    description: "Access, permissions, and auditability thinking moves before implementation."
  - label: "Not sure yet"
    description: "We'll start from the least-sensitive variant and flag this as to-be-decided."
  multiSelect: false
```

Następnie wyjaśnij, że najpierw sklasyfikujesz sygnały i zarekomendujesz pierwszego kandydata tylko wtedy, gdy na to zasłuży.

## Ograniczenia

- Traktuj „zbudujmy dashboard / agenta / aplikację / automatyzację” jako proponowane rozwiązanie, a nie sygnał tarcia. Zapytaj, jaki powtarzający się ból, opóźnienie, koszt koordynacji lub ręczną kontrolę eliminuje.
- Domyślnie kieruj ogólne/praktyczne przepływy pracy do SaaS lub istniejących narzędzi, chyba że użytkownik pokaże lokalne tarcie między systemami.
- Preferuj uzupełnianie systemów źródłowych zamiast ich zastępowania. Pierwsza wersja może linkować do PR-ów, ticketów, jobów, dokumentów i rekordów; nie może udawać, że staje się nowym systemem rejestrującym.
- Utrzymuj pierwszą użyteczną wersję wąską, lokalną, tylko do odczytu i łatwą do porzucenia: skrypt, statyczny raport, podsumowanie CSV, widok podobny do arkusza kalkulacyjnego lub mockowany dashboard.
- Eskaluj ryzyko danych wcześnie. Dane mock/lokalne/tylko do odczytu/niewrażliwe mogą pozostać lekkie. Prawdziwe dane firmowe/klientów wymagają myślenia o kontroli dostępu i audytowalności przed implementacją.
- Obserwuj złożoność istotną kontra przypadkową. Niektóre tarcia są przypadkowe i cienkie uzupełnienie rzeczywiście je skraca; inne są istotne i odzwierciedlają realne ograniczenie lub decyzję. Zanim nazwiesz tarcie „naprawialnym”, sprawdź, czy nie istnieje ono z jakiegoś powodu.
- Nie sugeruj rezultatów (kariery, wzrostu, przychodu). Dźwignia oznacza realnie zmniejszony ból i zdobyte zaufanie, a nie gwarantowany wynik.

## Proces

### Krok 1: Normalizuj Sygnały

Przekształć surowe pomysły w konkretne sygnały. Dobre sygnały są obserwowalne i powtarzalne:

- „Każdego ranka ręcznie sprawdzamy, które PR-y blokują wydanie.”
- „Tickety i zmiany w kodzie rozjeżdżają się, więc trudno ufać statusowi.”
- „Umiejętności i reguły AI są ręcznie kopiowane między repozytoriami.”
- „Komentarze z przeglądu się powtarzają, ale nie są zakodowane jako bramka jakości.”

Słabe sygnały wymagają rozwinięcia:

- „Zbuduj dashboard.”
- „Dodaj agenta.”
- „Zautomatyzuj wszystko.”

Dla każdego słabego sygnału zadaj jedno krótkie pytanie, które oddziela ból od proponowanego rozwiązania.

### Krok 2: Klasyfikuj Każdy Sygnał

Przejdź przez sygnały **po jednym**, jako blok dla każdego sygnału — nie renderuj szerokiej tabeli w środku rozmowy. Każdy blok jest łatwiejszy do przeczytania i skomentowania oraz pozwala użytkownikowi skorygować jeden sygnał, zanim przejdziesz dalej:

```text
Signal: [repeated observable pain or unmet need]
  Existing / default response: [what existing tools or workflows already do]
  Thin complement: [the smallest complement around existing systems]
  First useful version: [local/read-only/mockable check]
  Data risk: [mock / local / read-only / non-sensitive / real company-customer data]
  Direction if it proves valuable: [product / feature / internal tool / service / wait]
```

Wskazówki dla każdego pola — zachowaj zwięzłość komórek w końcowej tabeli (fraza, nie akapit); dłuższe uzasadnienie przenieś do Kroku 4 i notatki „Dlaczego ten kandydat”:

- **Sygnał**: powtarzający się obserwowalny ból lub niezaspokojona potrzeba, najlepiej z kosztem koordynacji.
- **Istniejąca / domyślna odpowiedź**: co GitHub, Linear/Jira, Slack, Notion, CI, dashboardy, natywne podsumowania AI, raporty, filtry, gotowy SaaS lub istniejące procesy już robią.
- **Cienkie uzupełnienie**: uzupełnienie wokół istniejących systemów, szczególnie gdy wartość wynika z połączenia dwóch lub większej liczby źródeł.
- **Pierwsza użyteczna wersja**: lokalna/tylko do odczytu/możliwa do zamockowania wersja, która weryfikuje wartość bez pełnej odpowiedzialności produktowej.
- **Ryzyko danych**: `mock`, `local`, `read-only`, `non-sensitive` lub `real company/customer data`; dodaj praktyczne zastrzeżenie, gdy dane są wrażliwe.
- **Kierunek, jeśli okaże się wartościowe** — rodzaj rzeczy, w którą rozwinie się po zdobyciu regularnego użytkownika. Najpierw wybierz ogólny kształt: `Product`, `Feature` w istniejącym produkcie, `Internal tool`, `Service` lub `Wait / no build` (sygnał słaby, już rozwiązany lub niewarty utrzymania). Gdy kształtem jest **narzędzie wewnętrzne**, ścieżki 10xDevs dla wewnętrznych twórców go doprecyzowują:
  - `Team agent`, gdy potrzebuje SDK, narzędzi, wywołań modelu, obsługi kosztów/prywatności lub metryk.
  - `Review / CI gate`, gdy wartością jest przegląd kodu, bramki PR, Definition of Done lub zachowanie CI.
  - `Shared artifact registry`, gdy problem dotyczy współdzielonych umiejętności, promptów, reguł, komend, pakietów lub dystrybucji artefaktów zespołowych.
  - `Async / remote work`, gdy pomocnik powinien działać zdalnie, asynchronicznie lub według harmonogramu.

Po sklasyfikowaniu wszystkich sygnałów możesz odczytać je jako zwartą tabelę porównawczą (jeden wiersz na sygnał, zwięzłe komórki) — ta możliwa do przeskanowania macierz trafia do zapisanego artefaktu.

### Krok 3: Zarekomenduj Jednego Kandydata

Wybierz co najwyżej jednego kandydata na pierwszą użyteczną wersję. Uszereguj według:

1. Powtarza się regularnie.
2. Łączy co najmniej dwa źródła informacji lub dwie role.
3. Ma dziś wyraźny ręczny ból.
4. Może zostać przetestowany tylko do odczytu lub na danych mock/wyeksportowanych.
5. Nie zastępuje odpowiedzialności istniejącej platformy.
6. Ma jasny późniejszy kierunek, jeśli okaże się wartościowy.

Jeśli żaden sygnał nie przejdzie, zarekomenduj brak budowania i wyjaśnij, którego istniejącego narzędzia lub domyślnej odpowiedzi należy najpierw spróbować. Zbudowanie dwóch lub trzech przemyślanych kandydatów jest lepsze niż wypuszczenie dziesięciu prototypów, których nikt nie utrzymuje — ograniczonym zasobem jest uwaga potrzebna do utrzymania ich przy życiu, a nie czas na rozpoczęcie.

### Krok 4: Opracuj Pierwszą Użyteczną Wersję

Dla wybranego kandydata napisz:

```text
Candidate:
[working name]

Reads:
[sources, e.g. GitHub export, Jira CSV, CI logs, mock data]

Returns:
[short report/view/digest description]

Does not do:
[what is intentionally excluded now]

Data risk:
[mock/local/read-only/non-sensitive or real company/customer data; for real data, say what access limitation must come first]

Direction if it proves valuable:
[product / feature / internal tool / service / wait]
```

Następnie dodaj krótką notatkę „Dlaczego ten, a nie pozostałe”.

### Krok 5: Zdecyduj o Następnym Ruchu

Mapa okazji klasyfikuje problem na papierze. Przed przekształceniem klasyfikacji w kod zdecyduj, jak postępować:

```
AskUserQuestion:
- question: "You have a map and a candidate. What next?"
  header: "Next"
  options:
  - label: "Validate, then shape — /10x-mom-test → /10x-shape (Recommended)"
    description: "Pressure-test the problem in conversations about past behavior. If it survives, the validated opportunity feeds /10x-shape → /10x-prd → /10x-roadmap."
  - label: "Shape now without validating — /10x-shape → /10x-prd → /10x-roadmap"
    description: "Only when you are already confident the problem is real and the risk is understood. Skips the cheapest evidence step."
  - label: "Go straight to building — /10x-new → /10x-research → /10x-plan → /10x-implement"
    description: "When the signal is narrow, the first version is clear, and the risks are understood."
  - label: "Nothing for now"
    description: "Save the map and come back when more signals accumulate."
  multiSelect: false
```

Niezależnie od wybranej ścieżki, najtańszym pierwszym krokiem jest zwykle krótka rozmowa z osobami, które żyją z tym tarciem (w przypadku narzędzia wewnętrznego — z menedżerem i zespołem, dla którego jest przeznaczone) — często wiedzą, dlaczego tarcie istnieje i czy Twój obraz sytuacji jest pełny. W wiadomości końcowej nazwij wybraną umiejętność; nie uruchamiaj jej samodzielnie, chyba że użytkownik o to poprosi.

## Artefakt

Zaproponuj zapisanie wyniku. Użyj AskUserQuestion:

```
AskUserQuestion:
- question: "Save the opportunity map to a file?"
  header: "Save"
  options:
  - label: "Yes — context/team/opportunity-map.md (Recommended)"
    description: "The standard path. I'll create the directory if it's missing."
  - label: "Different path"
    description: "Give your own file location."
  - label: "Don't save"
    description: "Keep the map in the conversation only."
  multiSelect: false
```

Podczas zapisywania utwórz katalog docelowy, jeśli jest potrzebny (`mkdir -p`). Użyj takiej struktury pliku:

```markdown
# Opportunity Map

## Context

- **Project / context**:
- **Data constraint**:
- **Date**:

## Map

One row per signal, terse cells (a phrase each) — longer reasoning belongs in the sections below:

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|

## Recommended First Candidate

[first useful version block]

## Why This Candidate

[brief justification]

## Next Direction If Valuable

[direction and rationale]
```