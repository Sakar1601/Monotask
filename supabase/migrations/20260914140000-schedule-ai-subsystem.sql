-- Same pattern as 20260910120200-schedule-sync-integrations.sql: reads
-- the service-role key back from Vault at call time. Assumes
-- vault.create_secret('<service-role-key>', 'service_role_key') has
-- already been run once per environment (it was, for sync-integrations'
-- own schedule) - no new Vault setup needed here.
select cron.schedule(
  'scan-messages-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://masofmjpnpnxjooqdajl.supabase.co/functions/v1/scan-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Scheduled independently of scan-messages (not chained) so a slow or
-- failing message scan never delays conflict detection, and vice versa
-- - pg_cron runs both on the same cadence, not one after the other.
select cron.schedule(
  'detect-conflicts-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://masofmjpnpnxjooqdajl.supabase.co/functions/v1/detect-conflicts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
