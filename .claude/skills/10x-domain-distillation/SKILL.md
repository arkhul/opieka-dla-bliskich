---
name: 10x-domain-distillation
description: >
  Distil the business domain of an existing codebase into one map
  (context/domain/domain-distillation.md): the ubiquitous language with
  sources in the docs and in the code, subdomains classified as Core,
  Supporting or Generic, aggregate candidates and policies with their
  invariants and whether the code enforces them, the model-vs-code drift list,
  a ranking of what to fix first with a "done when" per item, owner-routed
  questions, and a compact glossary for agents (context/domain/glossary.md).
  Findings carry stable IDs and are diffed against the previous run.
  Tech-stack agnostic; works with or without requirement documents. Use when
  the user wants to discover or name the domain of a grown
  codebase, build a ubiquitous language or glossary from the repo, check
  whether the code matches the product documents, find the model-vs-code
  drift, classify subdomains, or asks for "domain distillation", "destylacja
  domeny", "słownik domeny", "DDD map of this repo".
argument-hint: "[--root <path>] [--docs <path>...] [--lang <code>] [--replace]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Write
  - Agent
  - Task
  - AskUserQuestion
---
# Destylacja domeny: domena, której kod nigdy nie nazwał

Przygotuj jeden raport, `context/domain/domain-distillation.md`, który odpowiada:
**z czego składa się domena tego produktu, jakie słowa ją nazywają, czy kod
używa tych samych słów i tych samych reguł oraz gdzie kod oddalił się od
biznesu?**

Produktem jest **mapa domeny, a nie kod ani plan refaktoryzacji**.
Nie zakładaj niczego z góry: żadnych nazw encji, żadnych agregatów, ścieżek
ani numerów wymagań. Odkryj je i wskaż źródło każdego z nich.

**Domena jest odkrywana, a nie dana.** Umiejętność nie przyjmuje docelowego terminu
ani obszaru. Destyluje cały produkt (lub poddrzewo `--root`) i kończy się
rankingiem; wybór tego, co zmienić dalej, pozostaje po stronie użytkownika.

## Wyniki

Wszystkie wyniki znajdują się w `<repo-root>/context/domain/`, również gdy `--root`
zawęża zakres kodu.

| Path | Co |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `context/domain/domain-distillation.md` | **Raport** — jedyny plik przeznaczony do czytania przez ludzi i późniejszą pracę |
| `context/domain/glossary.md` | Zwięzły glosariusz dla agentów i ludzi: termin, znaczenie, nazwa w kodzie, nie nazywaj tego |
| `context/domain/evidence/0-sources.md` | Zakres kodu, stos technologiczny i warstwy, wykluczenia — bez słownictwa domenowego |
| `context/domain/evidence/0-documents.md` | Dokumenty domenowe i cele produktu |
| `context/domain/evidence/1-docs-language.md` | Terminy, definicje, cykle życia, reguły i cele określone w dokumentach |
| `context/domain/evidence/2-code-language.md` | Nazwy domenowe w kodzie: typy, tabele, stany, operacje, zdarzenia |
| `context/domain/evidence/3-code-rules*.md` | Reguły biznesowe chronione przez kod: gdzie, na której warstwie, jak rygorystycznie |
| `context/archive/<stamp>-domain-distillation/` | Wcześniejszy raport, glosariusz i dowody, przenoszone tutaj przy zastąpieniu |

## 1. Kontrola wstępna

- Jeśli istnieje `context/domain/domain-distillation.md`: przy użyciu `--replace` lub gdy
  nie ma nikogo, kogo można zapytać (uruchomienie orkiestracyjne lub CI), przenieś go do
  `context/archive/<stamp>-domain-distillation/domain-distillation.md`, wraz z
  `glossary.md` i starym `evidence/` obok niego
  — `<stamp>` to czas modyfikacji raportu jako `YYYY-MM-DD-HHMM` — wskaż
  w polu `evidence:` zarchiwizowanego raportu jego nowe `evidence/` i
  kontynuuj; w przeciwnym razie zapytaj raz, czy go zastąpić. To jedyne
  pytanie.
- **Zakres.** Bez `--root` zakresem kodu jest całe repozytorium. W monorepo,
  którego dokumenty wymagań opisują jedną aplikację, ustaw zakres kodu na tę
  aplikację i wymień pozostałe pakiety jako wykluczone, podając dla każdego
  jednolinijkowy powód. Dokumenty są zawsze odkrywane z katalogu głównego
  repozytorium (oraz z `--docs`), niezależnie od zakresu kodu.
- Język raportu: `--lang`, w przeciwnym razie język żądania użytkownika, a jeśli
  nie można go ustalić — angielski. Terminy domenowe pozostają w języku użytym
  przez źródła; nigdy nie tłumacz terminu, który kod lub dokumenty zapisują w
  innym języku.
- `mkdir -p context/domain/evidence`. W repozytorium git wymień pliki przez
  `git ls-files --cached --others --exclude-standard`,
  aby ignorowane i generowane drzewa pozostały poza zakresem, a nieśledzone dokumenty zostały uwzględnione.
- Ścieżki w każdym pliku są względne względem repozytorium. Gdy zakres kodu jest głęboki,
  nagłówek raportu może zdefiniować jeden alias (`app/` = `apps/shop/src/`).
- Zapisz krótki HEAD i informację, czy drzewo robocze ma niezacommitowane zmiany.

## 2. Inwentaryzacja źródeł (główny agent)

Zbuduj wspólny stan faktyczny przed delegowaniem, zgodnie z
[references/source-inventory.md](references/source-inventory.md). Celowo zawiera on dwa
pliki:

- `evidence/0-sources.md` — zakres kodu, stos technologiczny, miejsca występowania każdej warstwy,
  wykluczenia. **Bez słownictwa domenowego**: agenci kodowi go czytają, a
  terminy z dokumentów, które do nich dotrą, zmieniłyby ich ustalenia w potwierdzenie
  tego, co im przekazano.
- `evidence/0-documents.md` — dokumenty domenowe według rodzaju, cele produktu
  i ich cytaty. Czytany wyłącznie przez agenta dokumentów i syntezę.

Czytaj nagłówki i krótkie fragmenty; pełne czytanie pozostaw pod-agentom.

## 3. Deleguj równolegle pod-agentów zbierających dowody

Uruchom ich w **jednej wiadomości**. Każdy prompt zawiera: ścieżkę bezwzględną tego
katalogu umiejętności (`<loaded-skill-dir>` w opisach), ścieżkę do jego opisu,
katalog główny repozytorium, zakres kodu, pliki inwentaryzacji, które może czytać, jego
ścieżkę wyjściową, język raportu oraz poniższe reguły. Powiedz każdemu pod-agentowi,
aby najpierw przeczytał swój opis.

| Pod-agent | Opis | Czyta | Pytanie |
| ------------- | ---------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| docs-language | [references/agent-docs-language.md](references/agent-docs-language.md) | oba pliki inwentaryzacji | Jakie słowa, cykle życia i reguły określa biznes? |
| code-language | [references/agent-code-language.md](references/agent-code-language.md) | tylko `0-sources.md` | Jakich słów używa kod i do czego? |
| code-rules | [references/agent-code-rules.md](references/agent-code-rules.md) | tylko `0-sources.md` | Których reguł kod faktycznie pilnuje i gdzie? |

**Duży zakres kodu.** Gdy zakres kodu zawiera ponad około 1 500 plików źródłowych,
podziel code-rules na jednego agenta dla każdej grupy warstw lub obszarów najwyższego poziomu
z `0-sources.md` (maksymalnie cztery), przy czym każdy zapisuje do
`evidence/3-code-rules-<group>.md`. Pokrycie jest ważniejsze niż głębokość: obszar, którego żaden agent
nie przeszukał, jest niewiadomą, nigdy „brakiem reguł”.

W Claude Code deleguj przez narzędzie `Agent` (`Task` w starszych wersjach),
`subagent_type: "general-purpose"` — potrzebują możliwości Write. W innych środowiskach użyj
natywnego odpowiednika. Bez obsługi pod-agentów wykonaj opisy kolejno
samodzielnie, najpierw agenci kodowi, przed przeczytaniem jakiegokolwiek dokumentu.

Podział jest celowy: agenci językowi nigdy nie widzą wzajemnie swoich wyników,
a agent reguł inwentaryzuje zabezpieczenia, nie otrzymując informacji, których reguł
ma szukać. Zgodność znaleziona później podczas syntezy jest więc rzeczywistą zgodnością.

Reguły do przekazania każdemu pod-agentowi:

1. Cytuj każdy termin, regułę i zabezpieczenie jako `path:line`, zweryfikowane w tej sesji.
   Nigdy nie wymyślaj terminu, definicji ani lokalizacji.
2. Cytuj własne sformułowania źródła dla definicji i reguł; parafrazuj tylko
   w wyraźnie oznaczonym wyjaśnieniu.
3. Oznacz ustalenia jako `evidence`, `inference` lub `unknown`. Wyszukiwanie, które niczego
   nie znalazło, zgłaszaj wraz z przeszukanym zakresem, nigdy jako „nie istnieje”.
4. Tylko do odczytu: bez zmian w kodzie, bez budowania, bez instalacji.
5. Zwróć głównemu agentowi najwyżej 15 wierszy: najistotniejsze ustalenia, luki
   i pokrycie.

Poczekaj na wszystkich. Nieudanego lub częściowego pod-agenta należy wskazać jako lukę w
raporcie; ponów próbę tylko raz i wyłącznie wtedy, gdy awaria była mechaniczna.

## 4. Zsyntetyzuj raport

Połącz pliki dowodowe i zapisz `context/domain/domain-distillation.md`
zgodnie z [references/report.md](references/report.md): wszechobecny język
z lokalizacją w kodzie albo wyraźnym **missing in code** dla każdego terminu Core
i Supporting, granice kontekstów, poddomeny, kandydatów na agregaty oraz polityki ze statusem każdego niezmiennika (**enforced**,
**declared**, **ignored**, **contradicted**; **undocumented** dla
ekspozycji, których nie obejmuje żaden dokument), listę rozbieżności między modelem a kodem,
oraz ranking — następnie nadaj mu charakter operacyjny zgodnie z opisem w `report.md`: stabilne
identyfikatory, stronę naprawy dla każdego wiersza rozbieżności, *done when* dla każdej pozycji rankingu,
pytania z właścicielem, zmiany od poprzedniego uruchomienia oraz
`context/domain/glossary.md`.

Przed nazwaniem udokumentowanej reguły *ignored* lub terminu *missing in code* wykonaj
samodzielnie ukierunkowane wyszukiwanie (`rg` względem terminu, jego wariantów i synonimów w
warstwie, w której powinien występować). Grupuj je według warstwy i cytuj zakres każdej grupy tylko raz.

## 5. Zweryfikuj, a następnie przedstaw

Wykonaj przebieg weryfikacyjny opisany w
[references/report.md](references/report.md#verification). Następnie przedstaw w
5–8 zdaniach: ścieżkę raportu, liczbę terminów Core i Supporting oraz
liczbę brakujących w kodzie, poddomenę(-y) Core, najsilniejszą rozbieżność,
kandydata #1 i uzasadnienie, liczbę rozbieżności według strony naprawy (kod /
dokumentacja /
decyzja), otwarte pytania oraz główne ograniczenie. Wskaż glosariusz
jako plik, do którego należy odwoływać się w instrukcjach dla agentów. Zakończ na tym; destylacja
nie projektuje ani nie rozpoczyna refaktoryzacji.