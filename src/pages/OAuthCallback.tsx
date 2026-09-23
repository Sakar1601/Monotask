import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const OAuthCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const finishOAuth = async () => {
      const code = params.get("code");
      const state = params.get("state");
      const providerError = params.get("error");

      if (providerError || !code || !state) {
        navigate("/app?integration=error", { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke("integration-oauth-callback", {
        body: { code, state },
      });

      if (error || data?.status !== "connected") {
        navigate("/app?integration=error", { replace: true });
        return;
      }

      const provider = data.provider ? `&provider=${encodeURIComponent(data.provider)}` : "";
      navigate(`/app?integration=connected${provider}`, { replace: true });
    };

    void finishOAuth();
  }, [navigate, params]);

  return null;
};

export default OAuthCallback;
