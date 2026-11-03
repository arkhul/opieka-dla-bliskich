---
name: pack-init
description: Create an npm-based AI toolkit package skeleton that bundles skills, rules and installer logic for the Model 2 CodeArtifact delivery path.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
# /pack-init — Zainicjuj pakiet AI Toolkit

Tworzysz szkielet pakietu, który przekształca wygenerowane artefakty AI w wersjonowany pakiet npm.

To drugi krok potoku Model 2 z m5l4: gdy umiejętność zespołu już istnieje (na przykład `skills/code-review/SKILL.md` wygenerowany z `m5l4-shared-spec-skill.md` za pomocą dowolnego narzędzia do tworzenia umiejętności lub ręcznie), ta umiejętność opakowuje artefakt w pakiet, który można opublikować w AWS CodeArtifact. Jeśli żadna umiejętność jeszcze nie istnieje, utwórz szkielet `skills/code-review/SKILL.md` na podstawie `m5l4-shared-spec-skill.md` i `m5l4-shared-conventions.md` oraz poinformuj osobę uczącą się, aby sprawdziła go przed publikacją.

## Dane wejściowe

Odczytaj te pliki, jeśli są obecne:

Specyfikacje `m5l4-*.md` pochodzą z `10x get m5l4`, które zapisuje je w katalogu promptów Twojego narzędzia (`.claude/prompts/` lub `.cursor/prompts/`, `.github/prompts/`, `.agents/prompts/` dla innych narzędzi). Najpierw sprawdź tam, a następnie użyj katalogu głównego repozytorium, jeśli osoba ucząca się je przeniosła.

- `m5l4-codeartifact-spec-cicd.md`
- `m5l4-codeartifact-spec-terraform.md`
- `m5l4-shared-spec-skill.md`
- `m5l4-shared-conventions.md`
- `context/spec-pack.md`
- `context/spec-cicd.md`
- `context/spec-terraform.md`

Sprawdź również istniejące wygenerowane artefakty:

- `skills/*/SKILL.md`
- `rules/CLAUDE.md`
- `commands/`
- `prompts/`

## Przebieg pracy

1. Potwierdź nazwę pakietu i przestrzeń nazw.
   - Preferuj wartości ze specyfikacji.
   - Domyślne wartości lekcyjne to `@10xdevs/ai-toolkit` oraz przestrzeń nazw `10xdevs`.
2. Utwórz `packages/ai-toolkit/`, jeśli nie istnieje.
3. Skopiuj lub utwórz szkielet struktury artefaktu:

```text
packages/ai-toolkit/
├── package.json
├── pack.yaml
├── install.js
├── uninstall.js
├── bin/
│   └── cli.js
├── skills/
│   └── code-review/
│       └── SKILL.md
└── rules/
    └── CLAUDE.md
```

4. Dodaj `package.json` zawierający:
   - nazwę pakietu,
   - wersję,
   - `type`,
   - `files`,
   - `bin`,
   - `postinstall`,
   - silnik Node (`"engines": { "node": ">=22" }`).
5. Dodaj `pack.yaml` zawierający co najmniej:
   - `name`,
   - `version`,
   - `description`,
   - `namespace`.
6. Dodaj zachowanie instalatora:
   - tryb `npm install` może tworzyć dowiązania symboliczne z `node_modules`,
   - tryb `npx <package> install` musi kopiować pliki, ponieważ pamięć podręczna npx jest tymczasowa,
   - zainstalowane pliki muszą być śledzone w manifeście,
   - dezinstalacja musi odczytywać manifest zamiast zgadywać ścieżki.

## Zasady bezpieczeństwa

- Nie koduj na stałe ścieżek do prywatnych maszyn.
- Nie zapisuj sekretów AWS, tokenów ani poświadczeń konta w plikach pakietu.
- Nie nadpisuj plików zarządzanych przez użytkownika bez bloku znacznika lub wyraźnego potwierdzenia.
- Zachowaj idempotentność operacji instalatora.

## Weryfikacja

Uruchom, gdy to możliwe:

```bash
npm pack --dry-run
node -e "JSON.parse(require('fs').readFileSync('packages/ai-toolkit/package.json', 'utf8'))"
test -f packages/ai-toolkit/pack.yaml
```

Jeśli wygenerowany pakiet zawiera umiejętności, sprawdź, czy każdy `SKILL.md` rozpoczyna się od prawidłowego frontmatteru.