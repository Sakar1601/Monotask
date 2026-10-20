-- Web Push subscriptions: one row per browser/device a user has enabled
-- notifications on. The endpoint is the push service's unique URL for that
-- browser, so it is the natural dedupe key.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- IANA zone of the device (e.g. 'America/Los_Angeles'). Task due times
  -- and habit times are stored as bare local times, so send-reminders needs
  -- this to know when they actually happen.
  timezone text not null default 'UTC',
  created_at timestamp with time zone not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own push subscriptions"
  on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "Users can add their own push subscriptions"
  on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "Users can update their own push subscriptions"
  on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- One row per reminder already sent, so the every-5-minutes cron (whose
-- windows overlap by design) never notifies twice for the same thing.
-- Service-role only: RLS on with no policies means no client access.
create table public.sent_reminders (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('task', 'event', 'habit')),
  item_id uuid not null,
  remind_at timestamp with time zone not null,
  sent_at timestamp with time zone not null default now(),
  primary key (user_id, kind, item_id, remind_at)
);

create index sent_reminders_sent_at_idx on public.sent_reminders (sent_at);

alter table public.sent_reminders enable row level security;

-- Same Vault-based pattern as the other schedules (see
-- 20260923120000_fix-cron-hardcoded-project-url.sql): nothing
-- project-specific lives in this file.
select cron.schedule(
  'send-reminders-every-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
