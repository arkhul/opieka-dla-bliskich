---
change_id: public-caregiver-search
title: Public caregiver search
status: archived
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03T19:00:39Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Impl review (2026-11-03) — re-verification
- Re-run on HEAD: `npm run lint`, `npx astro check`, `npm run build`, `npx supabase db lint --level error`, `npm run smoke` (fresh preview) — all green.
- Row 1.5 re-checked: `set role anon; explain analyze select * from public.search_caregivers('1465011')` → 2 rows, execution 3.5 ms (local DB with 2 profiles).
- Rows 2.5–2.9, 3.5, 3.6 (browser/375 px checks) were not re-run in this review; they rest on the original implementation sessions.
