# Framework ↔ ERP Report Contract Audit

**Date:** 2026-04-26
**Branch:** `feat/tracking-erp-link`
**Framework:** v4.1.1 (+ pending v4.2 fields on this branch)
**ERP:** `Projects/qualia-erp` `app/api/v1/reports/route.ts` (current `main`)

This doc is the source of truth when reconciling what `/qualia-report` sends with what the ERP actually persists. No code changes here — audit only.

## Sender (framework)

`skills/qualia-report/SKILL.md` builds the JSON payload from `tracking.json` at lines 155–194. After the v4.2 changes on `feat/tracking-erp-link`, the payload contains **31 fields**.

## Receiver (ERP)

`app/api/v1/reports/route.ts` validates the body with `payloadSchema` (Zod) at lines 56–90 and writes to the `session_reports` table at lines 190–223.

## Field-by-field

Legend: ✅ accepted & persisted · ⚠️ accepted but renamed/transformed · ❌ silently dropped by Zod · ➖ not sent

| # | Field | Sent by framework | Accepted by ERP | DB column | Notes |
|---|-------|-------------------|-----------------|-----------|-------|
| 1 | `project` | ✅ | ✅ required, `min(1)` | `project_name` | Renamed in DB. |
| 2 | `project_id` | ✅ | ✅ optional | `framework_project_id` | Renamed in DB. Half of dedupe key. |
| 3 | `team_id` | ✅ | ✅ optional | `team_id` | |
| 4 | `git_remote` | ✅ | ✅ optional | `git_remote` | |
| 5 | `client` | ✅ | ✅ default `''` | `client` | Display name. |
| 6 | `client_id` *(v4.2)* | ✅ **NEW** | ❌ **MISSING** | — | **Mismatch:** Zod has no `client_id`; field is silently stripped. ERP needs schema update before this is useful. |
| 7 | `framework_version` *(v4.2)* | ✅ **NEW** | ❌ **MISSING** | — | **Mismatch:** Zod has no `framework_version`; field is silently stripped. |
| 8 | `client_report_id` | ✅ | ✅ regex `/^QS-REPORT-\d+$/` | `client_report_id` | Other half of dedupe key. |
| 9 | `milestone` | ✅ | ✅ optional int | `milestone` | |
| 10 | `milestone_name` | ✅ | ✅ optional | `milestone_name` | |
| 11 | `milestones[]` | ✅ | ✅ shape validated | `milestones` (jsonb) | Drives ERP project tree render. |
| 12 | `phase` | ✅ | ✅ optional int | `phase` | |
| 13 | `phase_name` | ✅ | ✅ optional | `phase_name` | |
| 14 | `total_phases` | ✅ | ✅ optional int | `total_phases` | |
| 15 | `status` | ✅ | ✅ optional | `status` | Free-form string both sides. No enum. |
| 16 | `tasks_done` | ✅ | ✅ default `0` | `tasks_done` | |
| 17 | `tasks_total` | ✅ | ✅ default `0` | `tasks_total` | |
| 18 | `verification` | ✅ | ✅ default `'pending'` | `verification` | |
| 19 | `gap_cycles` | ✅ (number, flattened) | ⚠️ accepts number OR object, flattens to current phase | `gap_cycles` (int) + `gap_cycles_raw` (jsonb) | Polymorphism documented. |
| 20 | `build_count` | ✅ | ✅ optional non-negative int | `build_count` | |
| 21 | `deploy_count` | ✅ | ✅ optional non-negative int | `deploy_count` | |
| 22 | `deployed_url` | ✅ | ✅ default `''` | `deployed_url` | |
| 23 | `session_started_at` | ✅ | ✅ optional ISO datetime | `session_started_at` | |
| 24 | `last_pushed_at` | ✅ | ✅ optional ISO datetime | `last_pushed_at` | |
| 25 | `lifetime` | ✅ | ✅ default `{}` | `lifetime` (jsonb) | |
| 26 | `commits[]` | ✅ | ✅ default `[]` | `commits` (text[]) | From `git log --since=8 hours`. |
| 27 | `notes` | ✅ | ✅ `max(65000)`, default `''` | `notes` | Truncated client-side at 60000. |
| 28 | `submitted_by` | ✅ | ✅ default `''` | `submitted_by` | From `git config user.name`. |
| 29 | `submitted_at` | ✅ | ✅ ISO datetime, defaulted server-side | `submitted_at` | |
| 30 | `dry_run` | ➖ (only `erp-ping` sets it) | ✅ default `false` | `dry_run` | Filtered out of production reads. |
| 31 | `session_duration_minutes` | ➖ **DOCUMENTED but NOT SENT** | ➖ not in Zod | — | Listed in `docs/erp-contract.md` line 80 example but never computed by `qualia-report`. **Doc/code drift.** |

**Server-side additions** (not from payload): `idempotency_key`, `token_id`, `auth_method`. These are derived from request headers and the auth result.

## Mismatches summary

### MISMATCH 1 — `client_id` dropped (HIGH)
- **Framework:** sends `client_id` from `tracking.json` (added on this branch).
- **ERP:** Zod `payloadSchema` has no `client_id` key, so it's stripped before insert.
- **Impact:** the new field is wire-visible but never reaches the DB. ERP cannot key reports against the `clients` table until the schema accepts it.
- **Fix path** (next change in ERP repo):
  1. Add `client_id: z.string().uuid().optional()` to `payloadSchema`.
  2. Add a `client_id` column to `session_reports` (migration).
  3. Map `body.client_id || null` into `row`.
  4. Optionally: prefer `client_id` over fuzzy `client` string when joining for the admin Reports UI.

### MISMATCH 2 — `framework_version` dropped (MEDIUM)
- **Framework:** sends `framework_version` (auto-stamped from `package.json`).
- **ERP:** not in Zod, silently stripped.
- **Impact:** ERP can't reason about payload schema age, can't route legacy/modern parsers, can't surface "this client is on an old framework" warnings.
- **Fix path:**
  1. Add `framework_version: z.string().optional()` to `payloadSchema`.
  2. Add `framework_version` column on `session_reports` (text, nullable).
  3. Echo back in admin UI's Framework Reports tab (`framework-reports-tab.tsx`).

### MISMATCH 3 — `session_duration_minutes` doc/code drift (LOW)
- **Docs:** `docs/erp-contract.md` line 80 includes `"session_duration_minutes": 45` in the example.
- **Framework code:** never computes nor sends it.
- **ERP Zod:** doesn't accept it.
- **Impact:** misleading documentation. Two clean options:
  - **Remove from docs** (recommended — it isn't load-bearing).
  - **Implement** by computing `(submitted_at - session_started_at) / 60000` in the payload builder and adding `session_duration_minutes: z.number().int().nonnegative().optional()` on the ERP side.

### NON-MISMATCH — `gap_cycles` polymorphism
Working as designed. Framework flattens to a number for the current phase; ERP accepts both shapes via union type and stores the raw object in `gap_cycles_raw` for reconstruction. No action needed.

### NON-MISMATCH — `Idempotency-Key` vs `client_report_id`
Two independent dedupe layers, both documented in `route.ts`:
- `Idempotency-Key` header → 24h exact-replay window via `idempotency_keys` table.
- `(framework_project_id, client_report_id)` composite → permanent UPSERT key.
Either or both can be used. No action needed.

## Recommended next moves (post-audit)

1. **In `qualia-erp`**: open `feat/accept-client-id-framework-version` and apply Mismatch 1 + 2 fixes (Zod + migration + row mapping). One PR, ~30 LOC + one migration.
2. **In `qualia-framework`**: open `chore/erp-contract-doc-cleanup` and remove `session_duration_minutes` from `docs/erp-contract.md` example (Mismatch 3, low-risk).
3. **In `qualia-erp` admin UI**: add a "Framework version" column to Framework Reports tab once the column exists. Surface a soft warning when `framework_version` is empty or below a configured floor.

When all three are merged, the contract is symmetric again and ERP gains a true client foreign key for reports.
