-- Clients normally have no UPDATE privilege on integration_connections
-- because it contains OAuth tokens. The message-scanning preference is the
-- single safe exception: users may only change that flag on their own rows.
-- The existing id/user_id SELECT grant and policy are intentionally retained
-- so PostgREST can evaluate the id predicate and this ownership policy.
grant update (message_scan_enabled) on public.integration_connections to authenticated;

create policy "Users can toggle message scanning on their own connections"
  on public.integration_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
