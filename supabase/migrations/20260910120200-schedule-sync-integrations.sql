create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- The service role key can't be committed to a migration file. Run this
-- once per environment (local + each deployed project) via the Supabase
-- SQL editor or `supabase db execute`, substituting the real key:
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- The schedule below reads it back from Vault at call time so the key
-- itself never appears in source control or migration history.

select cron.schedule(
  'sync-integrations-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://masofmjpnpnxjooqdajl.supabase.co/functions/v1/sync-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
