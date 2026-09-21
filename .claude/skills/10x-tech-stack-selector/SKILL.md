---
name: 10x-tech-stack-selector
description: >
  Pick a starter and a stack for a greenfield project after the PRD is written.
  Reads context/foundation/prd.md, reasons over a language-aware starter
  registry with four agent-friendly quality gates, and writes the
  context/foundation/tech-stack.md hand-off. Use when the user asks "what
  stack should I use", "pick a stack", "choose framework",
  "co wybrać do projektu". Use AFTER /10x-prd, BEFORE /10x-bootstrapper.
argument-hint: "[path-to-prd]"
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - TaskCreate
  - TaskUpdate
---
# Selektor stosu technologicznego: od PRD do startera

Ta umiejętność jest trzecim ogniwem w łańcuchu bootstrapowania (`/10x-shape → /10x-prd → 10x-tech-stack-selector → /10x-bootstrapper`). Jej jedyne zadanie: przekształcić napisany PRD w rekomendowany starter oraz małe przekazanie maszynowo odczytywalne dla `/10x-bootstrapper`, który może je odczytać, aby utworzyć szkielet projektu.

Umiejętność jest **facylitatorem decyzji działającym na wyselekcjonowanym rejestrze**, a nie silnikiem rekomendacji opartym na pierwszych zasadach. Odczytuje priory PRD, zadaje maksymalnie ~6 pozostałych pytań na ścieżce niestandardowej (albo skraca proces do zweryfikowanej rekomendacji na ścieżce standardowej), analizuje świadome językowo karty starterów w `references/starter-registry.yaml` i stosuje cztery bramki jakości będące twardymi filtrami. Pełne uzasadnienie pozostaje w rozmowie; przekazanie w pliku jest minimalne.

Rejestr starterów w `references/starter-registry.yaml` jest **jedynym źródłem prawdy** o dostępnych starterach. Odczytuje go `/10x-bootstrapper`; walidator CI (`scripts/validate-starter-registry-sync.mjs`) zapobiega odwołaniu bootstrappera do `starter_id`, który tutaj nie istnieje.

## Kiedy używać, kiedy pomijać

**Używaj, gdy**: istnieje `context/foundation/prd.md`, a użytkownik jest gotowy wybrać stos. Frazy wyzwalające: „what stack should I use”, „pick a starter”, „choose a framework”, „co wybrać”, „what should I build this in”, „can you recommend a stack”. Używaj także, gdy użytkownik prosi o porównanie („React vs Vue vs Svelte”) z PRD na dysku — umiejętność wymusza ścieżkę niestandardową i przechodzi przez warianty frameworków.

**Pomiń, gdy**: nie ma `context/foundation/prd.md` — umiejętność odmawia i przekierowuje do `/10x-shape` + `/10x-prd`. Pomiń także, gdy użytkownik jest w trakcie implementacji w istniejącej bazie kodu i pyta o dodanie biblioteki lub zastąpienie pojedynczej zależności — to obszar `/10x-frame`, a nie wybór stosu.

## Relacja z innymi umiejętnościami

- `/10x-shape` — tworzy `shape-notes.md`, poprzednik PRD. Dwa kroki przed tą umiejętnością.
- `/10x-prd` — tworzy `context/foundation/prd.md`, kanoniczne dane wejściowe. Zawsze poprzedza tę umiejętność.
- `/10x-bootstrapper` — konsument downstream. Odczytuje frontmatter `context/foundation/tech-stack.md` oraz rejestr; tworzy szkielet projektu.

## Wymagane dane wejściowe

1. Plik PRD — istnieje, jest możliwy do odczytu, jest zgodny ze schematem PRD (`/skills/10x-shape/references/prd-schema.md`). Domyślna lokalizacja: `context/foundation/prd.md`. Użytkownik MOŻE przekazać inną ścieżkę jako argument (zobacz „Początkowa odpowiedź” poniżej). Umiejętność odczytuje **frontmatter** jako priory (`product_type`, `target_scale`, `timeline_budget`, `project`) i może odczytywać sekcje treści (`## Functional Requirements`, `## Non-Goals`) do audytu funkcji oraz wykrywania momentów sokratejskich, w których FR-y PRD ujawniają funkcję nieobecną w rekomendowanym starterze.
2. `references/starter-registry.yaml` — dołączony do umiejętności. Ładowany w momencie podejmowania decyzji.
3. `references/residual-interview.md` — dołączony. Ładowany w czasie wywiadu.
4. `references/handoff-schema.md` — dołączony. Ładowany w czasie zapisu.
5. `references/agent-friendly-criteria.md` — dołączony. Ładowany w czasie filtrowania.
6. `references/decision-flow.md` — dołączony. Ładowany w momencie podejmowania decyzji.

## Początkowa odpowiedź

Gdy ta umiejętność zostanie wywołana:

1. **Jeśli podano argument ścieżki** (np. `/10x-tech-stack-selector @context/foundation/prd-v2.md` lub `/10x-tech-stack-selector path/to/prd.md`), usuń początkowy `@`, jeśli występuje, i użyj ścieżki dosłownie jako lokalizacji PRD dla tego uruchomienia.
2. **Jeśli nie podano argumentu**, ustaw domyślną ścieżkę PRD na `context/foundation/prd.md`.

Przenieś rozwiązaną ścieżkę przez krok 0; reszta przepływu pracy działa na niej jako `<prd-path>`.

## Przepływ pracy

### Krok 0 — warunek wstępny PRD

Sprawdź warunek wstępny PRD względem rozwiązanej ścieżki:

```bash
test -f "<prd-path>"
```

Jeśli plik jest **nieobecny**, wykonaj dokładnie to i ZATRZYMAJ SIĘ — bez wywiadu awaryjnego, bez wbudowanego mini-PRD, bez odczytywania historii rozmowy w poszukiwaniu zastępczych priorów:

```bash
echo -n "/10x-shape" | pbcopy 2>/dev/null || echo -n "/10x-shape" | clip.exe 2>/dev/null || echo -n "/10x-shape" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-shape"
```

Wypisz dosłownie (podstaw rozwiązaną ścieżkę; jeśli użyto wartości domyślnej, jest to `context/foundation/prd.md`):

```
Tech-stack-selector requires a PRD at `<prd-path>`. Run `/10x-shape` first, then re-invoke.
```

Następnie ZATRZYMAJ SIĘ. Kontekst rozmowy **nie** jest rozwiązaniem awaryjnym — nawet jeśli treść PRD była omawiana wcześniej na czacie, umiejętność wymaga pliku na dysku.

Jeśli plik jest **obecny**, odczytaj go W CAŁOŚCI (bez `limit`/`offset`) i przejdź do kroku 1.

### Krok 1 — załaduj priory PRD

Przeanalizuj frontmatter PRD. Wyodrębnij:

- `project` → zasila `project_name` w przekazaniu (przekształć na kebab-case na potrzeby przekazania, jeśli nie jest już w kebab-case).
- `product_type` → steruje wyszukiwaniem rozwidlenia ścieżki Q0.
- `target_scale.users` → waga priorów (small/medium/large/enterprise).
- `timeline_budget.mvp_weeks` → waga priorów (krótkie harmonogramy preferują sprawdzone w boju + popularne startery).

Odczytaj treść PRD dla kontekstu audytu funkcji: przeskanuj `## Functional Requirements` pod kątem funkcji wymuszających technologie (auth, payments, realtime, AI/LLM, background jobs, file storage, i18n). Pokaż je później jako listę kontrolną w Q1.

Powtórz użytkownikowi priory:

```
PRD priors:
  Project:       <project>
  Product type:  <product_type>
  Scale:         <target_scale.users>
  Timeline:      <timeline_budget.mvp_weeks> weeks
                 (after-hours: <timeline_budget.after_hours_only>)

  Detected feature signals from FRs:
    - <feature> (FR-NNN)
    - ...
```

Zadaj jedno pytanie potwierdzające:

AskUserQuestion:
- question: "Czy te priory są poprawne, czy chcesz coś skorygować, zanim przejdziemy dalej?"
  header: "Priory"
  options:
  - label: "Poprawne — przejdź dalej (Recommended)"
    description: "Kontynuuj z tymi priorami."
  - label: "Skoryguj wartość"
    description: "Zapytam, które pole skorygować, a następnie zastosuję nadpisanie w pamięci (PRD na dysku pozostanie bez zmian)."
  - label: "Zatrzymaj — najpierw popraw PRD"
    description: "Zakończ. Uruchom ponownie /10x-prd, aby poprawić priory, a następnie ponownie wywołaj /10x-tech-stack-selector."
  multiSelect: false

Jeśli „Skoryguj wartość”: zapytaj, które pole, zapisz nadpisanie i kontynuuj z nadpisaniem zastosowanym tylko dla tej sesji.

### Krok 2 — rozwidlenie ścieżki Q0 + wywiad rezydualny

Załaduj `references/residual-interview.md` i postępuj zgodnie z opisanym tam przepływem Q.

Wywiad ma dwie ścieżki:

- **Ścieżka standardowa** (domyślnie rekomendowana w Q0): użytkownik akceptuje zweryfikowaną rekomendację dla swojej komórki `(product_type, language_family)`. Q1–Q3 i Q6 są pomijane. Nadal wykonywane są Q4 (wdrożenie), Q5 (CI/CD) oraz potwierdzenie nazwy projektu; autokontrola Q8 jest pomijana (rekomendowana ścieżka sama w sobie jest bezpieczniejszym wyborem).
- **Ścieżka niestandardowa** (użytkownik wybiera zaprojektowanie własnego rozwiązania): pełne przejście Q1–Q6 oraz warunkowe Q7 (runner testów) i autokontrola Q8 przed przekazaniem.

Q0 wyprowadza `language_family` z jawnej treści PRD, jeśli jest obecna, w przeciwnym razie pyta raz w Q0 (frontmatter PRD nie zawiera `tech_preferences`). Mapa recommended-defaults na początku `references/starter-registry.yaml` rozwiązuje `(product_type, language_family) → starter_id`. Jeśli komórka ma zweryfikowaną wartość domyślną, przedstaw ją po nazwie z jednolinijkowym dopasowaniem i wartością `bootstrapper_confidence` startera. Jeśli komórka nie ma wartości domyślnej (mapa pokazuje `<none>`), wymuś ścieżkę niestandardową z jednoliniową informacją („No vetted recommended default exists for `<product_type, language_family>`; we'll walk the full residual interview.”).

Domyślna opcja Q0 jest **redakcyjna, a nie cicha**: nazwij rekomendowany starter z góry i poproś o wyraźne potwierdzenie. Użytkownik musi świadomie zaakceptować lub przejść do innej ścieżki — nigdy nie akceptuj domyślnie bez pytania.

### Krok 3 — podejmij decyzję

Załaduj `references/decision-flow.md` i `references/agent-friendly-criteria.md`. Załaduj `references/starter-registry.yaml` i odczytaj wyłącznie karty istotne dla ograniczonego zbioru kandydatów (filtrowane według `language_family` i `product_type` zgodnie z krokiem A przepływu decyzji) — nie wszystkie 25 wpisów, aby ograniczyć koszt promptu.

Wykonaj przepływ decyzji:

- **Ścieżka standardowa** — wybór recommended_defaults jest już liderem; przejdź do kroku E (pokaż `bootstrapper_confidence`) i pomiń filtrowanie/ocenianie.
- **Ścieżka niestandardowa** — wykonaj krok A (filtruj według language_family + product_type + funkcji must-have + zgodności wdrożenia), krok B (odrzuć wpisy niespełniające jakiegokolwiek kryterium `agent_friendly.*`, z zastrzeżeniem dotyczącym danej rodziny języków), krok C (przeanalizuj pozostałe karty, ważąc team_profile + tech_preferences + timeline_budget), krok D (lider + 1–2 alternatywy z `alternatives_to_consider`), krok E (pokaż bootstrapper_confidence).

Przedstaw wyzwania sokratejskie tam, gdzie mówi o tym przepływ decyzji: wariant frameworka Q6 na ścieżce niestandardowej, `tech_preferences` wskazuje starter, który nie przechodzi ≥1 bramki jakości, starter z rekomendowanej wartości domyślnej nie zawiera funkcji nazwanej przez użytkownika w FR-ach PRD, lub wybrany starter ma `bootstrapper_confidence: best-effort` ORAZ użytkownik działa solo (dodatkowe uprzedzenie).

Kształt wyjścia rozmowy:

```
Recommendation: <starter_id> — <name>
Confidence:     <verified | first-class | best-effort>

<one-paragraph rationale tying the PRD priors and the user's answers to the lead card>

Alternatives worth a glance:
  - <starter_id_a> — <one-line tradeoff>
  - <starter_id_b> — <one-line tradeoff>

<if a flag was raised during the interview (preference vs quality, missing
 feature, scaffolding-friction warning): a one-line summary of what surfaced,
 how the user resolved it, and whether they're proceeding with a known-friction
 stack>
```

### Krok 4 — zapisz przekazanie

Załaduj `references/handoff-schema.md`. Najpierw zbuduj zawartość przekazania w pamięci.

Rozwiąż `package_manager` z `toolchain.package_manager` wybranej karty. Pole jest otwartym stringiem (cokolwiek określa karta — `npm`, `uv`, `poetry`, `bundle`, `gradle`, `cargo`, `go-modules`, `composer`, `dotnet` itd.); dla ekosystemów bez zewnętrznego wyboru (np. Go) karta może pominąć to pole, w takim przypadku pomiń je również w frontmatter przekazania.

Rozwiąż `hints.deployment_target` z Q4. Jeśli użytkownik wybrał „I don't know yet — pick the recommended default for me”, zapisz pierwszą wartość `deployment_default` karty (NIE dosłowny string `unspecified`).

Uzupełnij `hints.path_taken`: `standard` lub `custom`. Uzupełnij `hints.self_check_answers` 5 wartościami logicznymi z Q8, jeśli wykonano ścieżkę niestandardową; ustaw `null`, jeśli wybrano ścieżkę standardową.

Sprawdź kolizję:

```bash
test -f context/foundation/tech-stack.md
```

Jeśli plik nie istnieje, zapisz `context/foundation/tech-stack.md` z poprawną zawartością.

Jeśli plik istnieje, zapytaj:

AskUserQuestion:
- question: "context/foundation/tech-stack.md już istnieje. Jak chcesz postąpić?"
  header: "Kolizja"
  options:
  - label: "Nadpisz (Recommended)"
    description: "Zastąp istniejący tech-stack.md nowym wyborem. Poprzednia wersja zostanie utracona, chyba że została zatwierdzona w commit."
  - label: "Zapisz jako tech-stack-v2.md"
    description: "Zachowaj historię. Nowy wybór trafi do następnego dostępnego miejsca tech-stack-vN.md."
  - label: "Przerwij"
    description: "Zakończ bez zapisywania. Uzasadnienie rozmowy zostanie zachowane wyłącznie na czacie."
  multiSelect: false

Rekomendowaną opcją domyślną jest tutaj „Nadpisz”, ponieważ tech-stack-selector to jednorazowa decyzja na projekt; wiele wersji zwykle oznacza, że użytkownik ponownie rozważa wybór, w którym to przypadku utrata poprzedniego wyboru jest zamierzona. Zapis wersjonowany jest furtką awaryjną.

Po zapisaniu skopiuj polecenie następnego kroku i ogłoś:

```bash
echo -n "/10x-bootstrapper" | pbcopy 2>/dev/null || echo -n "/10x-bootstrapper" | clip.exe 2>/dev/null || echo -n "/10x-bootstrapper" | xclip -selection clipboard 2>/dev/null || true
```

```powershell
# PowerShell (Windows)
Set-Clipboard "/10x-bootstrapper"
```

Wypisz:

```
═══════════════════════════════════════════════════════════
  TECH STACK SELECTED
═══════════════════════════════════════════════════════════

  Starter:        <starter_id>
  Path taken:     <standard | custom>
  Confidence:     <verified | first-class | best-effort>

  ► Hand-off:  context/foundation/tech-stack.md
  ► Next:      /10x-bootstrapper  (✓ copied to clipboard)
═══════════════════════════════════════════════════════════
```

ZATRZYMAJ SIĘ. Nie przechodź automatycznie do `/10x-bootstrapper` — użytkownik uruchamia go, gdy jest gotowy.

## Wyjście

Zapisywany jest pojedynczy plik: `context/foundation/tech-stack.md` (lub `tech-stack-vN.md`, jeśli wybrano zapis wersjonowany).

Frontmatter zgodny ze schematem w `references/handoff-schema.md`:

```yaml
---
starter_id: <key from registry>
package_manager: <card-prescribed string; may be omitted for some ecosystems>
project_name: <kebab-case>
hints:
  language_family: js | python | ruby | java | go | rust | php | dotnet | dart | multi
  team_size: solo | small | mixed
  deployment_target: <starter-prescribed string>
  ci_provider: github-actions | gitlab-ci | circleci | cloudflare-builds
  ci_default_flow: auto-deploy-on-merge | manual-promotion
  bootstrapper_confidence: verified | first-class | best-effort
  path_taken: standard | custom
  quality_override: <bool>
  self_check_answers: <object | null>
  has_auth: <bool>
  has_payments: <bool>
  has_realtime: <bool>
  has_ai: <bool>
  has_background_jobs: <bool>
---

## Why this stack

<one paragraph, ≤ 200 words>
```

## Referencje

- `references/starter-registry.yaml` — kanoniczne karty starterów + mapa `recommended_defaults`.
- `references/residual-interview.md` — rozwidlenie ścieżki Q0 + przejście Q1–Q8.
- `references/handoff-schema.md` — kontrakt frontmatter `tech-stack.md`.
- `references/agent-friendly-criteria.md` — cztery bramki jakości + zastrzeżenie dla każdej rodziny języków.
- `references/decision-flow.md` — kroki A–E dla obu ścieżek.

## Krytyczne zabezpieczenia

1. **PRD jest warunkiem wstępnym, a nie rozwiązaniem awaryjnym.** Bez wbudowanego mini-PRD, bez odczytywania rozmowy w poszukiwaniu zastępczych priorów. Plik na dysku jest kontraktem.

2. **Domyślna opcja Q0 jest redakcyjna.** Nazwij rekomendację z góry; wymagaj wyraźnego potwierdzenia. Nigdy nie akceptuj cicho przez domyślny wybór.

3. **Ścieżka standardowa kontra niestandardowa jest wiążąca.** Standardowa skraca proces do rekomendacji + Q4/Q5/nazwy projektu. Niestandardowa wykonuje pełne przejście plus autokontrolę Q8. Nie mieszaj ich — ścieżka wybrana przez użytkownika w Q0 jest tym, co zapisuje `hints.path_taken`.

4. **`bootstrapper_confidence` ma charakter informacyjny, nigdy blokujący.** Pewność `best-effort` NIE wyklucza startera z rekomendacji; pojawia się w rozmowie jako uprzedzenie i trafia do `hints.bootstrapper_confidence`, aby bootstrapper mógł się dostosować.

5. **Walidator jednokierunkowy.** Bootstrapper nie może odwoływać się do `starter_id`, którego nie ma w rejestrze tej umiejętności; tech-stack-selector może obsługiwać startery, których bootstrapper jeszcze nie podłączył (te startery mają `bootstrapper_confidence: best-effort`, dopóki nie zostaną zweryfikowane kompleksowo).

6. **Wyłącznie uniwersalny język.** W dostarczanej zawartości nie umieszczaj prywatnych ścieżek vault ani brandingu specyficznego dla organizacji. `pnpm validate:no-vault-paths` wymusza to w CI. Rejestr recommended-defaults jest z założenia wielojęzykowy; żaden pojedynczy starter nie jest „tą” rekomendowaną ścieżką.

7. **Wewnętrzne etykiety umiejętności pozostają wewnętrzne.** Rozmawiając z użytkownikiem, nigdy nie odwołuj się do numerów Q (`Q0`, `Q3`, `Q6`), liter kroków (`Step A`, `Step B`, …, `Step E`) ani sformułowań autora takich jak „path-fork”, „residual interview”, „Socratic moment”, „decision flow”. Te etykiety organizują dokumenty referencyjne dla nawigacji w czasie działania; użytkownik nie ma sposobu, aby przypisać je do czegokolwiek widocznego. Przed wyświetleniem przełóż je na prosty język — „this choice” zamiast „the path-fork”, „the framework question” zamiast „Q6”, „an alternative worth flagging” zamiast „a Socratic moment”, „I'll skip the feature audit, team profile, and tech preferences questions” zamiast „I'll skip Q1–Q3”. To samo dotyczy wewnętrznych ścieżek pól w rozmowie: `hints.deployment_target` / `agent_friendly.typed` / `bootstrapper_confidence` to nazwy pól w przekazaniu / rejestrze, a nie sformułowania do wypowiedzenia użytkownikowi — „your deployment target”, „whether the stack uses explicit types”, „how smooth scaffolding will be” są tłumaczeniami przeznaczonymi dla użytkownika.