# Monotask

> A minimal, monochrome productivity app combining tasks, a calendar, habits, and analytics - with AI-assisted task capture and weekly summaries via Claude.

## Features

- **Task Management** - due dates, priorities, tags, and recurring (daily/weekly/monthly) schedules that expand into real per-day occurrences
- **AI Quick Add** - type a task in plain English and Claude fills in the structured fields for you to review
- **AI Weekly Summary** - on-demand recap of the week's task and habit activity
- **Habit Tracking** - daily/weekly/monthly habits with completion, skip, and miss states
- **Calendar** - month/week/agenda views, recurring-task-aware
- **Progress & Analytics** - weekly completion charts, category breakdown, activity heatmap
- **Two-way calendar sync** - Google Calendar and Microsoft Outlook, with conflict detection
- **Tags** - color-coded organization shared across tasks and habits
- **Data export/import** - PDF, CSV, and a round-trippable JSON format
- **Dark/light theme**, and **guest access** with later account upgrade

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State management | TanStack Query |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| AI | Claude (Anthropic API), structured outputs |
| Testing | Vitest (unit), Playwright (E2E) |
| CI/CD | GitHub Actions + Vercel |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design, database schema, auth flow, the component/hook reference, and how the AI and sync features work internally. See [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) and [SECURITY.md](SECURITY.md) for the security model and reporting a vulnerability.

## Getting started

1. Clone the repository and run `npm install`
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
3. Enable Anonymous sign-ins in your Supabase project's Auth settings
4. `npm run dev`

The AI features (Quick Add, Weekly Summary) require the two Edge Functions
(`supabase/functions/parse-task`, `supabase/functions/weekly-summary`) deployed with an
`ANTHROPIC_API_KEY` secret set on the Supabase project - everything else runs without it.

To try the app pre-populated with data instead of starting from an empty account, run
`npm run seed:demo` (requires the Supabase `service_role` key - never committed).

## Testing

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end smoke test (Playwright)
npm run lint
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, build, and the E2E test on
every push/PR to `main`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#testing--cicd) for details.
