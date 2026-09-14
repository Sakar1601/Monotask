-- Bug: disconnecting an integration (DELETE .../integration_connections?id=eq.<id>)
-- silently deleted 0 rows for every user, despite the existing "Users can
-- delete their own connections" FOR DELETE policy correctly matching the
-- row. Root cause: this table only ever had a FOR DELETE policy, never a
-- FOR SELECT one (by design - the base table holds access_token/
-- refresh_token, so SELECT was fully revoked and clients read through
-- integration_connections_view instead). An *unconditional*
-- "delete from integration_connections;" only needs the DELETE policy and
-- works fine, but any DELETE with a WHERE clause that references a table
-- column (id, in the app's case) requires PostgreSQL to do an implicit
-- read to evaluate that predicate - which needs a SELECT-command policy.
-- With none defined, that implicit read sees zero rows under RLS's
-- default-deny, so the DELETE's WHERE clause never matches anything,
-- even though the DELETE policy alone would have allowed it. No error is
-- raised either way - PostgREST returns 204 for a 0-row delete - which is
-- why this went unnoticed rather than surfacing as a visible failure.
--
-- Fix: grant SELECT on just the two columns a client-side .eq('id', ...)
-- delete actually needs to read (id for the WHERE clause, user_id for the
-- policy's own USING check), plus a matching FOR SELECT policy scoped
-- exactly like the FOR DELETE one. access_token/refresh_token/etc. are
-- deliberately left ungranted, so this does not reopen the token-exposure
-- this table's lockdown was designed to prevent - a client still cannot
-- select those columns directly, on this table or the view.
grant select (id, user_id) on public.integration_connections to authenticated;

create policy "Users can read their own connection id for disconnect"
  on public.integration_connections
  for select
  using (auth.uid() = user_id);
