# Security Policy

## Supported version

Security fixes are applied to the current `main` branch. Older commits and
unreleased branches are not supported independently.

## Reporting a vulnerability

Please use GitHub's private vulnerability-reporting feature for this
repository. Do not open a public issue containing exploit details, secrets,
personal data, OAuth tokens, or information that could identify another user.

Include:

- the affected component and commit;
- prerequisites and a minimal, non-destructive reproduction;
- the expected and observed security boundary;
- the likely impact; and
- a suggested mitigation, if known.

Do not access data belonging to other users, degrade service, test production
with destructive payloads, or retain data encountered accidentally. Stop and
report immediately if testing crosses an authorization boundary.

## Response targets

We aim to acknowledge reports within three business days, complete initial
triage within seven business days, and provide a remediation plan for validated
Critical or High issues within fourteen days. These are operational targets,
not guarantees.

## Disclosure

Please allow a reasonable remediation period before public disclosure. We will
coordinate disclosure timing, credit, and a concise description of the fix with
the reporter. Good-faith research that follows this policy will not be pursued
by the project solely because it identified and responsibly reported a flaw.

## Security expectations

- Secrets and provider tokens must remain server-side and out of source control.
- Browser code and the Supabase publishable key are treated as public.
- Postgres RLS enforces tenant isolation for browser-originated data access.
- Code using the Supabase service role must authenticate its caller and enforce
  tenant ownership or be an explicitly authenticated system-wide job.
- OAuth state is single-use, time-bounded, and bound to the initiating user and
  intended provider flow.
- AI output is untrusted, schema-validated, advisory, and unable to exercise
  privileged authority without an independently authorized application action.

