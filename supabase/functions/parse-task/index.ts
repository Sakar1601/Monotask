// Deno Edge Function. Turns a free-text task description into structured
// fields matching the `tasks` table, for the "quick add with AI" flow.
//
// Guardrails:
// - Schema-constrained output via Anthropic structured outputs (a JSON
//   Schema on output_config.format) - Claude is constrained to this shape,
//   and every field is still re-validated below before use, so malformed
//   output surfaces as a clean 422/null-out instead of a corrupted task.
//   (Written as a raw JSON Schema rather than the SDK's zodOutputFormat
//   helper: that helper requires the "zod/v4" subpath internally, which hits
//   a dual-package-hazard module-resolution mismatch under Deno + esm.sh.)
// - The frontend never inserts the parsed result directly - it pre-fills the
//   existing TaskModal for the user to review/edit/confirm, same as manual entry.
// - tag_id is resolved server-side against the caller's own tags (never
//   trusted from the model), so a hallucinated tag name can't attach a task
//   to another user's tag.
// - check_and_increment_ai_usage enforces a daily call cap server-side.
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.122.0";
import { corsHeaders } from "../_shared/cors.ts";

const DAILY_LIMIT = 30;
const MODEL = "claude-haiku-4-5";
const MAX_INPUT_LENGTH = 500;

const PARSED_TASK_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short task title, required" },
    description: { type: ["string", "null"], description: "Extra detail beyond the title, or null" },
    due_date: {
      type: ["string", "null"],
      description: "ISO date YYYY-MM-DD resolved from any relative date in the text, or null if none was mentioned",
    },
    due_time: {
      type: ["string", "null"],
      description:
        '24-hour clock as HH:MM with a leading zero, e.g. "13:00" for 1pm or "09:30" for 9:30am - never am/pm notation. Null if no time was mentioned.',
    },
    priority: { type: "string", enum: ["low", "medium", "high"], description: "Defaults to medium if not stated" },
    tag_name: { type: ["string", "null"], description: "Best-matching tag name from the provided list, or null" },
    repeat_type: {
      type: "string",
      enum: ["none", "daily", "weekly", "monthly"],
      description: "Defaults to none if not stated",
    },
  },
  required: ["title", "description", "due_date", "due_time", "priority", "tag_name", "repeat_type"],
  additionalProperties: false,
};

interface ParsedTask {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: "low" | "medium" | "high";
  tag_name: string | null;
  repeat_type: "none" | "daily" | "weekly" | "monthly";
}

function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function isValidTime(value: string | null | undefined): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);
const VALID_REPEAT_TYPES = new Set(["none", "daily", "weekly", "monthly"]);

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

    const { text } = await req.json();
    if (typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const trimmedText = text.trim().slice(0, MAX_INPUT_LENGTH);

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
      { p_feature: "parse-task", p_daily_limit: DAILY_LIMIT },
    );
    if (rateLimitError) throw rateLimitError;
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: `Daily limit of ${DAILY_LIMIT} AI task parses reached. Try again tomorrow.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: tags, error: tagsError } = await supabase.from("tags").select("id, name");
    if (tagsError) throw tagsError;

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });
    const today = new Date().toISOString().split("T")[0];
    const tagNames = (tags ?? []).map((t) => t.name);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system:
        `Today's date is ${today}. Extract a single task from the user's text. ` +
        `Available tags: ${tagNames.length ? tagNames.join(", ") : "(none)"}. ` +
        `Only use tag_name if it clearly matches one of the available tags; otherwise use null. ` +
        `Never invent information that isn't stated or clearly implied in the text.`,
      messages: [{ role: "user", content: trimmedText }],
      output_config: { format: { type: "json_schema", schema: PARSED_TASK_JSON_SCHEMA } },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    let parsed: ParsedTask | null = null;
    try {
      const candidate = textBlock?.text ? JSON.parse(textBlock.text) : null;
      if (
        candidate &&
        typeof candidate.title === "string" &&
        VALID_PRIORITIES.has(candidate.priority) &&
        VALID_REPEAT_TYPES.has(candidate.repeat_type)
      ) {
        parsed = candidate;
      }
    } catch {
      parsed = null;
    }

    if (!parsed) {
      return new Response(JSON.stringify({ error: "Could not parse a task from that text. Try rephrasing." }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchedTag = parsed.tag_name
      ? (tags ?? []).find((t) => t.name.toLowerCase() === parsed!.tag_name!.toLowerCase())
      : null;

    const result = {
      title: parsed.title.slice(0, 200) || trimmedText.slice(0, 200),
      description: parsed.description ?? "",
      due_date: isValidIsoDate(parsed.due_date) ? parsed.due_date : null,
      due_time: isValidTime(parsed.due_time) ? parsed.due_time : null,
      priority: parsed.priority,
      tag_id: matchedTag?.id ?? null,
      repeat_type: parsed.repeat_type,
    };

    return new Response(JSON.stringify({ task: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("parse-task error:", error);
    return new Response(JSON.stringify({ error: "Failed to parse task" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
