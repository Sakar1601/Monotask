-- Lets Settings show which account is connected per provider (a user with
-- several Google/Microsoft accounts otherwise has no way to tell which one
-- is wired up). Nullable and best-effort: integration-oauth-callback
-- swallows a failure to fetch this rather than blocking the connect on it.
alter table public.integration_connections add column account_email text;

drop view public.integration_connections_view;
create view public.integration_connections_view as
  select
    id, user_id, provider, status, calendar_sync_enabled,
    message_scan_enabled, expires_at, scope, last_synced_at,
    last_scanned_at, last_error, account_email, created_at, updated_at
  from public.integration_connections
  where user_id = auth.uid();

grant select on public.integration_connections_view to authenticated;
