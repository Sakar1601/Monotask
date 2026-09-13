-- One row per AI-generated suggestion, of either kind, reviewed by the
-- user before it becomes a real task or changes a real event. Never
-- holds raw message content - only the model's extracted fields.
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  -- Null for 'reschedule': conflict detection reasons over the user's
  -- own events regardless of provider, so it isn't tied to one connection.
  connection_id uuid references public.integration_connections on delete cascade,
  kind text not null check (kind in ('task', 'reschedule')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  -- 'task': { title, description, due_date, due_time, priority }
  -- 'reschedule': { event_id, other_event_id, current_start_time,
  --                 current_end_time, suggested_start_time,
  --                 suggested_end_time, reasoning }
  payload jsonb not null,
  created_at timestamp with time zone not null default now()
);

alter table public.ai_suggestions enable row level security;

create policy "Users can view their own suggestions"
  on public.ai_suggestions for select using (auth.uid() = user_id);

create policy "Users can update their own suggestions"
  on public.ai_suggestions for update using (auth.uid() = user_id);

-- No secret columns on this table (unlike integration_connections), so a
-- plain table-level grant is safe - no column-level restriction needed.
grant select, update on public.ai_suggestions to authenticated;

-- Backward-compatible: p_user_id defaults to auth.uid(), so parse-task's
-- existing two-argument call keeps working unchanged. scan-messages and
-- detect-conflicts (service-role, no single "current user") pass the
-- target connection/event's user_id explicitly.
DROP FUNCTION IF EXISTS public.check_and_increment_ai_usage(text, integer);

CREATE FUNCTION public.check_and_increment_ai_usage(
  p_feature TEXT,
  p_daily_limit INTEGER,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, feature, usage_date, call_count)
  VALUES (p_user_id, p_feature, CURRENT_DATE, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;

  UPDATE public.ai_usage
  SET call_count = call_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND usage_date = CURRENT_DATE
    AND call_count < p_daily_limit
  RETURNING call_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

-- Carries whether an OAuth round-trip is "enable message scanning for
-- this connection" (vs. a plain reconnect) through to the callback, so
-- it knows whether to flip message_scan_enabled on once the extra
-- scopes are confirmed granted. Always paired with a non-null
-- connection_id in practice (scanning is a toggle on an existing
-- connection, never part of creating a new one).
alter table public.oauth_states add column requesting_message_scan boolean not null default false;
