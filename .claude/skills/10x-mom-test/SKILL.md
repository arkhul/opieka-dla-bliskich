---
name: 10x-mom-test
description: >
  Validate any idea — product, feature, internal tool, service, or workflow —
  using The Mom Test principles before building. Use after someone has a draft
  idea or supporting notes (user interviews, tickets, or a shape/PRD/roadmap/
  opportunity-map) and wants to check whether the problem is real. Produces a
  non-leading critique, an interview guide, survey questions, and go/no-go
  decision criteria grounded in past behavior and concrete pain, not opinions
  about the solution.
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---
# Mom Test: Zweryfikuj problem przed rozpoczęciem budowy

Ta umiejętność poddaje pomysł testowi wytrzymałościowemu przed implementacją. Pomaga użytkownikowi uniknąć uprzejmych fałszywie pozytywnych odpowiedzi, deklaracji aspiracyjnych oraz ankiet, które proszą ludzi o zaakceptowanie rozwiązania, którego nigdy faktycznie nie potrzebowali. Działa dla każdego rodzaju pomysłu — aplikacji konsumenckiej, B2B SaaS, funkcji, narzędzia wewnętrznego lub działalności usługowej.

Domyślnie używaj angielskiego. Przełącz się na polski (lub dowolny inny język), jeśli użytkownik pisze do Ciebie w tym języku.

## Główna zasada

Nigdy nie pytaj, czy ludziom podoba się pomysł, czy używaliby produktu ani czy uważają funkcję za przydatną. Pytaj o to, co już robią, co wydarzyło się niedawno, czego próbowali, jaki koszt ponieśli oraz jakie obejście stosują obecnie.

Dobre pytania ujawniają zachowania (w różnych dziedzinach):

- „Opowiedz mi krok po kroku o ostatnim razie, gdy próbowałeś zaplanować posiłki na tydzień — co faktycznie zrobiłeś?”
- „Co zrobiłeś ostatnim razem, gdy faktura nie zgadzała się z wykonaną pracą?”
- „Kiedy ostatnio ręcznie sprawdzałeś, które PR-y blokowały wydanie?”
- „Jak radzisz sobie z tym dzisiaj, bez żadnego nowego narzędzia?”

Słabe pytania zachęcają do uprzejmości lub fantazjowania:

- „Czy używałbyś takiego produktu?”
- „Czy podoba Ci się ten pomysł?”
- „Czy dashboard z tymi danymi byłby przydatny?”
- „Ile zapłaciłbyś za to?”

## Dane wejściowe

Akceptuj dowolne z poniższych:

- pomysł podany w treści,
- notatki od użytkowników, klientów, zgłoszenia, incydenty, wątki wsparcia, notatki ze spotkań lub wcześniejszych wywiadów,
- artefakt pomocniczy, jeśli istnieje, taki jak `context/team/opportunity-map.md`, `context/foundation/shape-notes.md`, `context/foundation/prd.md` lub `context/foundation/roadmap.md`.

Jeśli nie ma danych wejściowych, poproś o:

1. rozważany pomysł lub rozwiązanie,
2. docelowych użytkowników, klientów lub role,
3. podejrzewany problem lub trudność,
4. czy użytkownik chce wywiadów, ankiety czy obu.

## Proces

### Krok 1: Wyodrębnij hipotezy

Przeczytaj dostarczony materiał i wyodrębnij:

- **Użytkownik/rola**: kto ma problem.
- **Podejrzewana trudność**: jaki powtarzający się problem występuje.
- **Obecne obejście**: jak użytkownik prawdopodobnie rozwiązuje to dzisiaj.
- **Proponowane rozwiązanie**: co twórca chce stworzyć.
- **Ryzykowne założenia**: twierdzenia, które mogą być błędne.
- **Istniejące już dowody**: fakty z logów, zgłoszeń, wywiadów, incydentów lub danych o użyciu.

Oddziel fakty od przypuszczeń. Jeśli PRD jest dopracowane, ale dowody są skąpe, powiedz to wprost.

### Krok 2: Podważ pomysł w rozmowie

Przeprowadź krótką krytykę przed wygenerowaniem pytań:

- W którym miejscu użytkownik może mylić rozwiązanie z problemem?
- Które założenia zależą od przyszłych intencji zamiast przeszłych zachowań?
- Co udowodniłoby, że nie warto budować rozwiązania dla tego problemu?
- Jaki istniejący produkt, narzędzie, proces lub ręczne obejście może być już wystarczająco dobre?
- Co byłoby uznane za mocny dowód, aby kontynuować?

Zadaj najwyżej trzy pytania doprecyzowujące, tylko gdy są potrzebne. Preferuj pytania o użytkowników, niedawne incydenty, obecne obejścia lub wagę decyzji.

### Krok 3: Przepisz złe pytania

Jeśli użytkownik dostarczy robocze pytania, sklasyfikuj każde z nich:

- `keep`: konkretne i oparte na zachowaniu,
- `rewrite`: użyteczna intencja, ale pytanie sugerujące odpowiedź lub abstrakcyjne,
- `drop`: prosi o komplementy, hipotetyczne odpowiedzi, fantazje o cenie lub aprobatę rozwiązania.

Dla każdego przepisania pokaż:

```text
Instead of:
[bad question]

Ask:
[better question]

Why:
[what signal this question can reveal]
```

### Krok 4: Przygotuj przewodnik do wywiadu

Utwórz przewodnik do wywiadu trwającego 20–30 minut:

1. **Rozgrzewka kontekstowa**: rola, przepływ pracy, częstotliwość.
2. **Niedawna historia**: zapytaj o ostatnie rzeczywiste wystąpienie trudności.
3. **Obecne obejście**: narzędzia, ludzie, artefakty, czas, błędy.
4. **Koszt problemu**: opóźnienia, poprawki, ryzyko, obciążenie koordynacyjne.
5. **Istniejące alternatywy**: produkty, narzędzia, skrypty, dashboardy, ręczne nawyki lub rytuały.
6. **Sygnał decyzyjny**: co sprawiłoby, że warto byłoby to zmienić.
7. **Prośba na zakończenie**: zgoda na dalszy kontakt lub wgląd w zanonimizowane artefakty.

Uwzględnij 8–12 pytań. Zachowaj ich neutralność. Dodaj opcjonalne pytania pogłębiające dla interesujących odpowiedzi.

### Krok 5: Przygotuj ankietę

Utwórz krótką ankietę, aby uzyskać szerszy sygnał:

- Maksymalnie 6–10 pytań.
- Preferuj zakresy wielokrotnego wyboru dla częstotliwości i nakładu pracy.
- Uwzględnij 1–2 otwarte pytania o niedawne przykłady.
- Unikaj proszenia użytkowników o ocenę rozwiązania, którego nie doświadczyli.
- Uwzględnij jedno pytanie filtrujące, które sprawdza, czy respondent faktycznie ma do czynienia z danym przepływem pracy.

Ankieta powinna dostarczać dowodów do decyzji go/no-go, a nie aplauzu.

### Krok 6: Zdefiniuj kryteria decyzji

Zakończ konkretnymi kryteriami:

- **Kontynuuj** jeśli: [obserwowalny próg]
- **Zawęź zakres** jeśli: [mieszany sygnał]
- **Nie buduj jeszcze** jeśli: [słaby sygnał]
- **Najpierw wypróbuj istniejące narzędzie/proces** jeśli: [istniejący produkt, narzędzie lub proces jest już wystarczająco dobry]

Użyj progów odpowiednich do kontekstu, na przykład:

- „Co najmniej 3 z 5 rozmówców opisuje to samo niedawne obejście bez podpowiedzi.”
- „Co najmniej 40% badanych docelowych użytkowników zgłasza, że dzieje się to co tydzień lub częściej.”
- „Problem kosztuje mierzalny czas, pieniądze lub dodatkową pracę — a nie jest jedynie lekką niedogodnością.”

## Artefakt wyjściowy

Zaproponuj zapisanie wyniku do `context/team/mom-test-validation.md`, gdy istnieje katalog `context/` lub użytkownik chce trwałego artefaktu. Utwórz katalog `context/team/`, jeśli nie istnieje (`mkdir -p`). Jeśli użytkownik preferuje inną ścieżkę, użyj jej.

Użyj następującej struktury:

```markdown
# Mom Test Validation Plan

## Input Idea

[short summary]

## Hypotheses

- **User/role**:
- **Friction**:
- **Current workaround**:
- **Risky assumptions**:
- **Evidence already present**:

## Critique

[non-leading critique]

## Interview Guide

[questions + follow-ups]

## Survey

[questions]

## Decision Criteria

- **Proceed**:
- **Narrow scope**:
- **Do not build yet**:
- **Try existing tool/process first**:
```