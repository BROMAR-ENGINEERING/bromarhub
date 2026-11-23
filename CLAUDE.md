# CLAUDE.md — Bromar Hub

Guide for Claude (and humans) working in this repo. Read this before changing anything.

## 1. What this app is

**Bromar Hub** is the employee job-management web app for **Bromar Electrical Services**.
Staff use it for timesheets, daily job sheets / service reports, purchase orders, SWMS,
safety forms, rosters and electrical tools. It also hosts a **client portal** (currently
Tyrecycle Somerton) for compliance reports.

- **Hosting:** Netlify — `https://bromarhub.netlify.app`. Static site published from repo root (`publish = "."`), serverless functions in `netlify/functions/` (`netlify.toml`).
- **Backend:** Supabase project `iwtvlpfprxqwveqadlwl` (Postgres + Auth + Storage + RPCs).
- **Email:** Resend (most functions). SendGrid is still used by `send-roster-change-email.js`. EmailJS is used directly from a few pages.
- **Frontend:** plain HTML/CSS/JS, no build step, no framework. Supabase JS v2 loaded from CDN. PDFs made in the browser with jsPDF / html2canvas.
- **PWA:** `manifest.json` + `sw.js` (offline cache + `push` event handler).

> Note: `README.md` and `docs/timesheet-submission.me` are out of date (mention SendGrid and a `js/auth.js` path that no longer exists).

## 2. Pages / modules

Legend: **R** = read, **W** = insert/update/upsert, **D** = delete. "fn" = Netlify function. "RPC" = Postgres function via `sb.rpc()`.

### Home / account
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `index.html` | Login + staff dashboard (tiles, tasks, your schedule, work-in-progress, push opt-in). Redirects client users to their portal. | `employees` R, `tasks` R/W (acknowledge/close), `schedule_assignments` R, `work_in_progress` R/D, `push_subscriptions` R/D (+ W via `tools/push-subscribe.js`) | — |
| `reset-password.html` | Password reset via Supabase Auth link | Auth only | — |
| `employee-resources/change-password.html` | Change password (`auth.updateUser`) | Auth only | — |
| `employee-resources/settings.html` | User settings, push notification toggle | `employees` R, `push_subscriptions` R/D | — |

### Job management (`job-management/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `timesheet-submission.html` | Weekly timesheet. Loads Claude drafts, can pull hours from the week's job sheets, shows TIL balance. | `employees` R, `job_sheets` R, `job_number_register` R, `public_holidays` R, `til_ledger` R, `timesheet_drafts` R | fn `submit-timesheet` (via `/api/submit-timesheet` redirect) |
| `jobsheet-submission.html` | Daily job sheet / service report. Pick or create a job, labour, materials, photos, scans, client sign-off (on-site or by emailed link). Autosave + Claude drafts. | `job_number_register` R/W, `job_number_counters` R, `job_sheet_counters` R, `job_sheets` R/W, `job_sheet_files` R/W, `job_sheet_drafts` R/W/D, `job_types` R, `job_type_fields` R, `clients` R, `client_sites` R, `site_contacts` R. Storage `job-sheet-files`. RPC `create_new_job`, `register_existing_job`, `create_job_sheet`, `generate_signing_token` | fn `submit-jobsheet`, fn `send-signing-link` |
| `sign-report.html` | Public page a client opens from the signing link (no login). | RPC `get_report_by_token`, `get_report_files_by_token`, `submit_signature_by_token`. Storage `job-sheet-files` | fn `submit-jobsheet` |
| `job-manager.html` + `js/job-manager-core.js`, `js/job-manager-boot.js`, `js/tabs/jm-*.js` | Per-job dashboard with tabs: Overview, Job Sheets, Labour, Materials, Purchase Orders, Notes, Documents, Photos, SWMS, Safety Files, Testing, Cabling. | `employees` R, `job_number_register` R, `job_sheets` R, `purchase_orders` R, `purchase_order_items` R, `job_sheet_files` R, `swms_instances` R/W, `swms_templates` R, `swms_signatures` R/W, `swms_access_log` W, `job_notes` R/W, `cable_selections` R, `testing_*` tables R. Storage `job-sheet-files`, `swms-completed` | — |
| `purchase-order.html` | Create a PO against a job. | `job_number_register` R, `purchase_orders` W, `purchase_order_items` W, `suppliers` R, `supplier_branches` R/W, `user_supplier_preferences` R. RPC `next_po_sequence`, `record_supplier_branch_use` | — |
| `daily-service-report.html` | Older stand-alone service report (no Supabase; mailto). | — | — |

### Safety (`safety/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `swms-builder.html` + `js/*` | Build SWMS templates and job SWMS instances; sign-on. Shared logic in `tools/swms-shared.js`. | `swms_templates` R/W, `swms_instances` R/W, `swms_signatures` R, `swms_access_log` W, `swms_pdf_snapshots` W, `employees` R, `job_number_register` R. Storage `swms-completed` | — |
| `hazard-report.html` | Hazard report with photos + PDF. | `hazard_reports` W, `safety_committee` R. Storage `safety` | fn `submit-hazard-report` |
| `incident-report.html` | Incident report + PDF. | `incident_reports` W. Storage `incident-attachments` | fn `submit-incident-report` (**missing — see §7**) |
| `ppe-uniform-request.html` | PPE / uniform order. | (via function) | fn `submit-uniform-request` |
| `toolbox-talks.html` | Toolbox discussion point. | — | EmailJS |

### Employee resources (`employee-resources/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `leave-request.html` | Leave request | (via function) | fn `submit-leave-request` |
| `expense-claim.html` | Expense claim | `expense_claims` W, `job_number_register` R | — |
| `employee-change-details.html` | Change of personal details | — | **Supabase Edge Function** `submit-change-of-details` (not in this repo) |
| `suggestions-feedback.html` | Feedback / bug report | (via function) | fn `submit-feedback` |
| `eba.html` | EBA document viewer (PDF in same folder) | — | — |

### Schedules (`schedules/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `your-schedule.html` | Logged-in user's assignments | `employees` R, `schedule_assignments` R | — |
| `callout-roster.html` | Call-out roster calendar | `callout_roster` R (REST fetch) | — |
| `callout-roster-change.html` | Request a roster swap | `callout_roster` R, `callout_roster_changes` W | fn `send-roster-change-email` |
| `rdo-roster.html` | RDO calendar | `rdo_roster` R (REST fetch) | — |
| `etu-rdo-calendar.html` | ETU RDO calendar (static, plus `etu-calendar.ics`) | — | — |

### Fleet (`fleet-management/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `vehicle-maintenance-request.html` | Vehicle maintenance request | `employees` R | EmailJS |
| `vehicle-maintenance-audit.html` | Vehicle audit | — | EmailJS |

### Standards & tools (`standards/`, `toolbox/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `standards/standards.html` | Standards library | `standards` R. Storage `standards` | — |
| `standards/technical-resources.html` | Technical guides | `technical_guides` R | — |
| `standards/cable-calculator.html` | AS/NZS 3008 cable sizing, save to job | `cable_selections` R/W/D, `job_number_register` R | — |
| `standards/electrical-calculators.html` | Calculators (client-side only) | — | — |
| `standards/as3000-ai-assistant.html` | Embeds an external chatbot (`discovery-chatbot.vercel.app`) | — | — |
| `toolbox/switchboard-schedule-builder.html` | Switchboard schedule generator | `switchboard_schedules` R/W/D, `employees` R, `job_number_register` R | — |
| `toolbox/testing.html` + `tools/testing/*.js` | Test sheets (switchboard audit, construction wiring) | `testing_switchboard_audit` W, `testing_construction_wiring` W, `work_in_progress` W/D, `job_number_register` R. Storage `testing` | — |

### Client portal (`clients/tyrecycle/`)
| Page | What it does | Supabase | Calls |
|---|---|---|---|
| `compliance/index.html` | Client login / request access | Auth | fn `client-access-request` (**missing — see §7**) |
| `compliance/dashboard.html` | Client compliance overview | `client_users` R, `emergency_lighting_tests` R, `test_tag_reports` R. RPC `client_touch_login` | — |
| `compliance/emergency-lighting.html` | Emergency lighting results | `client_users` R, `emergency_lighting_fittings` R, `emergency_lighting_tests` R | — |
| `compliance/rcd-testing.html` | RCD / test & tag reports | `client_users` R, `test_tag_reports` R. Storage `test-tag-reports` | — |
| `testing/emg-testing.html` | (Staff) record emergency lighting tests | `emergency_lighting_tests` W, `emergency_lighting_fittings` R/W, `emergency_lighting_fitting_audit` R, `emergency_lighting_drafts` R/W/D | — |
| `testing/emg-remedial.html` | (Staff) remedial report | `emergency_lighting_tests` R, `emergency_lighting_rectifications` W | — |
| `maintenance/job-register.html` | Tyrecycle work orders | `tyrecycle_work_orders` R/W, `employees` R | — |
| `maintenance/work-order-completion.html` | Work order completion | `tyrecycle_work_orders` W, `employees` R | fn `send-work-order` |
| `maintenance/tech-chat.html` | Site tech chat (Realtime channel `tyrecycle-chat`) | `tyrecycle_chat_messages` R/W/D, `tyrecycle_chat_mentions` R/W | fn `tyrecycle-chat-notify` (**missing — see §7**) |
| `site-information/contact-directory.html` | Site contacts | `tyrecycle_contacts` R/W/D | — |
| `site-information/inductions.html` | Site inductions | `tyrecycle_inductions` R/W. Storage `Tyrecycle` | — |
| `site-information/site-overview.html`, `tyrecyclehome.html` | Static info pages | — | — |

### Shared scripts (`tools/`)
- `auth.js` — creates `window.sb`, redirects to `/index.html` if not logged in, sends client users to `/clients/<slug>/compliance/`. **Must not** be loaded on client portal pages (redirect loop).
- `bromar-hub.js` / `bromar-hub.css` — shared UI (header, toasts, loading, `bhAlert`/`bhConfirm`, employee list from `employees`).
- `push-subscribe.js` — subscribes the browser to Web Push and upserts `push_subscriptions` (keyed on `employee_name`).
- `bromar-report-kit.js` — PDF/report styling. `document-scanner.js` — camera document scanner (uploads to `job-sheet-files`).
- `swms-shared.js`, `cable-report.js`, `testing/*.js` — shared module logic.

## 3. Netlify functions (`netlify/functions/`)

All are plain HTTP POST handlers, **triggered only by a page calling them** (no scheduled functions, no webhooks).

| Function | Triggered by | What it does | Tables / storage | Email |
|---|---|---|---|---|
| `submit-timesheet.js` | `timesheet-submission.html` → `/api/submit-timesheet` | Saves timesheet, recalculates TIL ledger, uploads PDF, marks Claude draft `submitted`, emails employee + admin | `timesheets` W, `til_ledger` R/W/D, `timesheet_drafts` W, storage `Timesheets` | Resend |
| `submit-jobsheet.js` | `jobsheet-submission.html`, `sign-report.html` | **Currently a copy of an older `submit-timesheet.js` (V1.25)** — see §4/§7 | `timesheets`, `til_ledger`, storage `Timesheets` | Resend |
| `send-signing-link.js` | `jobsheet-submission.html` (sign-off by link) | Emails client a one-time signing link | — | Resend |
| `submit-hazard-report.js` | `hazard-report.html` | Downloads PDF + photos from storage and emails them | storage `safety` R | Resend |
| `submit-leave-request.js` | `leave-request.html` | Saves + emails leave request | `leave_requests` W | Resend |
| `submit-uniform-request.js` | `ppe-uniform-request.html` | Saves + emails PPE/uniform request | `uniform_requests` W | Resend |
| `submit-feedback.js` | `suggestions-feedback.html` | Saves + emails feedback | `feedback_reports` W | Resend |
| `send-roster-change-email.js` | `callout-roster-change.html` | Emails admin about a roster swap | — | **SendGrid** |
| `send-work-order.js` | `work-order-completion.html` | Emails Tyrecycle + management | — | Resend |
| `client-user-admin.js` | **Not called from this repo** (likely Bromar Ops) | Admin-only: approve access requests, create/invite/update/delete client portal users. Checks caller's JWT and `employees.role = 'admin'`. Uses service-role key. | `client_users` R/W/D, `client_access_requests` W, `employees` R, Supabase Auth admin | Resend (from "Bromar Ops") |

**Not in this repo:** Xero sync and push-notification *sending*. This repo only stores push subscriptions (`push_subscriptions`) and shows them (`sw.js` `push` handler). The sender lives elsewhere (probably Bromar Ops or a Supabase Edge Function) — confirm.

## 4. Shared Supabase (with Bromar Ops)

This repo shares **one Supabase project** with the separate **Bromar Ops** repo. Any schema, RLS, RPC or bucket change here can break Ops, and vice versa. Check both repos before renaming/dropping anything.

### Every table this repo touches
`callout_roster`, `callout_roster_changes`, `cable_selections`, `client_access_requests`, `client_sites`, `client_users`, `clients`, `emergency_lighting_drafts`, `emergency_lighting_fitting_audit`, `emergency_lighting_fittings`, `emergency_lighting_rectifications`, `emergency_lighting_tests`, `employees`, `expense_claims`, `feedback_reports`, `hazard_reports`, `incident_reports`, `job_notes`, `job_number_counters`, `job_number_register`, `job_sheet_counters`, `job_sheet_drafts`, `job_sheet_files`, `job_sheets`, `job_type_fields`, `job_types`, `leave_requests`, `public_holidays`, `purchase_order_items`, `purchase_orders`, `push_subscriptions`, `rdo_roster`, `safety_committee`, `schedule_assignments`, `site_contacts`, `standards`, `supplier_branches`, `suppliers`, `switchboard_schedules`, `swms_access_log`, `swms_instances`, `swms_pdf_snapshots`, `swms_signatures`, `swms_templates`, `tasks`, `technical_guides`, `test_tag_reports`, `testing_circuit`, `testing_construction_wiring`, `testing_field_device_itc`, `testing_switchboard_audit`, `testing_switchboard_itc`, `til_ledger`, `timesheet_drafts`, `timesheets`, `tyrecycle_chat_mentions`, `tyrecycle_chat_messages`, `tyrecycle_contacts`, `tyrecycle_inductions`, `tyrecycle_work_orders`, `uniform_requests`, `user_supplier_preferences`, `work_in_progress`.

Also probed as fallbacks (may not exist): `jobs`, `job_register` (`timesheet-submission.html`).

**Storage buckets:** `job-sheet-files`, `swms-completed`, `Timesheets` (capital T), `safety`, `incident-attachments`, `standards`, `testing`, `test-tag-reports`, `Tyrecycle` (capital T).

**RPCs:** `create_new_job`, `register_existing_job`, `create_job_sheet`, `generate_signing_token`, `get_report_by_token`, `get_report_files_by_token`, `submit_signature_by_token`, `next_po_sequence`, `record_supplier_branch_use`, `client_touch_login`.

**Edge Functions:** `submit-change-of-details`. **Realtime:** channel `tyrecycle-chat`.

### ⚠️ Possible clashes with Bromar Ops
1. **Job numbers** — this repo creates jobs via `create_new_job` / `register_existing_job` and `job_number_counters`. If Ops also creates jobs, both must use the same RPCs/counters or numbers can collide.
2. **`employees` is the identity link** — matched by email in some places and by `full_name`/`employee_name` text in others (`push_subscriptions`, `schedule_assignments`, `job_sheet_drafts.user_name`, SWMS). Renaming an employee in Ops can silently orphan rows here.
3. **`tasks`, `schedule_assignments`, `work_in_progress`, `job_number_register`** — read here, very likely written by Ops. Status values this repo expects: `tasks.status` `Pending`/`Acknowledged`/`Closed`; `work_in_progress.status` `draft`/`in_progress`.
4. **`submit-jobsheet.js` writes to `timesheets` / `til_ledger`** — it's a copy of the timesheet function, but job-sheet pages post service-report email payloads to it. Risk of bad timesheet/TIL rows that Ops payroll may read.
5. **`client-user-admin.js`** lives here but is only called from outside (Ops?). Two repos may own the same client-user logic.
6. **`push_subscriptions`** is upserted with the **anon key** and `on_conflict=employee_name` — RLS must allow that, and one row per name means one device per person. If Ops sends pushes it depends on this shape.
7. **Service-role key in functions** (`SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — writes from functions aren't protected by policies.
8. **Bucket names with capitals** (`Timesheets`, `Tyrecycle`) — easy to mismatch from the other repo.
9. **No migrations/SQL in this repo** — schema and RLS are defined elsewhere (Supabase dashboard or Ops). Don't assume a column exists; check.

## 5. Draft workflow (Claude-filled drafts)

Claude can pre-fill drafts in Supabase; the user opens the app, checks, and submits. **Claude never submits** — only writes rows with `status = 'draft'`.

### `timesheet_drafts` → `job-management/timesheet-submission.html`
- One draft per employee per week. Page looks up `employee_email` (lower-case) + `week_starting` (Monday, `YYYY-MM-DD`) + `status = 'draft'`.
- Fields used: `timesheet_entries` (array), `standby`, `allowance_first_aid`, `allowance_construction_wiring`, `general_comments`, `updated_at`.
- Each entry: `day` (`monday`/`mon`/0–6) or `date`, `type`, `other_type`, `job_number`, `client`, `normal_hours`, `overtime_hours`, `travel_hours`, `shift`, `comment`, `callout_received`, `callout_complete`, `til_accrued_hours`.
- If the form already has entries, the user is asked before the draft replaces them. A "Draft loaded from Claude" banner shows.
- On submit, `submit-timesheet.js` sets `status = 'submitted'`, `submitted_at`, `timesheet_id`.

### `job_sheet_drafts` → `job-management/jobsheet-submission.html`
- Two kinds of row, told apart by `source`:
  - `autosave` — the page's own 30-second save. `draft_key = 'autosave:<email>'`, expires after 7 days.
  - `claude` — written by Claude. Never expires; shown first with a 🤖 badge.
- Fields: `source`, `status` (`draft` → `submitted` / `discarded`), `employee_email`, `user_name`, `job_number`, `client_name`, `sheet_date`, `draft_data` (same shape as the page's `collectDraftData()`: `sheet_date`, `job_type`, `tasks`, `labour[]`, `materials[]`, `notes`, `notifyPeople`, `isServiceReport`, `reportSections`, …), `new_job` (`job_number`, `job_type`, `prefix`, `client_id`, `site_id`, `client_name`, `site_name`) for jobs not yet in `job_number_register`, `saved_at`, `updated_at`, `expires_at`, `submitted_at`.
- Page finds drafts by `employee_email` **or** `user_name`. If the job number exists it's selected; otherwise the user confirms "Add Job" / "Create Job" first.
- Discarding a Claude draft sets `status = 'discarded'` (autosaves are deleted). Saving the sheet marks the Claude draft `submitted` (done in the browser, not in a function).

**When Claude writes drafts:** lower-case emails, Monday dates for weeks, use existing job numbers from `job_number_register` where possible, don't touch rows that aren't `status = 'draft'`.

## 6. Conventions

- **Structure:** one folder per area (`job-management/`, `safety/`, `schedules/`, `employee-resources/`, `fleet-management/`, `standards/`, `toolbox/`, `clients/<client>/`). Big modules split into `js/<module>-core.js`, `js/<module>-boot.js`, `js/tabs/<prefix>-<tab>.js` (`jm-` = Job Manager, `sb-` = SWMS Builder). Shared code in `tools/`. Functions in `netlify/functions/`.
- **Naming:** files kebab-case; DB tables/columns snake_case; client-specific tables prefixed with the client (`tyrecycle_*`). Many files start with a version header comment (`V1.26 — date — path`) — bump it when you edit.
- **Page boilerplate (staff page):** Supabase CDN → `/tools/auth.js` → `../tools/bromar-hub.js`. Use `window.sb` for all queries. Client portal pages load Supabase + `bromar-hub.js` only (no `auth.js`).
- **Auth:** Supabase Auth (email/password), session in localStorage. Role from `app_metadata.role` (`client` = portal user, set server-side only). Staff admin rights come from `employees.role = 'admin'`. Client access is also checked against `client_users`.
- **Row-level security:** browser uses the **anon key + user JWT**, so RLS must protect every table. Public signing (`sign-report.html`) goes through token-checking RPCs, not direct table access. Netlify functions use the **service-role key** and bypass RLS — validate inputs there. RLS policies are not stored in this repo.
- **Keys:** secrets live in **Netlify environment variables** only — `SUPABASE_URL`, `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `FROM_EMAIL`, `TEST_TO`, `SENDGRID_API_KEY`, `CLIENT_EMAIL`, `MANAGEMENT_EMAILS`, `BROMAR_LOGO_URL`. **Never put a service-role key, Resend/SendGrid key or any secret in code.** The Supabase URL, anon key, VAPID *public* key and EmailJS public keys are in front-end code by design (they're public).
- **`TEST_TO`:** if set, functions send all mail there — remember to unset in production.
- **Deploy:** push to `main` → Netlify auto-deploys. Local: `npm install` then `netlify dev`.

## 7. Open questions

1. `submit-jobsheet.js` is a copy of the timesheet function. Is there a real job-sheet/service-report email function that should be here?
2. `submit-incident-report`, `client-access-request` and `tyrecycle-chat-notify` are called by pages but don't exist in `netlify/functions/`. Are they in Bromar Ops, Supabase, or missing?
3. Where are Xero sync and push-notification sending implemented (Ops? Edge Functions?)
4. Who owns the schema/RLS and migrations — Ops repo, or the Supabase dashboard?
5. Which tables does Bromar Ops write to (esp. `job_number_register`, `tasks`, `schedule_assignments`, `employees`, `timesheets`)?
6. `job-manager.html` loads `js/tabs/jm-photos.js`, but the file is `jm-photos.html` — Photos tab probably 404s. Intended?
7. `job-management/js/tabs/testing.js` and `toolbox/testing/testing.js` are near-duplicates; the toolbox copy seems unused.
8. Should `send-roster-change-email.js` move from SendGrid to Resend like the others?
9. `README.md` / `docs/timesheet-submission.me` are outdated — update or remove?
10. README links GitHub Pages (`bromar-engineering.github.io/bromarhub`) — still live? Netlify functions won't work there.
