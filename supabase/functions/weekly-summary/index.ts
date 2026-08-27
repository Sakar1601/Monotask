// Deno Edge Function. Generates a short natural-language summary of the
// current user's last 7 days of task/habit activity.
//
// Guardrails:
// - Runs with the caller's JWT (not a service-role key) so Postgres RLS
//   scopes every query to auth.uid() automatically.
// - All arithmetic (completion rate, streaks) happens in this function, not
//   the model - Claude only turns already-correct numbers into prose, so a
//   bad generation can't misreport a number, only phrase it awkwardly.
// - check_and_increment_ai_usage enforces a daily call cap server-side.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.122.0";
import { corsHeaders } from "../_shared/cors.ts";

const DAILY_LIMIT = 5;
const MODEL = "claude-haiku-4-5";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allowed, error: rateLimitError } = await supabase.rpc(
      "check_and_increment_ai_usage",
      { p_feature: "weekly-summary", p_daily_limit: DAILY_LIMIT },
    );
    if (rateLimitError) throw rateLimitError;
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Daily limit of ${DAILY_LIMIT} summaries reached. Try again tomorrow.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sinceDate = sevenDaysAgo.toISOString().split("T")[0];

    const [{ data: tasks, error: tasksError }, { data: logs, error: logsError }] = await Promise.all([
      supabase
        .from("tasks")
        .select("status, priority, due_date, completed_at, tags:tag_id (name)")
        .gte("due_date", sinceDate),
      supabase
        .from("logs")
        .select("status, date")
        .gte("date", sinceDate),
    ]);
    if (tasksError) throw tasksError;
    if (logsError) throw logsError;

    const totalTasks = tasks?.length ?? 0;
    const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;
    const overdueTasks =
      tasks?.filter((t) => t.status === "pending" && t.due_date && t.due_date < new Date().toISOString().split("T")[0])
        .length ?? 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const tagCounts: Record<string, number> = {};
    for (const t of tasks ?? []) {
      const name = (t.tags as { name?: string } | null)?.name;
      if (name) tagCounts[name] = (tagCounts[name] ?? 0) + 1;
    }
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const habitCompletions = logs?.filter((l) => l.status === "completed").length ?? 0;
    const habitTotal = logs?.length ?? 0;
    const habitRate = habitTotal > 0 ? Math.round((habitCompletions / habitTotal) * 100) : 0;

    const stats = {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      topTag,
      habitCompletions,
      habitRate,
    };

    if (totalTasks === 0 && habitTotal === 0) {
      return new Response(
        JSON.stringify({
          summary: "No task or habit activity in the last 7 days yet - once you log some, your weekly summary will appear here.",
          stats,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system:
        "You write a single short, encouraging productivity summary (2-3 sentences, no markdown, no bullet points) " +
        "from pre-computed stats. Only reference numbers given to you - never invent counts, dates, or task names.",
      messages: [
        {
          role: "user",
          content: `Stats for the last 7 days:\n${JSON.stringify(stats, null, 2)}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return new Response(
      JSON.stringify({ summary: textBlock?.text ?? "", stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("weekly-summary error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate summary" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
