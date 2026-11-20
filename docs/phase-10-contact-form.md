# Verde Kitchen — phase 10: contact form → LeadTriage (brief for Claude Code)

Phases 1–8 are done or planned in `C:\Users\woodb\.claude\plans\humming-baking-mitten.md` (phase 8: E2E, Storybook,
Ukrainian version, security, GitHub Pages, Oracle Cloud in 8.6). This brief adds **phase 10** (phase 9 became "Where to buy" and the shopping list): a contact form whose
messages go to **LeadTriage**, the user's new n8n + FastAPI + Claude + Airtable project
(`F:\PROJECTS\LeadTriage`, public repo `IvanKhamar/LeadTriage`, its own brief and Claude Code session).

Goal for the portfolio: one invented brand, two projects that work together — "a message from the Drupal site is
sorted by AI and lands in the manager's Airtable within seconds". It shows Drupal back-end skills (Form API, Queue API,
services, settings) next to the front-end work already in this repo.

Work as in phase 8: first a plan (`docs/plan` or the plans folder, as before), wait for the user's OK, then sub-phases
in auto mode, each a branch + PR merged after green CI, following `F:\PROJECTS\CLAUDE.md`, this repo's README,
`SECURITY.md`, `.gitleaks.toml` and the conventions already used here (Drupal coding standards, SDC, strict CSP,
`.po` translations, Playwright, Lighthouse/axe, gitleaks hook). Committed as `docs/phase-10-contact-form.md`.

## 1. Dependencies and order

- LeadTriage must reach its phase 3 (intake API + n8n in mock mode) before the end-to-end check here.
  Everything else in this brief can be built and tested earlier: tests mock the HTTP call.
- The live part (10.5) needs phase 8.6 (Oracle) done. If 8.6 is not done yet, finish 10.1–10.4 and leave 10.5 for later.

## 2. Lead intake contract v1 (copy from the LeadTriage brief — keep both identical)

Drupal is a server-to-server source and uses:

`POST {VERDE_LEADS_URL}/api/sources/verde-kitchen/leads`, header `X-Source-Token: {token}`, JSON body:

```json
{
  "externalId": "verde-kitchen:contact:123",
  "name": "Olena Test",
  "email": "olena@example.com",
  "phone": "+380501234567",
  "message": "Do you deliver to Lviv? We run a small cafe and want to order wholesale.",
  "consent": true,
  "locale": "uk",
  "pageUrl": "https://verde.ddev.site/uk/contact",
  "submittedAt": "2026-11-21T10:15:00+02:00"
}
```

- `externalId` is unique per message; sending it again is idempotent (`200 {"status":"duplicate"}`), so retries are
  safe.
- Limits: `name` 2–100, `email` valid, `phone` optional, `message` 10–2000, `consent` true, `locale` `uk`/`en`,
  `submittedAt` ISO 8601 with zone.
- Answers: `202 received` and `200 duplicate` → sent; `400` → will never succeed (log field names only, mark failed);
  `401` → wrong token, keep in queue and warn the admin; `413`/`429`/`503`/timeout/network error → retry later.

## 3. What to build: custom module `verde_leads`

### 3.1 The form

- Route `/contact` (and `/uk/contact`), menu link "Contact" / "Контакти" in the main or footer menu, both languages.
- Form API form: name, email, phone (optional), message, consent checkbox with a short privacy text and a link to a
  privacy page (create a simple "Privacy" page in both languages: what is collected, that it goes to an AI service
  and a spreadsheet tool for sorting, how long it is kept, how to ask for deletion; invented company details).
- Built-in protection: Form API CSRF token, server-side validation matching the contract limits, a honeypot field
  (filled → show the normal success message, store nothing), flood control with the core Flood service (e.g. 5
  submissions per hour per IP, then a friendly message).
- Markup through the theme: an SDC component (or theme templates) in the `verde` design system, a Storybook story for
  it, visible labels, error messages linked to fields (`aria-describedby`), focus moved to the error summary or the
  success message. **No inline JS or CSS** (the CSP is strict): any script goes in a library file.
- All strings translatable: `t()` / `|t`, Ukrainian in the theme or module `.po` file, as in phase 8.3.

### 3.2 Save first, send later

- Every valid message is saved in Drupal first: a small table or content entity `verde_lead` with id, uuid, the
  fields, locale, page URL, created time, `status` (`pending` / `sent` / `duplicate` / `failed` / `not_forwarded`),
  attempts, last error code (no message text in errors), sent time.
- Then a Queue API item is created; a `QueueWorker` plugin (cron, plus `drush queue:run verde_leads_forward`) posts
  the message to LeadTriage with Drupal's `http_client` (Guzzle), with a timeout.
- Answer handling as in section 2. Retry with a growing wait (requeue with a "not before" time or a
  `SuspendQueueException` when the service is down), at most N attempts (e.g. 8 over a day), then `failed`.
- The visitor always gets the success message once the message is saved; forwarding is invisible to them.
- `externalId` = `verde-kitchen:contact:{id}`.

### 3.3 Settings and secrets

- `VERDE_LEADS_URL` and the source token are read in `settings.php` from environment variables
  (e.g. `$settings['verde_leads_url'] = getenv('VERDE_LEADS_URL') ?: '';` and the same for `VERDE_LEADS_TOKEN`).
- **The token is never in configuration**: nothing in `config/sync`, no config form field for it (config is exported
  to the public repo). gitleaks rule for the token pattern in `.gitleaks.toml`.
- Local values come from the git-ignored `.ddev/.env` or `settings.local.php` (check that both are ignored; add a
  `.env.example`-style note in the README). On Oracle they go into the server `.env` of phase 8.6.
- No URL set (CI, GitHub Pages, people who clone the repo) → forwarding is off, messages are saved with
  `not_forwarded`, and the site works normally.

### 3.4 Admin

- Permission "View contact messages"; admin page (Claro) listing messages with status, attempts, created time; a
  "Retry" action for failed ones. Not visible to anonymous users (test it).
- Retention: cron deletes messages older than `verde_leads.retention_days` (default 30). Real visitors will write
  once the site is live, so personal data is not kept forever.
- Logging: watchdog/syslog entries with message id, status and HTTP code only; no names, e-mails, phone numbers or
  message text in logs.

### 3.5 Static copy (GitHub Pages)

With `VERDE_STATIC_EXPORT=1` the contact page shows a short notice instead of the form ("The form works on the full
site" + link to the Oracle URL from phase 8.6), in both languages. `scripts/static/check.mjs` must still pass, and
gitleaks scans the export as before.

## 4. Sub-phases

| Sub-phase | What                                                                                                     | From the user                                                  |
| --------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 10.1      | Module skeleton, storage, settings from env, privacy page, plan                                          | nothing                                                        |
| 10.2      | The form: SDC/templates, validation, honeypot, flood, translations, Storybook story                      | nothing                                                        |
| 10.3      | Queue worker, answer handling, retries, admin page, retention                                            | nothing                                                        |
| 10.4      | Local end to end with LeadTriage (DDEV → LeadTriage API), static-export notice                           | start LeadTriage, put the token in `.ddev/.env` (step by step) |
| 10.5      | Live on Oracle: env vars on the server, shared Docker network with LeadTriage, check with a real message | only if 8.6 is live; steps in Ukrainian                        |

For 10.4: find and document the simplest working way for the DDEV web container to reach the LeadTriage API on the
same machine (for example `host.docker.internal`, or attaching DDEV to a shared external Docker network with a
`.ddev/docker-compose.*.yaml`), and check it with a real request. For 10.5 the LeadTriage brief proposes a shared
external network (e.g. `verde-leads`) on the VM, so LeadTriage publishes no ports at all.

## 5. Tests

- PHPUnit kernel tests for the queue worker with a mocked HTTP client: 202 → sent, 200 duplicate → duplicate,
  400 → failed without retry, 401 → stays queued + warning, 503/timeout → retried, max attempts → failed;
  no URL → not_forwarded; payload matches the contract. If PHPUnit is not set up in this repo yet, add it to CI.
- Playwright (`contact.spec.js`): required fields and error messages, email format, consent, honeypot, success
  message and focus, Ukrainian version, the flood message, static-export notice, admin page closed to anonymous users.
- Security regression: a message with `<script>` is shown as text on the admin page; CSP headers present on
  `/contact`; no inline script on the page.
- Lighthouse and axe on `/contact` and `/uk/contact`: same thresholds as the other pages (≥ 90, 0 serious issues).
- Before each push: all CI steps locally, each exit code checked; gitleaks on staged changes and history.

## 6. Documentation

- README: "Contact form and LeadTriage" section with a short diagram, how to turn forwarding on locally, link to the
  LeadTriage repo; update the feature list and screenshots.
- `docs/ARCHITECTURE.md`: the save-then-queue design and why (no message is lost when LeadTriage is down).
- `docs/LEARNING.md`: Form API, Queue API, services and dependency injection, `settings.php` vs config, privacy;
  5–6 new interview questions with short answers.
- `docs/DEPLOYMENT.md` (from 8.6): the two env vars and the shared network.

## 7. Working with the user

- He must be able to explain the module in an interview: explain each Drupal back-end concept in 1–2 sentences,
  mapped to what he knows (PHP/OpenCart, C#/.NET, FastAPI).
- Never ask him to paste a token into the chat; tell him which file to put it in and how to check it worked.

## 8. Done means

- `/contact` and `/uk/contact` work in DDEV; messages are saved and, with LeadTriage running, appear in Airtable
  classified within seconds; with LeadTriage stopped they wait in the queue and go through after it starts again.
- Without any env vars the site, CI and the static copy work as before.
- No token or personal data in config, code, logs, commits or the static export; CI and gitleaks green.
- After 10.5: the same on the live Oracle site.
