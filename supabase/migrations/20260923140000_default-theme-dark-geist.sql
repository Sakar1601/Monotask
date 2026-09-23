-- The app's default is dark + Geist (see useSettings defaultSettings), but
-- the original schema hard-coded theme "light" / font "Inter" both as the
-- profiles.settings column default and inside handle_new_user(). Because
-- the client merges `{...defaultSettings, ...data.settings}`, the stored
-- row always won, so every new signup came up light regardless of the
-- app default.
alter table public.profiles
  alter column settings set default
  '{"timeFormat": "24h", "timezone": "UTC", "theme": "dark", "font": "Geist"}'::jsonb;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, settings)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    '{"timeFormat": "24h", "timezone": "UTC", "theme": "dark", "font": "Geist"}'
  );

  insert into public.tags (user_id, name, color) values
    (new.id, 'Work', '#111827'),
    (new.id, 'Personal', '#374151'),
    (new.id, 'Health', '#6b7280'),
    (new.id, 'Learning', '#9ca3af');

  return new;
end;
$$;

-- Backfill only accounts whose settings are still exactly the untouched
-- old default (i.e. the user never changed anything), so a deliberate
-- light-mode choice is never overridden.
update public.profiles
set settings = '{"timeFormat": "24h", "timezone": "UTC", "theme": "dark", "font": "Geist"}'::jsonb
where settings = '{"timeFormat": "24h", "timezone": "UTC", "theme": "light", "font": "Inter"}'::jsonb;
