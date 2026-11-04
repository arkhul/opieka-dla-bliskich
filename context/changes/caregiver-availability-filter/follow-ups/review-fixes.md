# Review follow-ups: caregiver-availability-filter

Source: `reviews/impl-review.md` (2026-11-04).

- [ ] **F1 (production)**: apply `supabase/migrations/20261104130000_save_profile_keeps_availability.sql` on production (`npx supabase db push`), then deploy the Worker with the F2–F5 fixes (`npm run build` + `npx wrangler deploy`). The migration is backward compatible: the deployed Worker always sends `p_availability`.
- [ ] **F6 (S-05)**: the empty-result hints on `/opiekunowie` cost one `search_caregivers` call per active filter (worst case 5 calls per request). When S-05 touches ranking, replace them with one RPC that returns all "relaxed" counts in one call.
