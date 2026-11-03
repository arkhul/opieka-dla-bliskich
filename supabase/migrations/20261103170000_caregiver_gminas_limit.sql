-- Migration: caregiver_gminas_limit
-- Purpose: enforce the 30-gmina limit per caregiver in the database.
--   save_caregiver_profile() and the API already reject more than 30 gminas, but the
--   caregiver_gminas insert policy also lets a caregiver insert rows directly through
--   PostgREST, which bypassed the limit (impl-review F1 for caregiver-profile-setup).
-- Rows inserted without an end-user session (auth.uid() is null: migrations, the gminas
-- generator's rebind step, service_role) are not limited, so a rebind that briefly needs
-- one extra row (insert successor, then delete the retired link) is never blocked.

-- ---------------------------------------------------------------------------
-- Limit trigger
-- SECURITY INVOKER: the count runs under the caller's RLS; caregiver_gminas is readable
-- by authenticated, so the caller sees all of their own rows. Rows that already exist
-- are let through so that "insert ... on conflict do nothing" keeps working at 30 gminas.
-- Within a multi-row insert, a row-level BEFORE trigger sees rows inserted earlier by the
-- same statement, so the 31st row is rejected.
-- ---------------------------------------------------------------------------
create function public.enforce_caregiver_gminas_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if exists (
    select 1
    from public.caregiver_gminas as cg
    where cg.caregiver_id = new.caregiver_id
      and cg.teryt = new.teryt
  ) then
    return new;
  end if;

  if (
    select count(*)
    from public.caregiver_gminas as cg
    where cg.caregiver_id = new.caregiver_id
  ) >= 30 then
    raise exception 'Możesz wybrać najwyżej 30 gmin.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.enforce_caregiver_gminas_limit() is
  'Rejects a 31st caregiver_gminas row for a caregiver when inserted by an end user (auth.uid() set).';

create trigger caregiver_gminas_limit
  before insert on public.caregiver_gminas
  for each row execute function public.enforce_caregiver_gminas_limit();

-- Trigger functions need no execute grant; revoke the PUBLIC default like handle_new_user().
revoke execute on function public.enforce_caregiver_gminas_limit() from public, anon, authenticated;
