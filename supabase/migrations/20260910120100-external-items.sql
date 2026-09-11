create table public.external_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections on delete cascade,
  external_id text not null,
  title text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone,
  meeting_url text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (connection_id, external_id)
);

create table public.external_tasks (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections on delete cascade,
  external_id text not null,
  title text not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  source_url text,
  raw_payload jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (connection_id, external_id)
);

alter table public.external_events enable row level security;
alter table public.external_tasks enable row level security;

-- No tokens in these tables, so a straightforward SELECT-only policy via a
-- join back to the owning connection is enough (no view needed).
create policy "Users can view their own external events"
  on public.external_events
  for select
  using (
    exists (
      select 1 from public.integration_connections c
      where c.id = external_events.connection_id and c.user_id = auth.uid()
    )
  );

create policy "Users can view their own external tasks"
  on public.external_tasks
  for select
  using (
    exists (
      select 1 from public.integration_connections c
      where c.id = external_tasks.connection_id and c.user_id = auth.uid()
    )
  );

-- All writes (insert/update/delete) happen via sync-integrations using the
-- service role key, which bypasses RLS - no client write policies needed.
