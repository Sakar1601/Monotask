-- Short-lived mapping from an OAuth "state" nonce back to the user who
-- started the flow. Needed because Google's redirect to our callback is a
-- plain browser navigation with no Monotask session/Authorization header.
create table public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google')),
  created_at timestamp with time zone not null default now()
);

alter table public.oauth_states enable row level security;
-- No policies: only the service role (Edge Functions) may read/write this table.

-- One row per user-provider OAuth connection.
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google')),
  status text not null default 'connected' check (status in ('connected', 'expired', 'error', 'disconnected')),
  calendar_sync_enabled boolean not null default true,
  message_scan_enabled boolean not null default false,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamp with time zone not null,
  scope text,
  last_synced_at timestamp with time zone,
  last_scanned_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, provider)
);

alter table public.integration_connections enable row level security;

-- Clients never get SELECT/INSERT/UPDATE on the base table (it holds
-- tokens) - only DELETE, so a user can disconnect their own connection.
-- All reads go through integration_connections_view below; all other
-- writes go through Edge Functions using the service role key.
revoke all on public.integration_connections from authenticated;
grant delete on public.integration_connections to authenticated;

create policy "Users can delete their own connections"
  on public.integration_connections
  for delete
  using (auth.uid() = user_id);

-- Client-facing view: everything except access_token/refresh_token.
-- security_invoker = false (the default for a view owned by the migration
-- role) means the view runs with the view owner's privileges against the
-- base table, bypassing the base table's "no SELECT for authenticated"
-- lockdown, while the "where user_id = auth.uid()" clause below is what
-- actually scopes results to the caller - this is the standard Postgres
-- pattern for exposing a subset of a locked-down table's columns.
create view public.integration_connections_view as
  select
    id, user_id, provider, status, calendar_sync_enabled,
    message_scan_enabled, expires_at, scope, last_synced_at,
    last_scanned_at, last_error, created_at, updated_at
  from public.integration_connections
  where user_id = auth.uid();

grant select on public.integration_connections_view to authenticated;
