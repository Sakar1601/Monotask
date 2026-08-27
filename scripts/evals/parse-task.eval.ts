// Regression eval for the parse-task Edge Function's prompt + schema.
// Run: npm run eval:parse-task
//
// Mirrors supabase/functions/parse-task/index.ts (schema, system prompt, and
// parsing approach) so a pass here is a real signal about production
// behavior. Duplicated rather than imported because the edge function runs
// on Deno with URL/npm imports - a shared module across runtimes isn't
// worth the complexity for ~40 lines of schema + prompt.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';
const TODAY = '2026-08-27'; // fixed reference date so due_date assertions are deterministic

const PARSED_TASK_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short task title, required' },
    description: { type: ['string', 'null'], description: 'Extra detail beyond the title, or null' },
    due_date: {
      type: ['string', 'null'],
      description: 'ISO date YYYY-MM-DD resolved from any relative date in the text, or null if none was mentioned',
    },
    due_time: {
      type: ['string', 'null'],
      description:
        '24-hour clock as HH:MM with a leading zero, e.g. "13:00" for 1pm or "09:30" for 9:30am - never am/pm notation. Null if no time was mentioned.',
    },
    priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Defaults to medium if not stated' },
    tag_name: { type: ['string', 'null'], description: 'Best-matching tag name from the provided list, or null' },
    repeat_type: {
      type: 'string',
      enum: ['none', 'daily', 'weekly', 'monthly'],
      description: 'Defaults to none if not stated',
    },
  },
  required: ['title', 'description', 'due_date', 'due_time', 'priority', 'tag_name', 'repeat_type'],
  additionalProperties: false,
};

interface ParsedTask {
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
  tag_name: string | null;
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly';
}

interface EvalCase {
  name: string;
  text: string;
  availableTags: string[];
  expect: (result: ParsedTask) => string | null; // null = pass, string = failure reason
}

const cases: EvalCase[] = [
  {
    name: 'basic title + relative date + time + priority',
    text: 'lunch with Sam tomorrow 1pm, high priority',
    availableTags: ['Work', 'Personal'],
    expect: (r) => {
      if (r.due_date !== '2026-08-28') return `expected due_date 2026-08-28, got ${r.due_date}`;
      if (r.due_time !== '13:00') return `expected due_time 13:00, got ${r.due_time}`;
      if (r.priority !== 'high') return `expected priority high, got ${r.priority}`;
      return null;
    },
  },
  {
    name: 'no date or time mentioned',
    text: 'buy groceries',
    availableTags: ['Work', 'Personal'],
    expect: (r) => {
      if (r.due_date !== null) return `expected due_date null, got ${r.due_date}`;
      if (r.due_time !== null) return `expected due_time null, got ${r.due_time}`;
      return null;
    },
  },
  {
    name: 'unambiguous relative date resolution',
    text: 'submit report in 10 days',
    availableTags: [],
    expect: (r) => {
      // 2026-08-27 + 10 days = 2026-09-06
      if (r.due_date !== '2026-09-06') return `expected due_date 2026-09-06, got ${r.due_date}`;
      return null;
    },
  },
  {
    name: 'tag matching against provided list only',
    text: 'gym session, tag it fitness',
    availableTags: ['Work', 'Personal'],
    expect: (r) => {
      // "fitness" is not in the available list - model must not invent a match
      if (r.tag_name !== null) return `expected tag_name null (no match in list), got ${r.tag_name}`;
      return null;
    },
  },
  {
    name: 'recurrence keyword',
    text: 'water the plants every day',
    availableTags: [],
    expect: (r) => {
      if (r.repeat_type !== 'daily') return `expected repeat_type daily, got ${r.repeat_type}`;
      return null;
    },
  },
  {
    name: 'default priority when unstated',
    text: 'read a book',
    availableTags: [],
    expect: (r) => {
      if (r.priority !== 'medium') return `expected default priority medium, got ${r.priority}`;
      return null;
    },
  },
];

async function runCase(client: Anthropic, testCase: EvalCase) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      `Today's date is ${TODAY}. Extract a single task from the user's text. ` +
      `Available tags: ${testCase.availableTags.length ? testCase.availableTags.join(', ') : '(none)'}. ` +
      `Only use tag_name if it clearly matches one of the available tags; otherwise use null. ` +
      `Never invent information that isn't stated or clearly implied in the text.`,
    messages: [{ role: 'user', content: testCase.text }],
    output_config: { format: { type: 'json_schema', schema: PARSED_TASK_JSON_SCHEMA } },
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  let parsed: ParsedTask | null = null;
  try {
    parsed = textBlock?.text ? JSON.parse(textBlock.text) : null;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return { pass: false, reason: 'model did not return valid JSON matching the schema' };
  }

  const failure = testCase.expect(parsed);
  return failure ? { pass: false, reason: failure } : { pass: true, reason: null };
}

async function main() {
  const client = new Anthropic();
  let passed = 0;

  for (const testCase of cases) {
    const { pass, reason } = await runCase(client, testCase);
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${testCase.name}${reason ? ` — ${reason}` : ''}`);
    if (pass) passed++;
  }

  console.log(`\n${passed}/${cases.length} passed`);
  if (passed !== cases.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
