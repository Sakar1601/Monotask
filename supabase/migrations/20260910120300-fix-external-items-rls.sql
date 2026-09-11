-- Fix: the SELECT policies added in 20260910120100-external-items.sql join
-- back to the BASE table public.integration_connections. RLS policy
-- expressions are evaluated with the privileges of the INVOKING role, and
-- 20260910120000-integration-oauth-foundation.sql does
-- "revoke all on public.integration_connections from authenticated" - so
-- every authenticated read of external_events/external_tasks failed with
-- "permission denied for table integration_connections".
--
-- Granting SELECT on the base table would trade the error for a silently
-- empty result (the base table has no SELECT policy, so the EXISTS subquery
-- would always be false). Instead, reference public.integration_connections_view,
-- which is owner-privileged (security_invoker = false, so it bypasses the base
-- table's RLS) and already filters "where user_id = auth.uid()". No new grant
-- is needed - "grant select on public.integration_connections_view to
-- authenticated" already exists.

drop policy if exists "Users can view their own external events" on public.external_events;

create policy "Users can view their own external events"
  on public.external_events
  for select
  using (
    exists (
      select 1 from public.integration_connections_view v
      where v.id = external_events.connection_id
    )
  );

drop policy if exists "Users can view their own external tasks" on public.external_tasks;

create policy "Users can view their own external tasks"
  on public.external_tasks
  for select
  using (
    exists (
      select 1 from public.integration_connections_view v
      where v.id = external_tasks.connection_id
    )
  );
