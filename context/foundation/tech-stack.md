---
starter_id: 10x-astro-starter
package_manager: npm
project_name: opieka-dla-bliskich
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo praca po godzinach, 3 tygodnie do MVP i katalog profili opiekunów, w którym logowanie
jest bramką do danych kontaktowych — to zestaw, przy którym liczy się starter dający auth,
bazę i wdrożenie od razu, zamiast tygodnia na sklejanie ich samodzielnie. 10x Astro Starter
jest rekomendowanym wyborem dla aplikacji webowej w JS/TS i przechodzi wszystkie cztery
bramki jakości: TypeScript i Zod dają jawne kontrakty, układ katalogów i routing są
konwencjonalne, stos jest szeroko obecny w danych treningowych i ma aktualną dokumentację.
Supabase pokrywa konta obu ról, profile opiekunów oraz filtrowanie po gminie, usłudze i
dostępności po stronie Postgresa, a RLS jest właściwym miejscem na regułę, że dane kontaktowe
widzi wyłącznie osoba zalogowana. Płatności, realtime i AI są poza zakresem zgodnie z
Non-Goals PRD. Powiadomienia o nowym profilu (FR-015) zostały oznaczone jako nice-to-have i
nie są tu uwzględnione — runtime brzegowy Cloudflare ogranicza długo działające zadania, więc
przy ich wdrażaniu potrzebny będzie osobny worker lub kolejka. Wdrożenie na Cloudflare Pages,
CI na GitHub Actions z automatycznym wdrożeniem po scaleniu.
