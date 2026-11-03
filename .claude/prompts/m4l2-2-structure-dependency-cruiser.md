# Mapa strukturalna — jak to jest zbudowane (dependency-cruiser)

Seria promptów do analizy grafu zależności w nowej sesji, wychodząc od `context/map/artifact-1-territory.md`. Wynik zapisz do `context/map/artifact-2-structure.md`.

## Konfiguracja narzędzia

```text
Zapoznaj się z https://raw.githubusercontent.com/sverweij/dependency-cruiser/refs/heads/main/doc/cli.md i skonfiguruj to narzędzie w moim projekcie.
```

## Rozpoznanie możliwości

```text
Daj mi top 3 pomysły na eksplorację kodu legacy z biblioteką dependency-cruiser.

Chcę zrozumieć istotne i najbardziej wrażliwe na zmiany obszary, a także potencjalny dług technologiczny.

Jakiego rodzaju raporty mogę generować?
```

## Cykle w aktywnych obszarach

```text
Użyj dependency-cruiser dla `webapp` i sprawdź cykle zależności w najaktywniejszych obszarach z `context/map/artifact-1-territory.md`: `channels/src/components/admin_console`, `channels/src/packages`, `channels/src/utils`, `channels/src/actions`, `platform/client/src`, `platform/types/src`.

Nie interesuje mnie pełna lista wszystkiego w repo. Chcę zobaczyć tylko te cykle, które dotykają obszarów aktywnych według mapy terytorium. Oddziel cykle z importów działających w runtime od tych, które tworzą same importy typów albo importy z katalogów builda (np. `dist`) — te drugie nie są problemem architektonicznym. Dla każdego cyklu podaj najmniejszą realną pętlę (cykl dwóch plików, który przez importy typów rozrasta się do dziesięciu węzłów, to nadal cykl dwóch plików) i napisz prostym językiem, dlaczego może utrudnić zmianę w repo legacy.

Format odpowiedzi:
- Nie generuj Graphviz/DOT na tym etapie.
- Zwróć wynik w Markdown.
- Zacznij od 3-5 najważniejszych obserwacji.
- Potem użyj tabeli z kolumnami:
  - Obszar
  - Co znalazłeś
  - Dowód z dependency-cruiser
  - Dlaczego to ważne przy zmianie
  - Związek z `artifact-1-territory.md`
  - Co sprawdzić dalej
```

## Granice warstw

```text
Sprawdź, czy frontend respektuje granice warstw: `platform/types` jako fundament, `platform/client` poniżej `channels/src`, oraz brak niedozwolonych importów między tymi obszarami. Importy samych typów i importy z katalogów builda (np. `dist`) wypisz osobno — nie traktuj ich jak złamania granic. Podobnie z importami wspólnego rejestru albo konfiguracji zapisanej jako kod (tabele routingu, listy feature flag): duża liczba takich importów wynika z projektu, a nie z łamania granic.

Zinterpretuj wyniki w kontekście aktywności z `context/map/artifact-1-territory.md`, szczególnie dla `admin_console`, `packages`, `client` i `types`. Chcę wiedzieć, czy często zmieniane miejsca korzystają z tych warstw w przewidywalny sposób, czy widać importy, które mogą zaskoczyć przy zmianie.

Format odpowiedzi:
- Nie generuj Graphviz/DOT na tym etapie.
- Zwróć wynik w Markdown.
- Zacznij od 3-5 najważniejszych obserwacji.
- Potem użyj tabeli z kolumnami:
  - Sprawdzana granica
  - Wynik
  - Dowód z dependency-cruiser
  - Dlaczego to ważne przy zmianie
  - Związek z `artifact-1-territory.md`
  - Co sprawdzić dalej
```

## Ryzyka testowalności

```text
Użyj dependency-cruiser dla `webapp` i przeanalizuj ryzyka testowalności w najaktywniejszych obszarach z `context/map/artifact-1-territory.md`: `admin_console`, `packages`, `utils`, `actions`, `platform/client`, `platform/types`.

Sprawdź, które miejsca mogą być trudne do testowania w izolacji, bo ciągną za sobą dużo importów, akcje, klienta API, globalny stan, wspólne utilsy albo typy z platformy. Zwróć konkretną listę ryzyk: gdzie prawdopodobnie trzeba będzie dużo mockować, gdzie lepszy będzie test integracyjny, a gdzie zmiana może naturalnie kończyć się testem e2e.

Format odpowiedzi:
- Zwróć Markdown, bez Graphviz/DOT.
- Użyj sekcji:
  - `Podsumowanie`
  - `Lista ryzyk testowych`
  - `Najbardziej podejrzane moduły`
  - `Co sprawdzić dalej`
  - `Opcjonalny kolejny krok: graf`
```

## Render wybranego podgrafu (dopiero po selekcji)

```text
Wybierz najważniejszy podgraf i wyrenderuj go do SVG przez Graphviz.

Nie renderuj całego `webapp`. Ogranicz zakres do wskazanych modułów, użyj `--focus`, `--include-only`, `--collapse` albo metryk fan-in/fan-out tak, aby graf odpowiadał na jedno pytanie z analizy.
```

---

```text
Zapisz podsumowanie tej sesji do `context/map/artifact-2-structure.md`
```