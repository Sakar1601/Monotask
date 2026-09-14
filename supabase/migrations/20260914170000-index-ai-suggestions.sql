-- Both detect-conflicts (dedup lookup, every 10 minutes) and
-- useAiSuggestions (pending-suggestions query, every page load) filter
-- by this combination with no supporting index - the table only grows
-- (rows are never deleted by design), so this is cheap insurance
-- against a sequential scan as it does.
create index ai_suggestions_user_status_kind_idx on public.ai_suggestions (user_id, status, kind);
