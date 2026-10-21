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
- **Installable app (PWA)** - add it to your home screen from Settings; opens in its own window, with a bottom tab bar on phones and the sidebar on larger screens
- **Push reminders** - tasks at their due time, events 15 minutes before they start, and habits at their preferred time, delivered even when the app is closed
- **Dark/light theme**, and **guest access** with later account upgrade

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State management | TanStack Query |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions, pg_cron) |
| PWA | vite-plugin-pwa (Workbox), Web Push (VAPID) |
| AI | Claude (Anthropic API), structured outputs |
| Testing | Vitest (unit), Playwright (E2E) |
| CI/CD | GitHub Actions + Vercel |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design, database schema, auth flow, the component/hook reference, and how the AI and sync features work internally. See [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) and [SECURITY.md](SECURITY.md) for the security model and reporting a vulnerability.

## Getting started

1. Clone the repository and run `npm install`
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, and (for push reminders) `VITE_VAPID_PUBLIC_KEY`
3. Enable Anonymous sign-ins in your Supabase project's Auth settings
4. `npm run dev`

The AI features (Quick Add, Weekly Summary) require the two Edge Functions
(`supabase/functions/parse-task`, `supabase/functions/weekly-summary`) deployed with an
`ANTHROPIC_API_KEY` secret set on the Supabase project - everything else runs without it.

The PWA install button and push notifications only work over HTTPS (or `localhost`). Test
them against `npm run build && npm run preview` or a Vercel preview deployment - the dev
server does not register the service worker.

To try the app pre-populated with data instead of starting from an empty account, run
`npm run seed:demo` (requires the Supabase `service_role` key - never committed).

## Deploying to a new environment

Each Supabase environment (a fresh project, or reusing these migrations elsewhere) needs setup
beyond `supabase db push`, since none of this can live in source control:

1. **Edge Function secrets** (`supabase secrets set`): `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
   `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET`, `APP_ORIGIN` (your deployed app's exact HTTPS origin),
   `OAUTH_CALLBACK_URL` (`<SUPABASE_URL>/functions/v1/integration-oauth-callback`).
2. **Two Vault secrets**, run once via the SQL editor or `supabase db query --file` - the scheduled
   sync/scan/conflict-detection cron jobs read these at call time rather than having any
   environment-specific value committed to a migration:
   ```sql
   select vault.create_secret('<service-role-key>', 'service_role_key');
   select vault.create_secret('https://<your-project-ref>.supabase.co', 'functions_base_url');
   ```
3. Enable **Anonymous sign-ins** in Supabase Auth settings (guest access).
4. Register `<SUPABASE_URL>/functions/v1/integration-oauth-callback` as an authorized redirect URI
   in both the Google Cloud Console and Azure App registration for the OAuth client IDs above.
5. **Push reminders** (see [below](#push-reminders-setup)).

### Push reminders setup

Reminders are sent by the `send-reminders` Edge Function, which pg_cron calls every 5 minutes
(scheduled by the `push-notifications` migration, using the same two Vault secrets as step 2).

1. Generate a VAPID key pair: `npx web-push generate-vapid-keys`
2. Set the Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
   (a `mailto:` or `https:` contact URL). Keep the private key out of source control.
3. Set `VITE_VAPID_PUBLIC_KEY` (the **public** key) as a build-time env var in Vercel (all
   environments) and as a GitHub Actions secret, since CI builds with it.
4. Run `supabase db push`, then deploy the function: `supabase functions deploy send-reminders`.
   If you deploy from the Supabase dashboard editor instead, it cannot import `../_shared`, so
   inline those helpers into a single file, and turn **Verify JWT** off for the function (the
   function authenticates the cron call itself; `config.toml` only applies to CLI deploys).

Notes: iOS only delivers push to apps added to the Home Screen (iOS 16.4+). Recurring tasks,
date-only tasks, and monthly habits (or weekly habits with no chosen days) do not get reminders.

## Testing

```bash
npm test          # unit tests (Vitest), including reminder timing logic
npm run test:e2e  # end-to-end smoke tests (Playwright): desktop golden path + phone navigation
npm run lint
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, build, and the E2E test on
every push/PR to `main`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#testing--cicd) for details.
