-- Separate from synced_at (which means "content confirmed to match
-- Google") - last_seen_at means "this row was present in the most
-- recent successful fetch from Google", and is what the delete-stale
-- check in sync-integrations keys off. They diverge exactly when a row
-- has a pending local edit: the pull still confirms the row is present
-- in Google (last_seen_at bumps) without overwriting its content
-- (synced_at does NOT bump, since the local edit hasn't been confirmed
-- pushed yet).
alter table public.tasks add column last_seen_at timestamp with time zone;
alter table public.events add column last_seen_at timestamp with time zone;

update public.tasks set last_seen_at = synced_at where google_connection_id is not null;
update public.events set last_seen_at = synced_at where google_connection_id is not null;
