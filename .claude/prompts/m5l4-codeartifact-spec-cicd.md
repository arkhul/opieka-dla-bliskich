# CodeArtifact CI/CD — Wymagania

> **Dodatek AWS dla Modelu 2.** Użyj tego wyłącznie wtedy, gdy świadomie wybrałeś
> ścieżkę infrastruktury zarządzanej: AWS CodeArtifact + Terraform. W przypadku domyślnej
> ścieżki Zadania 3 użyj zamiast tego `m5l4-github-packages-spec-cicd.md`.

## Cel
Utwórz workflow GitHub Actions, który waliduje i publikuje pakiet npm zestawu narzędzi AI
do AWS CodeArtifact.

## Konfiguracja
- Branch: `master` (dostosuj do `main`, jeśli jest to Twoja domyślna gałąź)
- Region AWS: `eu-central-1`
- Domena CodeArtifact: `devs10x`
- Repozytorium CodeArtifact: `npm`
- Plik workflow: `.github/workflows/ci.yml`
- Lokalizacja pakietu: `packages/ai-toolkit/` (względem głównego katalogu repozytorium)
- GitHub secrets: `AWS_ACCOUNT_ID` i `AWS_ROLE_ARN`

## Uwierzytelnianie OIDC
- Action: `aws-actions/configure-aws-credentials@e1253824e5c10ff9df46874f81ed3ec929e19cfd # v6.3.0`
- Przypnij również `actions/checkout` i `actions/setup-node` do pełnych SHA (tag w komentarzu);
  użyj `node-version: 24`
- Rola: odwołanie przez `${{ secrets.AWS_ROLE_ARN }}`
- Wymagane uprawnienie workflow: `id-token: write`

## Kontrole walidacyjne
1. `pack.yaml` istnieje i zawiera wymagane pola: `name`, `version`, `description`, `namespace`
2. Każdy `skills/*/SKILL.md` ma frontmatter YAML z `name` i `description`
3. Frontmatter `name` odpowiada nazwie katalogu umiejętności
4. `npm pack --dry-run` kończy się powodzeniem

## Konfiguracja sekretów
```bash
gh secret set AWS_ACCOUNT_ID --body "<account-id>" --repo <owner>/<repo>
gh secret set AWS_ROLE_ARN --body "<role-arn>" --repo <owner>/<repo>
```

## Przepływ publikacji
1. Skonfiguruj poświadczenia AWS przez OIDC.
2. Uruchom `aws codeartifact login`.
3. Uruchom walidację.
4. Opublikuj pakiet npm.