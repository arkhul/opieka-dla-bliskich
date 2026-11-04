-- CI guard for the AGENTS.md Hard Rule on new tables: Supabase grants ALL on public tables to anon and
-- authenticated by default, so a migration that forgets `revoke all` leaves TRUNCATE (which bypasses RLS),
-- REFERENCES and TRIGGER behind. No application table grants these on purpose, so any hit means a missing revoke.
-- Checks every table in public, including ones added after this file. Run: supabase db query --local -f scripts/check-table-grants.sql
do $$
declare
  leftovers text;
begin
  select string_agg(format('%s (%s: %s)', c.relname, r.role, p.priv), ', ' order by c.relname, r.role, p.priv)
  into leftovers
  from pg_class c
  cross join (values ('anon'), ('authenticated')) as r(role)
  cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p')
    and has_table_privilege(r.role, c.oid, p.priv);

  if leftovers is not null then
    raise exception 'Default Supabase grants left on public tables: %. Revoke all from anon, authenticated and grant explicitly (AGENTS.md, Hard Rules).', leftovers;
  end if;
end
$$;
