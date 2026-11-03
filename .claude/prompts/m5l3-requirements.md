## Ogólna koncepcja

- uruchomienie workflow GHA dla każdego nowego pull requesta do master
- composite action dla samego review, aby główny workflow był łatwy do zrozumienia

## Parametry wejściowe

- tytuł pull requesta
- opis pull requesta (?? kompromis kosztowy)
- git diff

## Kryteria Code Review

Każde kryterium jest oceniane w skali 1–10, gdzie 1 oznacza najgorszy wynik, a 10 najlepszy.

1) **poprawność implementacji** — czy kod faktycznie robi to, co deklaruje, obsługując przypadki brzegowe i ścieżki błędów bez wprowadzania regresji?
   - _1_: logika jest uszkodzona, pomija oczywiste przypadki brzegowe/błędy lub po cichu powoduje regresję istniejącego zachowania.
   - _10_: działa poprawnie dla ścieżki szczęśliwej, przypadków brzegowych i trybów awarii, bez regresji.

2) **idiomatyczność** — czy kod przestrzega konwencji języka, frameworka i projektu, których oczekiwałby biegły czytelnik?
   - _1_: walczy z idiomami stosu technologicznego i ustalonymi wzorcami repozytorium, brzmi obco.
   - _10_: nieodróżnialny od dobrze napisanego kodu otaczającego, naturalnie wykorzystuje właściwe idiomy.

3) **złożoność** — czy rozwiązanie jest tak proste, jak pozwala problem, bez zbędnej abstrakcji lub komplikacji?
   - _1_: przeinżynierowane lub zagmatwane — trudne do zrozumienia, z przypadkową złożonością zaciemniającą intencję.
   - _10_: minimalne i jasne, najprostszy projekt, który całkowicie rozwiązuje problem.

4) **pokrycie testami / ryzyka** — czy istotne zachowania i ryzykowne ścieżki są sprawdzane testami proporcjonalnie do ich ryzyka?
   - _1_: ryzykowna logika trafia do wydania bez testów; testy są nieobecne, trywialne lub nie sprawdzają nic użytecznego.
   - _10_: pokrycie ważone ryzykiem — części najbardziej podatne na awarie są testowane celowo i dobrze.

5) **dokumentacja** — czy nieoczywiste decyzje, publiczne interfejsy i trudny kod są wyjaśnione tam, gdzie czytelnik tego potrzebuje?
   - _1_: nieprzejrzyste — brak komentarzy lub dokumentacji tam, gdzie są potrzebne, intencję trzeba odtwarzać metodą inżynierii wstecznej.
   - _10_: wystarczająco dużo dokumentacji/komentarzy, aby wyjaśnić „dlaczego”, bez powtarzania oczywistości.

6) **bezpieczeństwo i ochrona** — czy zmiana unika wprowadzania podatności, ujawniania sekretów lub niebezpiecznej obsługi niezaufanych danych wejściowych?
   - _1_: wprowadza podatność możliwą do wykorzystania, ujawnia sekrety lub niebezpiecznie ufa niezaufanym danym wejściowym.
   - _10_: dane wejściowe są walidowane, sekrety są obsługiwane poprawnie i nie zostaje otwarta żadna nowa powierzchnia ataku.

## Werdykt

- wiążący `verdict`: `pass` | `fail`, obok sześciu ocen oraz Markdown `summary` (kontrakt: `m5l2-review-schema.ts.template`)
- bramka merge odczytuje wyłącznie `verdict`

## Odłożone na później

- zgodność biznesowa (wymaga szerszego kontekstu)
- dopasowanie architektoniczne (wymaga szerszego kontekstu)

## Oczekiwane skutki uboczne

- komentarz PR z podsumowaniem
- etykiety: `ai-cr:failed` (czerwona) LUB `ai-cr:passed` (zielona)

## Oczekiwane zachowanie

- ponowna próba na żądanie po dodaniu etykiety `ai-cr:review`