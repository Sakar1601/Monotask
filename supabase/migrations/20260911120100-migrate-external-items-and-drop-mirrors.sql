-- One-time copy: external_events -> events. The mirror row's connection_id
-- already carries the owning user indirectly via integration_connections;
-- join to it for user_id since events.user_id is NOT NULL.
insert into public.events (
  user_id, title, start_time, end_time, meeting_url,
  google_connection_id, google_event_id, synced_at, created_at, updated_at
)
select
  c.user_id,
  ee.title,
  ee.start_time,
  ee.end_time,
  ee.meeting_url,
  ee.connection_id,
  ee.external_id,
  ee.updated_at,
  ee.created_at,
  ee.updated_at
from public.external_events ee
join public.integration_connections c on c.id = ee.connection_id;

-- One-time copy: external_tasks -> tasks. priority has no equivalent on the
-- Google side, so every migrated task defaults to 'medium' (matches this
-- plan's default for newly-synced tasks going forward, set in Task 4).
insert into public.tasks (
  user_id, title, due_date, status, completed_at, priority,
  google_connection_id, google_task_id, synced_at, created_at, updated_at
)
select
  c.user_id,
  et.title,
  et.due_date,
  et.status,
  case when et.status = 'completed' then et.updated_at else null end,
  'medium',
  et.connection_id,
  et.external_id,
  et.updated_at,
  et.created_at,
  et.updated_at
from public.external_tasks et
join public.integration_connections c on c.id = et.connection_id;

drop table public.external_events;
drop table public.external_tasks;
