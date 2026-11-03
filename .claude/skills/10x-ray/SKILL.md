---
name: 10x-ray
description: >
  Learn how a skill works by watching it run. Maps the target skill's anatomy
  (steps, loops, fan-outs, human gates, branches, and why each exists), runs
  the skill in a background subagent, and reveals the map concept by concept
  as the run reaches each step, ending with a full "skill anatomy". The
  skill's own questions are handed to the user exactly as the skill would ask
  them. Use when the user invokes /10x-ray <skill> [args], or asks to
  "x-ray", "watch", "trace", "visualize" or "understand" a skill by running
  it. `--mode html` shows the same view on a live page in the browser instead
  of the terminal.
argument-hint: "[--mode terminal|html] <skill-name> [args for that skill]"
allowed-tools:
  - Bash
  - Read
  - Write
  - Agent
  - Monitor
  - SendMessage
  - TaskStop
  - AskUserQuestion
---
# 10x-ray

Jesteś obserwatorem i interpretatorem. Czytasz docelową umiejętność i mapujesz
jej anatomię, subagent działający w tle (worker) uruchamia ją i oznacza każde
zdarzenie krokiem mapy, w którym się znajduje, a Monitor przekształca to w ramki
na poziomie koncepcji: „umiejętność rozdziela teraz pracę na subagentów i oto
dlaczego”. Użytkownik powinien odejść ze zrozumieniem projektu umiejętności, a
nie tylko po obserwowaniu przewijających się wywołań narzędzi. Pośredniczysz też
we wszystkich pytaniach, które umiejętność kieruje do człowieka.

Skrypt: `XRAY=<this skill's base directory>/scripts/xray.mjs`. Harness
wypisuje katalog bazowy podczas ładowania umiejętności ("Base directory for this
skill: …"); umiejętność może znajdować się w `.claude/skills/` projektu albo w
`~/.claude/skills/`, więc nigdy nie wyprowadzaj go z bieżącego repozytorium.
Wszędzie używaj ścieżki bezwzględnej; worker również jej potrzebuje. Wymaga
Node 18+.

## 1. Przeanalizuj wywołanie

- Początkowe `--mode <terminal|html>` (lub `--mode=<…>`) wybiera miejsce
  wyświetlania widoku; domyślnie `terminal`. Uwzględnia się wyłącznie flagę trybu
  *przed* nazwą umiejętności; wszystko po nazwie umiejętności należy do
  umiejętności.
- Następny token = nazwa docelowej umiejętności (usuń początkowe `/`). Wszystko
  po nim = `ARGS` dla tej umiejętności, przekazywane dosłownie.
- Nie podano umiejętności: wyświetl kilka umiejętności z listy dostępnych
  umiejętności i zapytaj, którą uruchomić. Na tym zakończ.
- Cel musi znajdować się na liście dostępnych umiejętności. Jeśli go tam nie ma,
  powiedz o tym i zasugeruj najbliższe nazwy. Odmów użycia samego `10x-ray` jako
  celu.
- `LANG` = język, w którym użytkownik pisze do ciebie w tej rozmowie: `pl`
  dla polskiego, `en` dla każdego innego. Ustawia każdy widoczny dla użytkownika
  napis, język mapy, którą piszesz, oraz narrację workera.

## 2. Zmapuj umiejętność

Przeczytaj `references/mapping-guide.md` (schemat, wzorce, jak pisać koncepcje)
oraz, pierwszy raz w sesji, `references/example-map-10x-research.json`.
Następnie przeczytaj SKILL.md celu (`.claude/skills/<skill>/` lub
`~/.claude/skills/<skill>/`) oraz pliki, których nakazuje przestrzegać jako
część swojego przepływu pracy. Zapisz mapę do pliku tymczasowego i zarejestruj ją:

```bash
LOG=$(node "$XRAY" init <skill> "<ARGS>" --lang <LANG>)
node "$XRAY" map "$LOG" <map.json>      # validates; fix and rerun on error
node "$XRAY" emit "$LOG" start - "Worker launched: /<skill> <ARGS>"
```

Zachowaj mapę dla siebie. Nie wypisuj jej ani nie opisuj kroków umiejętności na
czacie: użytkownik odkrywa je po kolei, gdy uruchomienie do nich dociera.

## 3. Uruchom widoki

**tylko tryb html:** uruchom serwer strony przez Bash z
`run_in_background: true`: `node "<XRAY>" serve "<LOG>"`. Odczytaj jego wynik,
aby znaleźć wiersz `x-ray page: http://127.0.0.1:<port>/` (pojawia się w ciągu
sekundy), a następnie `open <url>`. Strona (`assets/xray.html`) pokazuje jedną
kartę na każdy ujawniony krok, z jego koncepcją, bieżącym wierszem „teraz”,
notatkami i zwiniętym śladem agenta; ścieżki rozgałęzienia fan-out są w nim
zagnieżdżone. Gdy uruchomienie się kończy, serwer zapisuje samodzielny zrzut obok
logu (`<LOG>.html`).

Uruchom Monitor:

- `command`: `node "<XRAY>" watch "<LOG>"` w trybie terminala,
  `node "<XRAY>" watch "<LOG>" --quiet` w trybie html (ścieżki bezwzględne,
  już rozwinięte). Cichy watch wybudza cię tylko dla pytań i zakończenia
  uruchomienia. Dodaj `--verbose` tylko wtedy, gdy użytkownik chce zobaczyć
  każdą akcję agenta.
- `description`: `x-ray of /<skill>`
- `timeout_ms`: `1800000`

`watch` pamięta, co już wyrenderował, więc ponowne uzbrojenie nigdy nie powtarza
ramki.

## 4. Uruchom workera

Przeczytaj `references/worker-brief.md`, weź wszystko poniżej jego wiersza `---`
i wypełnij `{{SKILL}}`, `{{ARGS}}`, `{{LANG}}`, `{{XRAY}}`, `{{LOG}}` oraz `{{NODES}}`.
Dla `{{NODES}}` użyj jednego wiersza na węzeł mapy, `<id>  <pattern>  <title>`,
z dziećmi wciętymi o dwie spacje pod ich rodzicem. Uruchom go za pomocą narzędzia
Agent: `subagent_type: "general-purpose"`, opis `x-ray: /<skill>`. Działa w
tle. Zanotuj jego ID agenta dla SendMessage.

Powiedz użytkownikowi w jednym wierszu, że x-ray działa (w trybie html: wraz z
adresem URL strony), a następnie zakończ swoją turę.

## 5. Pętla przekazywania

**tryb terminala**, przy każdym powiadomieniu Monitora:

- Pierwszy wiersz to wiersz statusu `x-ray tick …`, który host już pokazuje w
  swoim wierszu powiadomienia. Odrzuć go i wypisz resztę dosłownie wewnątrz
  ogrodzenia ```` ```text ````. Powiadomienia przychodzą ze znakami ucieczki
  HTML: zamień `&amp;` `&lt;` `&gt;` z powrotem na `&` `<` `>`. Nie zmieniaj
  niczego więcej. Ramki zawierają objaśnienia (koncepcja dla kroku, notatki
  dotyczące wyników), więc dodaj co najwyżej jeden krótki wiersz pod
  ogrodzeniem, tylko gdy ramka potrzebuje kontekstu, na który użytkownik może
  zareagować (np. `WARNING`). Nie przewiduj nadchodzących kroków.
- Monitor wygasł i nie ma jeszcze ramki anatomii: ponownie uzbrój to samo
  polecenie.

**tryb html:** nie wypisuj ramek. Ciche ticki przychodzą tylko dla pytań
(obsłuż je jak poniżej) oraz zakończenia uruchomienia (wypisz ramkę anatomii w
ogrodzeniu, a następnie wynik).

### Przekazanie kontroli użytkownikowi

Gdy umiejętność o coś pyta, użytkownik otrzymuje dokładnie tę samą interakcję,
którą by wyświetliła. Działaj na podstawie **zdarzenia Monitora**, a nie
zakończenia workera. Gdy wiersz ticka kończy się `· ask=<payload file>`:

1. Przekaż ramki jak zwykle (tryb terminala).
2. Wykonaj `cat` na pliku payload i naśladuj childa dokładnie:
   - `"mode":"choice"`: wywołaj AskUserQuestion z tablicą `questions` payloadu
     bez zmian: to samo brzmienie, nagłówki, opcje, opisy, `multiSelect`. Nie
     parafrazuj, nie łącz ani nie przycinaj niczego.
   - `"mode":"text"`: wypisz `prompt` payloadu dosłownie jako swoją wiadomość,
     poza ogrodzeniem, i zakończ swoją turę. Następna wiadomość użytkownika
     jest odpowiedzią.
3. Zapisz odpowiedź w śladzie:
   `node "$XRAY" answer "$LOG" "<short form, e.g. Depth: Quick overview · Focus: Identity & sessions>"`.
4. Wyślij ją do workera przez SendMessage (jego ID agenta): dla wyborów
   `User answer:`, a następnie jeden wiersz na pytanie, `<header>: <chosen labels>`,
   plus dowolny wolny tekst wpisany w Other lub w notatkach; dla trybu tekstowego
   odpowiedź dosłownie. Jeśli zakończenie `NEEDS_INPUT` workera jeszcze nie
   nadeszło, najpierw na nie zaczekaj, aby wiadomość wznowiła workera zamiast
   trafić w środek tury.
5. Ponownie uzbrój Monitor, jeśli w międzyczasie się zatrzymał.

Jeśli AskUserQuestion zostanie odrzucone lub użytkownik odpowie poza opcjami,
przekaż jego słowa jako odpowiedź. Nie pytaj ponownie. Nie wypisuj wiadomości
zakończenia `NEEDS_INPUT` workera; nie dodaje niczego poza payloadem.

### Koniec uruchomienia

Przy końcowym powiadomieniu o zakończeniu workera (nie `NEEDS_INPUT`):

- Jeśli log nie ma zdarzenia `done`/`fail` (worker uległ awarii lub zapomniał),
  wyemituj je, aby anatomia się wyrenderowała:
  `node "$XRAY" emit "$LOG" fail - "Worker ended without a final event" "<one-line reason>"`
  (`done` zamiast tego, jeśli worker wyraźnie zakończył się sukcesem).
- Przekaż ramkę anatomii z Monitora. Wymienia ona każdy zmapowany krok,
  odwiedzony lub nie, więc to moment, w którym widoczny jest cały projekt.
- tryb html: zatrzymaj serwer strony przez TaskStop, gdy jego wynik pokaże
  wiersz `x-ray snapshot:`, i podaj użytkownikowi ścieżkę zrzutu.
- Przekaż rzeczywisty wynik umiejętności z końcowej wiadomości workera: pliki
  utworzone wraz ze ścieżkami, kluczowe ustalenia lub decyzje, otwarte dalsze
  kroki. Następnie w 2–4 zdaniach podaj wniosek o projekcie umiejętności: jeden
  lub dwa pomysły, które sprawiają, że działa (np. „tanie pytanie o zakres przed
  kosztownym fan-out”). To jest sedno x-raya.

## 6. Wczesne zatrzymanie

Jeśli użytkownik prosi o zatrzymanie, zatrzymaj workera przez TaskStop, a
następnie wyemituj `fail` z tytułem `Stopped by user` (oznaczony bieżącym
krokiem). Monitor sam renderuje anatomię i kończy działanie (najpierw uzbrój go
ponownie, jeśli wygasł). Przekaż ją i zgłoś, co worker zdążył już zmienić na
dysku.