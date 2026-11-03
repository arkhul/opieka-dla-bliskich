# Zestaw narzędzi AI GitHub Packages — Wymagania

> **Domyślna ścieżka dla Zadania 3.** Ta specyfikacja opisuje Model 1 z lekcji:
> wewnętrzny zestaw narzędzi zespołu dystrybuowany jako prywatny pakiet npm przez GitHub
> Packages. Użyj tego jako punktu bazowego, chyba że Twój zespół konkretnie potrzebuje AWS
> CodeArtifact lub pełnego produktu dostarczanego jako API+CLI.

## Cel
Spakuj artefakty AI zespołu do dystrybuowalnego pakietu npm, który repozytoria
konsumenckie mogą instalować z GitHub Packages.

## Metadane pakietu
- Nazwa pakietu: `@twoj-zespol/ai-toolkit`
- Krótka nazwa: `ai-toolkit`
- Wersja: `0.1.0`
- Rejestr: `https://npm.pkg.github.com`
- Wersja Node: `>=22` (`engines.node`)

## Wymagane pliki
Wygeneruj tę strukturę startową:

```text
ai-toolkit/
├── package.json
├── README.md
├── install.js
├── uninstall.js
├── skills/
│   └── code-review/
│       └── SKILL.md
└── rules/
    └── CLAUDE.md
```

## Wymagania dotyczące package.json
Pakiet musi:
- publikować do GitHub Packages przez `publishConfig.registry`;
- zawierać wyłącznie `skills/`, `rules/`, `install.js`, `uninstall.js` i `README.md`
  w opublikowanym pakiecie;
- uruchamiać `node install.js` jako `postinstall`;
- udostępniać `ai-toolkit` i `ai-toolkit-uninstall` jako polecenia bin do ręcznej
  instalacji/deinstalacji;
- deklarować `"engines": { "node": ">=22" }`.

Przykład:

```json
{
  "name": "@twoj-zespol/ai-toolkit",
  "version": "0.1.0",
  "description": "Team AI artifacts distributed through GitHub Packages",
  "license": "UNLICENSED",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "files": ["skills/", "rules/", "install.js", "uninstall.js", "README.md"],
  "scripts": {
    "postinstall": "node install.js"
  },
  "bin": {
    "ai-toolkit": "./install.js",
    "ai-toolkit-uninstall": "./uninstall.js"
  },
  "engines": {
    "node": ">=22"
  }
}
```

## Konfiguracja repozytorium konsumenckiego
Wygeneruj instrukcje dla repozytoriów konsumenckich:

```text
@twoj-zespol:registry=https://npm.pkg.github.com
```

Zacommitowany plik `.npmrc` musi zawierać wyłącznie mapowanie rejestru. Nie może
zawierać tokenu.

## Zachowanie instalatora
Instalator powinien:
- zlokalizować katalog główny projektu konsumenckiego;
- instalować umiejętności w `.claude/skills/<skill-name>/`;
- dopisywać reguły do `CLAUDE.md` pomiędzy markerami sentinel;
- zapisywać `.claude/.ai-toolkit-manifest.json` z wersją pakietu (odczytaną z
  `package.json`, nigdy zakodowaną na stałe) oraz zainstalowanymi plikami;
- być idempotentny: uruchomienie instalacji dwa razy aktualizuje zarządzane bloki zamiast je duplikować;
- zatrzymywać się z jasnym komunikatem zamiast dopisywać drugi blok, gdy obecny jest tylko jeden
  marker sentinel (ktoś ręcznie zmodyfikował zarządzany blok);
- unikać niepowodzenia całego `npm install`, gdy czyszczenie lub linkowanie po postinstall się nie powiedzie.

Użyj tych markerów sentinel:

```text
<!-- BEGIN @twoj-zespol/ai-toolkit -->
<!-- END @twoj-zespol/ai-toolkit -->
```

## Zachowanie uwierzytelniania
Instalator może dodać tego pomocnika `preinstall` do konsumenckiego `package.json`, gdy
projekt konsumencki nie ma istniejącego mechanizmu uwierzytelniania GitHub Packages:

```bash
[ -n "$GH_PKG_TOKEN" ] && echo '//npm.pkg.github.com/:_authToken=${GH_PKG_TOKEN}' >> .npmrc || true
```

Ten pomocnik jest przeznaczony dla CI. Lokalni deweloperzy powinni używać `npm login` lub własnego
pliku `.npmrc` na poziomie użytkownika. Nigdy nie commituj `_authToken` do repozytorium.