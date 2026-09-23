# Monotask Public Launch Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use Codex Security's `security-scan`, `deep-security-scan`, `triage-finding`, `fix-finding`, and `verify-fix` workflows as appropriate. Use `superpowers:test-driven-development` for fixes and `superpowers:verification-before-completion` before closing each gate. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce evidence that Monotask is reasonably secure for a public launch, remediate validated repository vulnerabilities, automate regression detection, and document residual risk.

**Architecture:** Security work proceeds through gated phases: scope and threat model, standard scan, targeted manual review, deep scan, validated remediation, CI controls, deployment verification, and release sign-off. A finding is not considered real until its attack path and source evidence are validated; a fix is not considered complete until a regression test and focused re-scan pass.

**Tech Stack:** React 18, TypeScript, Vite, Supabase Auth/Postgres/RLS/Edge Functions, Deno, Google and Microsoft OAuth, Anthropic SDK, GitHub Actions, Vitest, Playwright, Codex Security

**Spec:** Security baseline defined by this plan, OWASP ASVS Level 2 control intent, and repository-specific threat model produced in Task 1.

## Global Constraints

- Never print, commit, copy into reports, or send to scan context values from `.env`, `supabase/functions/.env`, Supabase Vault, CI secrets, OAuth tokens, or production credentials.
- Scan and test only the Monotask repository and environments explicitly authorized by the owner.
- Keep security assessment read-only until a finding has been validated and remediation is approved.
- Do not test production with destructive payloads, denial-of-service techniques, real-user impersonation, or provider-account abuse.
- Treat browser code and the Supabase anon key as public; authorization must be enforced by Edge Functions and Postgres RLS.
- Treat every service-role operation as privileged and require an authenticated, narrowly scoped call path.
- Block launch on any unresolved validated Critical or High vulnerability.
- Track Medium and Low findings with an owner, disposition, and target date; explicitly document accepted risk.
- Every security fix requires a regression test plus the existing lint, unit, build, and relevant end-to-end checks.

---

### Task 1: Establish scope, data classification, and threat model

**Files:**
- Create: `docs/security/THREAT_MODEL.md`
- Create: `SECURITY.md`
- Review: `docs/superpowers/specs/2026-09-10-external-integrations-design.md`
- Review: `docs/superpowers/specs/2026-09-10-two-way-sync-and-events-design.md`
- Review: `docs/superpowers/specs/2026-09-13-ai-subsystem-design.md`

**Produces:** Trust boundaries, assets, threat actors, entry points, security assumptions, disclosure policy, supported versions, and launch-blocking severity policy.

- [ ] Inventory user data, OAuth tokens, AI inputs/outputs, secrets, scheduled jobs, public endpoints, and third-party processors without recording secret values.
- [ ] Diagram trust boundaries among the browser, Supabase Auth, Postgres/RLS, Edge Functions, cron jobs, Google, Microsoft, and Anthropic.
- [ ] Define attacker profiles: anonymous internet user, authenticated malicious user, compromised OAuth account, leaked browser token, malicious message/calendar content, and compromised dependency.
- [ ] Define abuse cases: cross-tenant access, RLS bypass, service-role misuse, OAuth state replay, redirect manipulation, webhook/cron spoofing, prompt injection, stored XSS, resource exhaustion, and sensitive logging.
- [ ] Write `docs/security/THREAT_MODEL.md` with the inventory, trust boundaries, attack surfaces, mitigations, and open assumptions.
- [ ] Write `SECURITY.md` with private reporting instructions, response targets, supported versions, and safe-harbor language appropriate for the project.
- [ ] Review both documents with the owner and freeze them as scan context for the remaining tasks.

**Gate:** Every public and privileged entry point has an owner, authentication model, authorization rule, and data classification.

### Task 2: Run the standard Codex Security repository scan

**Files:**
- Read: entire tracked repository, honoring ignore rules
- Output: Codex Security workbench scan artifacts

**Produces:** Initial source-backed findings, coverage record, and repository-specific scan threat model.

- [ ] Confirm `.env` and `supabase/functions/.env` remain ignored and untracked without reading their contents.
- [ ] Run the Codex Security standard read-only scan against the entire repository using the approved threat-model context.
- [ ] Review scan coverage for frontend routes, hooks, Supabase functions, shared integration clients, configuration, and every migration.
- [ ] Triage every reported issue as validated, rejected with evidence, or needing targeted validation.
- [ ] Record root cause, reachable attack path, affected users/data, severity, confidence, and remediation boundary for each validated finding.

**Gate:** All standard-scan findings are triaged; no unresolved ambiguous Critical or High candidate remains.

### Task 3: Perform targeted authorization and data-isolation testing

**Files:**
- Review: `supabase/config.toml`
- Review: `supabase/functions/**/*.ts`
- Review: `supabase/migrations/*.sql`
- Create or modify: focused authorization tests selected after endpoint inventory

**Produces:** Evidence for authentication, RLS, tenant isolation, privileged-function, and scheduled-job controls.

- [ ] Build an endpoint matrix listing platform JWT status, in-function authentication, allowed caller, privileged credentials, rate limit, and expected failure response.
- [ ] Verify every function with `verify_jwt = false` rejects unauthenticated or incorrectly authenticated calls except the OAuth callback, whose state validation must be single-use, expiring, and provider-bound.
- [ ] Create two test users and verify user A cannot select, insert, update, delete, invoke, or infer user B's tasks, events, habits, tags, integrations, suggestions, or usage records.
- [ ] Review every `SECURITY DEFINER` function for a fixed `search_path`, explicit authorization, minimal grants, safe parameter handling, and no unintended public execution.
- [ ] Trace every service-role operation from entry point to database mutation and prove the requested `user_id` cannot be chosen or altered by an untrusted caller.
- [ ] Verify cron-triggered functions require an unforgeable credential and cannot be invoked anonymously to create cost or data-access abuse.
- [ ] Verify error responses and logs do not disclose tokens, provider payloads, message contents, SQL details, or internal credentials.

**Gate:** Cross-user and unauthenticated negative tests pass for every security-sensitive resource and function.

### Task 4: Test OAuth and external integration security

**Files:**
- Review: `supabase/functions/integration-oauth-start/index.ts`
- Review: `supabase/functions/integration-oauth-callback/index.ts`
- Review: `supabase/functions/_shared/integrations/*.ts`
- Review: `supabase/functions/sync-integrations/index.ts`
- Review: `supabase/functions/push-integration-change/index.ts`

**Produces:** OAuth flow evidence for Google and Microsoft plus integration-token lifecycle verification.

- [ ] Verify OAuth state is cryptographically random, expires promptly, is consumed atomically once, and is bound to user, provider, and expected redirect.
- [ ] Verify callback error and success redirects use an explicit allowlist and cannot be converted into an open redirect.
- [ ] Verify minimum provider scopes and document why each requested scope is required.
- [ ] Verify access and refresh tokens never reach browser-readable tables, browser logs, analytics, URLs, or error messages.
- [ ] Verify token refresh handles replay, revoked consent, provider errors, and concurrent refresh without corrupting credentials.
- [ ] Verify disconnect revokes provider access when supported and removes or cryptographically destroys stored credentials.
- [ ] Test malicious calendar, task, email, and message fields for stored XSS, oversized input, malformed Unicode, and prompt-injection propagation.

**Gate:** Google and Microsoft connect, refresh, sync, disconnect, and failure paths preserve account binding and token confidentiality.

### Task 5: Test AI subsystem abuse and privacy boundaries

**Files:**
- Review: `supabase/functions/parse-task/index.ts`
- Review: `supabase/functions/scan-messages/index.ts`
- Review: `supabase/functions/weekly-summary/index.ts`
- Review: `supabase/functions/detect-conflicts/index.ts`
- Review: `supabase/migrations/20260827120000_ai-usage-rate-limit.sql`
- Review: `supabase/migrations/20260914120000_ai-suggestions-and-scan-infra.sql`

**Produces:** Evidence that untrusted content cannot obtain authority, leak data, or generate unbounded cost.

- [ ] Separate system instructions, trusted application context, and untrusted user/provider content in every model call.
- [ ] Verify model output is schema-validated and cannot directly perform privileged actions or select another user's identifiers.
- [ ] Test prompt injection embedded in tasks, calendar events, emails, and messages; confirm it cannot expose prompts, secrets, other-user content, or invoke unintended operations.
- [ ] Verify daily and per-request limits are enforced atomically and cannot be bypassed by concurrency or direct function calls.
- [ ] Verify input-size, output-size, timeout, retry, and concurrency limits prevent cost amplification.
- [ ] Verify sensitive content retention, deletion, logging, and third-party transmission match the public privacy disclosure.

**Gate:** AI features remain advisory, tenant-scoped, schema-constrained, rate-limited, and unable to exercise ambient authority.

### Task 6: Run the Codex Security deep scan

**Files:**
- Read: entire tracked repository
- Output: Codex Security deep-scan artifacts

**Produces:** Multi-pass attack-path findings informed by Tasks 1–5.

- [ ] Run a deep scan using the frozen threat model and focus context from the endpoint, OAuth, data, and AI reviews.
- [ ] Require source-backed reachability and validation evidence for every proposed finding.
- [ ] Correlate duplicate findings by root cause rather than counting symptoms separately.
- [ ] Triage all new findings and update the remediation backlog.
- [ ] Compare deep-scan coverage with the standard scan and document any unreviewed paths.

**Gate:** Deep-scan findings are fully triaged and coverage gaps have an explicit disposition.

### Task 7: Remediate validated findings with regression evidence

**Files:**
- Modify: exact files identified by validated findings
- Test: colocated Vitest, SQL/RLS, Deno, or Playwright regression tests appropriate to each finding

**Produces:** Minimal reviewed patches and proof that each root cause is fixed.

- [ ] Order work by Critical, High, Medium, then Low severity, considering exploitability and blast radius.
- [ ] For each finding, write a failing regression test or reproducible safe validation before changing implementation.
- [ ] Apply the smallest fix at the responsible trust boundary.
- [ ] Run the focused test and confirm it passes.
- [ ] Run `npm test`, `npm run lint`, `npm run build`, and the relevant Playwright tests.
- [ ] Run the Codex Security fix-verification workflow against the immutable patch.
- [ ] Re-run the focused attack path and record the result without including secrets or real-user data.
- [ ] Commit each independently reviewable fix with its finding identifier and test evidence.

**Gate:** No validated Critical or High remains; every closed finding has regression and re-scan evidence.

### Task 8: Add continuous security checks to GitHub Actions

**Files:**
- Create: `.github/workflows/security.yml`
- Create: `.github/workflows/codex-security.yml`
- Modify: `package.json` only if a repository-local security script is justified

**Produces:** Reproducible PR security checks with least-privilege permissions and retained artifacts.

- [ ] Add dependency review, secret scanning, static analysis, and existing test/build jobs with pinned action revisions and minimum permissions.
- [ ] Add Codex Security PR-diff scanning in advisory mode using a CI secret mapped only to the scan process.
- [ ] Exclude forked and untrusted pull requests from any job that can access credentials.
- [ ] Store Codex Security output as a restricted artifact and upload SARIF only when repository settings support it.
- [ ] Measure scan quality and runtime across representative pull requests.
- [ ] Change the policy to block validated Critical and High findings after the advisory calibration period.
- [ ] Protect `main` so required security, test, lint, and build checks must pass before merge.

**Gate:** A deliberately introduced safe test finding is detected, a fork cannot access scan credentials, and required checks block merge.

### Task 9: Verify production configuration and operational readiness

**Files:**
- Create: `docs/security/LAUNCH_CHECKLIST.md`
- Create: `docs/security/INCIDENT_RESPONSE.md`
- Modify: deployment configuration selected by the owner; never commit secret values

**Produces:** Deployment evidence, incident procedure, and rollback-ready launch checklist.

- [ ] Replace localhost-only production site and OAuth redirect configuration with exact HTTPS production origins while retaining local values only in local configuration.
- [ ] Restrict CORS to approved production and development origins where browser access is required.
- [ ] Verify CSP, HSTS, MIME-sniffing protection, referrer policy, frame protection, secure cookies, and TLS behavior at the deployed URL.
- [ ] Verify production Supabase Auth redirect allowlists, provider callbacks, CAPTCHA or abuse controls, email settings, and password/session policies.
- [ ] Verify secret-manager inventory, access ownership, rotation procedure, and separation between development and production.
- [ ] Verify database backups by performing a documented restore test into an isolated environment.
- [ ] Configure alerts for authentication spikes, repeated authorization failures, Edge Function failures, AI-cost anomalies, and integration-refresh failures.
- [ ] Write incident roles, containment steps, credential-rotation order, user-notification decision path, evidence preservation, and rollback procedure.

**Gate:** The deployed production configuration passes the launch checklist and one tabletop incident exercise.

### Task 10: Independent assessment and release sign-off

**Files:**
- Create: `docs/security/RELEASE_RISK_REGISTER.md`
- Create: `docs/security/SECURITY_TEST_REPORT.md`

**Produces:** Final evidence index, residual-risk register, and explicit launch decision.

- [ ] Give an independent penetration tester the frozen threat model, staging environment, test accounts, scope, and rules of engagement.
- [ ] Triage and remediate external findings through the same validation and regression workflow.
- [ ] Re-run standard Codex Security, all automated checks, authorization tests, OAuth tests, AI-abuse tests, and deployment checks against the release candidate.
- [ ] Write the final report with scope, commit SHA, environment, coverage, validated findings, fixed findings, rejected findings with evidence, residual risks, and test commands/results.
- [ ] Record an owner and deadline for every accepted Medium or Low risk.
- [ ] Obtain explicit owner sign-off that no Critical or High finding remains and documented residual risk is acceptable.

**Gate:** Signed release decision tied to an immutable commit and deployment configuration.

## Execution Order

Tasks 1–2 establish the baseline. Tasks 3–5 are targeted reviews that may run independently after Task 1. Task 6 consumes their context. Task 7 remediates the combined backlog. Tasks 8–9 establish continuous and operational controls. Task 10 is the final independent release gate.

## Responsibility Boundary

Codex can inspect repository code, create security documents and tests, run authorized local scans, validate findings, implement approved fixes, verify regressions, and prepare CI workflows. The project owner must authorize access to staging or production, configure hosted secrets and branch protection, approve provider-console changes, decide risk acceptance, and engage an independent penetration tester. Codex will not claim certification, legal compliance, or that automated testing proves the absence of vulnerabilities.
