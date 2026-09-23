-- Public launch hardening:
-- 1. Split AI usage mutation into a caller-self function and a
--    service-role-only function so public RPC callers cannot choose another
--    tenant's quota row.
-- 2. Consume OAuth state atomically with a short TTL.

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_feature TEXT,
  p_daily_limit INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage (user_id, feature, usage_date, call_count)
  VALUES (v_user_id, p_feature, CURRENT_DATE, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;

  UPDATE public.ai_usage
  SET call_count = call_count + 1,
      updated_at = now()
  WHERE user_id = v_user_id
    AND feature = p_feature
    AND usage_date = CURRENT_DATE
    AND call_count < p_daily_limit
  RETURNING call_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage_for_user(
  p_feature TEXT,
  p_daily_limit INTEGER,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

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

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(text, integer, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage_for_user(text, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage_for_user(text, integer, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_oauth_state(
  p_state TEXT
) RETURNS TABLE (
  user_id UUID,
  provider TEXT,
  connection_id UUID,
  requesting_message_scan BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.oauth_states
  WHERE state = p_state
    AND created_at >= now() - interval '10 minutes'
  RETURNING oauth_states.user_id,
            oauth_states.provider,
            oauth_states.connection_id,
            oauth_states.requesting_message_scan;
$$;

REVOKE ALL ON FUNCTION public.consume_oauth_state(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_oauth_state(text) TO service_role;
