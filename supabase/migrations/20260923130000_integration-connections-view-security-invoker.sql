-- Supabase security advisor: integration_connections_view was a
-- SECURITY DEFINER view (the default for a view owned by the migration
-- role), i.e. it ran with its owner's privileges and bypassed the base
-- table's RLS and grants. It was deliberately owner-privileged so clients
-- could read connection state without any SELECT on the token-bearing base
-- table - but that leans on the view's own `where user_id = auth.uid()`
-- as the only tenant boundary.
--
-- Fix: make the view security_invoker, so the *caller's* privileges and
-- RLS apply, and give the caller exactly what the view needs on the base
-- table: SELECT on the non-secret columns only (access_token,
-- refresh_token and provider_metadata stay ungranted, so tokens remain
-- unreadable on both the table and the view) plus a row-scoped SELECT
-- policy. A "for select using (auth.uid() = user_id)" policy already
-- exists from 20260913130000 (disconnect fix); it now also scopes the view.
grant select (
  id, user_id, provider, status, calendar_sync_enabled,
  message_scan_enabled, expires_at, scope, last_synced_at,
  last_scanned_at, last_error, account_email, created_at, updated_at
) on public.integration_connections to authenticated;

alter view public.integration_connections_view set (security_invoker = on);
