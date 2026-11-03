# Wspólne konwencje inżynieryjne zespołu

Użyj tego dokumentu jako danych wejściowych źródłowych dla umiejętności `code-review`. Traktuj go jako
punkt wyjścia, a nie uniwersalną prawdę: przed wygenerowaniem umiejętności dostosuj
nazwy, reguły frameworka, politykę testowania i oczekiwania dotyczące
bezpieczeństwa do swojego zespołu.

## Nazewnictwo
- Zmienne i funkcje: opisowy camelCase (bez skrótów z wyjątkiem `url`, `id`, `api`, `config`)
- Wartości logiczne: prefiks `is`, `has`, `should`, `can`
- Funkcje: najpierw czasownik (`getUserById`, nie `user`)
- Pliki: zgodne z głównym eksportem (`UserService.ts` eksportuje `UserService`)
- Stałe: UPPER_SNAKE_CASE

## Obsługa błędów
- Wszystkie operacje asynchroniczne: try/catch lub `.catch()`
- Komunikaty błędów zawierają informację, która operacja się nie powiodła, oraz odpowiednie dane wejściowe
- Brak pustych bloków catch; co najmniej zaloguj lub ponownie rzuć błąd
- Błędy HTTP zawierają kod statusu i możliwy do wykonania komunikat
- Czyszczenie zasobów należy umieszczać w blokach `finally`, gdy zasoby są otwierane

## TypeScript
- Zero `any` bez jawnego komentarza uzasadniającego
- Dla kształtów obiektów preferuj `interface` zamiast `type`
- Dla danych zewnętrznych używaj `unknown`, zawężaj za pomocą strażników typów
- Modeluj stany za pomocą unii dyskryminowanych, a nie pól opcjonalnych
- Parametry generyczne: opisowe nazwy (`TUser`, nie `T`)

## Funkcje
- Pojedyncza odpowiedzialność; jeśli potrzebujesz „i”, aby ją opisać, podziel funkcję
- Maksymalnie 3 parametry; powyżej tego użyj obiektu opcji
- Wczesne zwroty zamiast zagnieżdżonych warunków
- Funkcje zapytań (`get*`, `find*`, `is*`) muszą być czyste

## Bezpieczeństwo
- Żadnych sekretów w kodzie; wyłącznie zmienne środowiskowe
- Waliduj dane wejściowe użytkownika na granicach systemu
- SQL: wyłącznie zapytania parametryzowane
- Odpowiedzi API nigdy nie ujawniają śladów stosu ani wewnętrznych ścieżek

## Testowanie
- Nazwy testów opisują zachowanie: „returns empty array when no results found”
- Każdy test posiada własną konfigurację i sprzątanie
- Konkretne asercje: `toEqual(expected)` zamiast `toBeTruthy()`
- Uwzględnij przypadki brzegowe: puste wartości, null, wartości graniczne i ścieżki błędów