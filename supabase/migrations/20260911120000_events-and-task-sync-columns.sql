-- New: native events (Monotask's own object; Google-origin events live here
-- too, distinguished only by google_connection_id/google_event_id being set).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  location text,
  meeting_url text,
  tag_id uuid references public.tags on delete set null,
  -- Sync metadata - all null for a purely-native event.
  google_connection_id uuid references public.integration_connections on delete set null,
  google_event_id text,
  synced_at timestamp with time zone,
  sync_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (google_connection_id, google_event_id)
);

alter table public.events enable row level security;

create policy "Users can view their own events"
  on public.events for select using (auth.uid() = user_id);
create policy "Users can create their own events"
  on public.events for insert with check (auth.uid() = user_id);
create policy "Users can update their own events"
  on public.events for update using (auth.uid() = user_id);
create policy "Users can delete their own events"
  on public.events for delete using (auth.uid() = user_id);

create index idx_events_user_start on public.events(user_id, start_time);

-- tasks gets the same shape of sync metadata as events, so a Google-origin
-- task and a Google-origin event are handled identically by the sync engine.
alter table public.tasks
  add column google_connection_id uuid references public.integration_connections on delete set null,
  add column google_task_id text,
  add column synced_at timestamp with time zone,
  add column sync_error text;

alter table public.tasks
  add constraint tasks_google_unique unique (google_connection_id, google_task_id);

-- A connection whose granted scope no longer covers what the app needs
-- (the write-scope upgrade in Task 3 makes every currently-connected
-- account's old readonly scope insufficient) is paused here rather than
-- left to fail with a generic "error" - the user gets a clear reconnect
-- prompt instead (Task 10).
alter table public.integration_connections drop constraint integration_connections_status_check;
alter table public.integration_connections
  add constraint integration_connections_status_check
  check (status in ('connected', 'expired', 'error', 'disconnected', 'needs_reconnect'));
