-- Provider-neutral renames: a second provider (Microsoft) makes the
-- google_* names on tasks/events permanently misleading if not fixed now.
-- Identifier-only change - no behavior change to any existing Google code
-- path's logic (every call site is updated in this same commit).
alter table public.tasks rename column google_connection_id to sync_connection_id;
alter table public.tasks rename column google_task_id to external_task_id;
alter table public.events rename column google_connection_id to sync_connection_id;
alter table public.events rename column google_event_id to external_event_id;

-- Denormalized so the UI/export code can label a row's source without a
-- join back to integration_connections on every render.
alter table public.tasks add column sync_provider text check (sync_provider in ('google', 'microsoft'));
alter table public.events add column sync_provider text check (sync_provider in ('google', 'microsoft'));
update public.tasks set sync_provider = 'google' where sync_connection_id is not null;
update public.events set sync_provider = 'google' where sync_connection_id is not null;

-- Provider-specific extra state that doesn't belong on every connection
-- row's own columns (Microsoft's resolved default-task-list id is the
-- first user; unused/null for Google).
alter table public.integration_connections add column provider_metadata jsonb;

alter table public.integration_connections drop constraint integration_connections_provider_check;
alter table public.integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('google', 'microsoft'));

-- oauth_states has its own, separate provider check constraint (not
-- covered by the spec's SQL) - without widening it too, the very first
-- Microsoft connect attempt fails at integration-oauth-start's insert.
alter table public.oauth_states drop constraint oauth_states_provider_check;
alter table public.oauth_states
  add constraint oauth_states_provider_check
  check (provider in ('google', 'microsoft'));
