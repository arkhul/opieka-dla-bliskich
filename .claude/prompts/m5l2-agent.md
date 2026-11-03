# Pierwszy Agent zespołowy - v2

## Konfiguracja

Najpierw zainstaluj umiejętność AI SDK w swoim agencie (w Claude Code trafia ona do `.claude/skills/ai-sdk/SKILL.md`):

```bash
npx skills add vercel/ai --skill ai-sdk
```

## Cel

/goal Chcę postępować zgodnie z @.claude/skills/ai-sdk/SKILL.md i zintegrować AI SDK 7 (`ai@7`), dostawcę OpenRouter (`@openrouter/ai-sdk-provider@3`) oraz zod, tworząc podstawowy punkt wejścia do dalszej integracji w <reviewer-dir>/src/index.ts. Skopiuj schemat recenzji i prompt systemowy z `m5l2-review-schema.ts.template` do <reviewer-dir>/src/review-schema.ts. Upewnij się, że Node 22+ dobrze współpracuje z TypeScript (ESM, `\"type\": \"module\"`), użyj tsx do jego uruchamiania i przypnij powyższe główne wersje (możesz użyć context7 dla aktualnego API).

## Plan

/10x-plan tool-loop-agent Chcę przekształcić '<reviewer-dir>/src/index.ts' w dobrze zorganizowanego, modułowego agenta do przeglądu kodu opartego na AI SDK ToolLoopAgent. Użyj @.claude/skills/ai-sdk/SKILL.md, aby zrozumieć jego API. Zachowaj schemat ustrukturyzowanego wyjścia z src/review-schema.ts jako jedyny kontrakt i przenieś prompty do osobnych modułów. Upewnij się, że moduł agenta jest wielokrotnego użytku i eksportuje naszego recenzenta, abyśmy mogli w przyszłości uruchamiać na nim ewaluacje promptfoo. Nie konfiguruj środowiska ewaluacji w tej zmianie.