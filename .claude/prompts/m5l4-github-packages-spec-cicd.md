# GitHub Packages CI/CD — Wymagania

> **Domyślna ścieżka dla Zadania 3.** Ta specyfikacja publikuje pakiet zestawu narzędzi AI do
> GitHub Packages. Celowo unika AWS, Terraform, ról IAM oraz
> CodeArtifact.

## Cel
Utwórz workflow GitHub Actions, który waliduje i publikuje pakiet npm zestawu
narzędzi AI do GitHub Packages.

## Konfiguracja
- Plik workflow: `.github/workflows/publish-ai-toolkit.yml`
- Lokalizacja pakietu: katalog główny repozytorium, chyba że agent wygenerował układ
  monorepo; w takim przypadku użyj `packages/ai-toolkit/`
- Gałąź: obsługuj zarówno `main`, jak i `master`
- Wersja Node: `24` (pakiet `engines`: `>=22`)
- Rejestr: `https://npm.pkg.github.com`
- Zakres pakietu: `@twoj-zespol`

## Uprawnienia
Do publikowania użyj tymczasowego tokenu GitHub Actions. Zachowaj domyślne
uprawnienia workflow tylko do odczytu i przyznaj `packages: write` wyłącznie zadaniu publikowania:

```yaml
permissions:
  contents: read

jobs:
  publish:
    permissions:
      contents: read
      packages: write
```

Przypnij każdą akcję zewnętrzną do pełnego SHA commita, z tagiem w komentarzu.

Nie wymagaj `AWS_ACCOUNT_ID`, `AWS_ROLE_ARN`, `id-token: write` ani żadnego
kroku logowania do CodeArtifact.

## Zadanie walidacji
Przed publikacją zweryfikuj:
1. Istnieje `package.json` i zawiera `name`, `version`, `publishConfig.registry`.
2. Istnieje `skills/code-review/SKILL.md`.
3. `SKILL.md` ma frontmatter YAML z `name` oraz `description`.
4. Wartość `name` we frontmatter odpowiada nazwie katalogu umiejętności.
5. `npm pack --dry-run` kończy się powodzeniem.

Początkowy pakiet nie ma zależności ani pliku lockfile, więc nie uruchamiaj `npm ci`.

## Zadanie publikowania
Przy push do `main` lub `master`:
1. Pobierz repozytorium.
2. Skonfiguruj Node z rejestrem GitHub Packages i zakresem pakietu.
3. Pomiń publikowanie, gdy `name@version` z `package.json` znajduje się już w
   rejestrze (`npm view`), aby push bez zwiększenia wersji nie kończył się błędem 409.
4. Opublikuj za pomocą `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

Struktura początkowa:

```yaml
name: Publish AI Toolkit

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - run: test -f skills/code-review/SKILL.md
      - run: npm pack --dry-run

  publish:
    needs: validate
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
          registry-url: "https://npm.pkg.github.com"
          scope: "@twoj-zespol"
      - run: npm publish --ignore-scripts
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Uwaga dotycząca CI konsumentów
Repozytoria konsumentów, które instalują ten prywatny pakiet, potrzebują uwierzytelniania
do odczytu. Użyj osobnego sekretu `GH_PKG_TOKEN` dla CI podmiotów trzecich lub konsumentów z innych organizacji. GitHub Actions w tej samej organizacji może zamiast tego
korzystać z uprawnień repozytorium/pakietu, ale nie zakładaj, że każda platforma buildowa może uzyskać dostęp do tokenu GitHub.