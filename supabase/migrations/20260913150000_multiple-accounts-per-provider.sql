-- Allow a user to connect more than one Google (or Microsoft) account.
-- Previously a UNIQUE (user_id, provider) constraint plus an upsert
-- keyed on it meant connecting a second account of the same provider
-- silently overwrote the first one's tokens in place.
alter table public.integration_connections drop constraint integration_connections_user_id_provider_key;

-- oauth_states now optionally carries which specific connection row an
-- OAuth round-trip is for - set only when the flow was started from a
-- "Reconnect" action on an existing connection, so integration-oauth-callback
-- can update that exact row instead of guessing by (user_id, provider),
-- which is now ambiguous with multiple accounts per provider. Left null
-- for a fresh "Connect" (or "Connect another account"), which always
-- inserts a new row.
alter table public.oauth_states add column connection_id uuid references public.integration_connections on delete cascade;
