-- Per-user daily call counter for AI features, enforced atomically server-side
-- so a single caller can't run up unbounded Anthropic API spend.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
  ON public.ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE policy for regular clients: all writes go through the
-- SECURITY DEFINER function below, which enforces the daily cap atomically.

-- Atomically checks-and-increments today's call count for the current user.
-- Returns true if the call is allowed (and has been counted), false if the
-- caller is already at or over daily_limit for this feature today.
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  p_feature TEXT,
  p_daily_limit INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.ai_usage (user_id, feature, usage_date, call_count)
  VALUES (auth.uid(), p_feature, CURRENT_DATE, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;

  UPDATE public.ai_usage
  SET call_count = call_count + 1,
      updated_at = now()
  WHERE user_id = auth.uid()
    AND feature = p_feature
    AND usage_date = CURRENT_DATE
    AND call_count < p_daily_limit
  RETURNING call_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;
