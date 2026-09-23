-- Security fix: the three cron schedules below previously hard-coded this
-- project's own Edge Function URL (masofmjpnpnxjooqdajl.supabase.co)
-- directly in the migration SQL. Migrations are meant to be reusable - if
-- this public repo is applied to a *different* Supabase project, that
-- project's own service-role key (read correctly, per-environment, from
-- its own Vault) would still have been sent to *this* project's URL,
-- leaking a live service-role credential across a project boundary
-- (CWE-200/CWE-522).
--
-- Fix: the base URL is now also resolved from Vault at call time, the
-- same way the service-role key already was - nothing project-specific
-- is embedded in source control anymore. Run once per environment,
-- alongside the existing service_role_key secret:
--   select vault.create_secret('https://<your-project-ref>.supabase.co', 'functions_base_url');
--
-- cron.schedule() with a job name that already exists replaces that job's
-- definition in place (see pg_cron docs) - safe to call again here.

select cron.schedule(
  'sync-integrations-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url') || '/functions/v1/sync-integrations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'scan-messages-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url') || '/functions/v1/scan-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'detect-conflicts-every-10-min',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_base_url') || '/functions/v1/detect-conflicts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
