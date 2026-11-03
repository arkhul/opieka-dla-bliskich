# Mapa terytorium — gdzie projekt żyje (historia gita)

Seria promptów do Wide Scan opartego o historię gita. Uruchamiaj po kolei w jednej sesji, a wynik zapisz do `context/map/artifact-1-territory.md`.

## Aktywność — gdzie projekt był realnie dotykany

```text
Korzystając z historii gita, w zakresie ostatnich 12 miesięcy, pokaż TOP 10 najczęściej modyfikowanych:

a) folderów lub modułów
b) plików

Odfiltruj szum: lockfile'y, snapshoty, generowane pliki, dotenvy, configi, grafiki, etc. Pomiń też commity botów (np. automatyczne podbicia wersji) i masowe zmiany typu formatowanie czy przenosiny plików, ale nie odrzucaj commita tylko dlatego, że jest duży: duży feature zostaje. Commity, których autorem jest agent AI, licz jako aktywność i podaj ich udział osobno. Jeśli jakiś obszar zmienił w tym czasie nazwę albo lokalizację, połącz starą ścieżkę z nową.

Jeśli historia repo jest krótsza niż 12 miesięcy, powiedz to i weź całą.

Możesz zejść poziom niżej jeśli pierwsza seria wyników da ogólne rezultaty jak "src/frontend" i "src/backend" - chcemy poznać realne obszary aktywności hands-on. Przy każdym obszarze dopisz jednym zdaniem, za jaką funkcję produktu odpowiada (np. logowanie, płatności, wyszukiwanie).
```

```text
Podziel te same dane na kwartały (albo na miesiące, jeśli historia jest krótka) — chcę zobaczyć, jak zmieniał się nacisk pracy w projekcie. Oznacz każdy obszar jako stały, rosnący, wygasający albo sezonowy, a przy wyraźnym skoku nazwij kampanię, która za nim stoi, jeśli widać ją w opisach commitów.
```

## Poprawki — ważne czy ciągle się psuje

```text
Dla 5 najaktywniejszych obszarów policz, jaka część commitów to poprawki (fix, revert, hotfix), a reverty podaj osobno. Chcę odróżnić obszary ważne od tych, które ciągle się psują.

Zanim uznasz obszar za psujący się, przeczytaj tematy tych poprawek: w CI, konfiguracji deployu czy drobnych poprawkach UI naprawianie metodą prób i błędów to zwykły tryb pracy. Jeden duży revert przypisz do obszaru, którego dotyczył, a nie do wszystkich, które przy okazji ruszył.

Jeśli masz skonfigurowane GitHub CLI (gh), dołóż do tego PR-y zamknięte bez merge'a i otwarte zgłoszenia błędów w tych obszarach. Tylko odczyt: niczego nie zmieniaj na GitHubie.
```

## Współzmiany — co zmienia się razem

```text
Jakie pary lub trójki katalogów najczęściej pojawiają się w tych samych commitach? Wyszukaj sprzężenia i krótko podsumuj wnioski dla top 3 z naszego rankingu. Pomiń commity, które dotykają naraz dużej części repo — one wiążą wszystko ze wszystkim. Przy każdej parze podaj, w ilu commitach wystąpiła razem i jaki to procent commitów mniej aktywnego z dwóch obszarów.
```

```text
Jeszcze dwie rzeczy przy okazji tych współzmian:

- Czy jest jakiś pojedynczy plik, który zmienia się razem z wieloma różnymi
  obszarami naraz? Myślę o czymś wspólnym dla całego repo — plik z tłumaczeniami,
  config, coś generowanego. Ciekawi mnie, czy poza podziałem na foldery jest
  jakiś taki "wspólny mianownik". Jeśli tak, sprawdź, czy ktoś go edytuje
  ręcznie, czy zmienia się automatycznie (generator, build) — to dwa różne
  koszty zmiany.
- I sprawdź, czy pliki, które wyszły jako mocno sprzężone, na pewno nadal są
  w repo. To historia, więc coś mogło dużo się zmieniać, a potem zostać usunięte
  albo przeniesione — nie chcę później opierać analizy na pliku, którego już nie ma.
```

---

```text
Zapisz podsumowanie tej sesji do `context/map/artifact-1-territory.md`
```