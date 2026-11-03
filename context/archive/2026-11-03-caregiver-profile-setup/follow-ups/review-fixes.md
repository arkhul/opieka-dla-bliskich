# Follow-ups from the implementation review (caregiver-profile-setup)

Source: `context/changes/caregiver-profile-setup/reviews/impl-review.md`

## F7 — `caregiver_profile_missing` and the public list (for S-02)

- Today: `public.caregiver_profile_missing(uuid)` is `security definer` and granted to `anon`. For any profile it reveals only whether a phone number is set, never the number. Only the owner's page `/profil` uses it.
- For S-02 (public list and filters), decide whether the list should filter on completeness in SQL (a view or RPC that returns only complete profiles and uses the same rule) instead of calling the function per profile. That avoids N+1 calls and lets the `anon` grant be revoked if nothing else needs it.
- Done when: S-02's plan states how the list applies the completeness rule, and whether the `anon` grant stays.
