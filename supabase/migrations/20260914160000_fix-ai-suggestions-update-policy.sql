-- The original UPDATE policy on ai_suggestions had USING but no WITH
-- CHECK, and the grant covered every column - a user could take a
-- suggestion they own and rewrite its user_id (planting a suggestion
-- into a stranger's review queue) or its payload/kind (forging the
-- "AI-extracted" provenance the review model depends on). Clients only
-- ever legitimately change status (pending -> accepted/dismissed);
-- narrow the grant to that one column and add the missing WITH CHECK,
-- matching the pattern 20260914150000 already established for
-- integration_connections.message_scan_enabled.
revoke update on public.ai_suggestions from authenticated;
grant update (status) on public.ai_suggestions to authenticated;

drop policy "Users can update their own suggestions" on public.ai_suggestions;
create policy "Users can update their own suggestions"
  on public.ai_suggestions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
