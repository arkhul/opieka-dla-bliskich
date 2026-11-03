# Wspólna umiejętność przeglądu kodu — Wymagania

## Cel
Utwórz umiejętność agenta do automatycznego przeglądu kodu na podstawie konwencji inżynieryjnych zespołu.

## Dane wejściowe
Użyj dołączonego materiału `m5l4-shared-conventions.md` jako dokumentu źródłowego.
Wygenerowana umiejętność powinna przeglądać kod względem tych konwencji, a nie tworzyć nowego standardu przeglądu.

## Konfiguracja
- Nazwa umiejętności: `code-review`
- Kategoria: quality
- Plik docelowy: `skills/code-review/SKILL.md`
- Frazy wyzwalające: „review code”, „check this PR”, „review my changes”, „code review”

## Frontmatter
Plik `SKILL.md` musi zawierać frontmatter YAML z:

```yaml
---
name: code-review
description: Review code changes against team engineering conventions, testing standards and security expectations.
---
```

## Kategorie przeglądu
Użyj kategorii wynikających z materiału o konwencjach:
- Nazewnictwo
- Obsługa błędów
- TypeScript
- Projektowanie funkcji
- Bezpieczeństwo
- Testowanie

## Format wyjściowy
Ustalenia zorganizowane według ważności: Critical → Warning → Suggestion.
Każde ustalenie zawiera odniesienie `file:line`, jeśli jest to możliwe.
Zakończ jedną rekomendacją: `APPROVE`, `REQUEST CHANGES` lub `NEEDS DISCUSSION`.