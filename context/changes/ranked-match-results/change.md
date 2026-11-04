---
change_id: ranked-match-results
title: Ranked match results
status: implementing
created: 2026-11-04
updated: 2026-11-04
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Roadmap: S-05 (US-01, FR-016), prerequisites S-02 and S-04 are done.
- Carried over from S-04 review (F6, `context/archive/2026-11-04-caregiver-availability-filter/follow-ups/review-fixes.md`): the empty-result hints on `/opiekunowie` cost one `search_caregivers` call per active filter (up to 5 per request). Replace them with one RPC that returns all "relaxed" counts in one call.
