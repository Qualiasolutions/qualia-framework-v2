# Changelog

All notable changes to the Qualia Framework are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: git tags for historical versions were not retained; commit references are approximate
> and dates reflect commit history rather than npm publish timestamps.

## [4.1.1] — 2026-04-22

**Critical silent-fail hotfix.** Follow-up to the v4.1.0 audit (`FRAMEWORK_REVIEW.html`) which surfaced 142 findings across 4 dimensions. This release addresses the 5 highest-risk issues — each one previously let an operation fail silently or skip safety checks without telling the user. Subsequent releases (v4.2.0 structural, v4.3.0 harness patterns) will handle the remaining findings.

### Fixed

- **`grounding.md` phantom on stale installs** (`hooks/session-start.js`, `hooks/auto-update.js`). Users who upgraded from v4.0.5 → v4.1.0 without re-running `npx qualia-framework@latest install` had no `~/.claude/rules/grounding.md`, so every planner/builder/verifier spawn silently received empty grounding context. Session-start now spot-checks 5 critical files (`grounding.md`, `security.md`, `frontend.md`, `deployment.md`, `state.js`) once per 24h and prints a loud banner with the exact install command when anything is missing. `auto-update.js` invalidates the health cache on every version bump so newly-shipped critical files are verified on the next session.
- **`qualia-report` ERP upload silent-fail chain** (`skills/qualia-report/SKILL.md`). Three independent silent failures were producing garbage reports: empty `API_KEY` → sent `Authorization: Bearer ` (blank token) then surfaced a generic 401 with "Ask Fawzi" and no diagnostic. Empty `CLIENT_REPORT_ID` from a state.js failure → commit message dropped the ID, ERP payload carried empty string. `SUBMITTED_BY` shell-interpolated into `node -e` script → a single quote in `git config user.name` silently broke the payload. Fixes: guard empty API key before the POST loop with a clear `~/.claude/.erp-api-key` diagnostic, validate `CLIENT_REPORT_ID` is non-empty and fail loudly if state.js didn't return one, pass `SUBMITTED_BY`/`SUBMITTED_AT`/`CLIENT_REPORT_ID`/`REPORT_FILE` via environment variables (which are inert to shell metacharacters) instead of string interpolation, and make the 401 handler actually explain the likely cause.
- **`/qualia-ship` had no state guard and a hallucinated domain** (`skills/qualia-ship/SKILL.md`). The skill would run from any state (setup/planned/built — even `shipped` → double-deploy possible), its security scan only grepped `service_role` (missed hardcoded keys, tracked `.env`, `dangerouslySetInnerHTML`), and its post-deploy verification used a literal `{domain}` placeholder that expected the LLM to hallucinate the URL. Now: state gate refuses any status except `polished` or `verified+pass` (with `--force` escape hatch for hotfixes), security scan inlines the CRITICAL checks from `/qualia-review` verbatim so the two skills agree, and the URL is read from `tracking.json.deployed_url` with a loud error if missing. Description also gained the missing trigger phrases (`deploy`, `ship it`, `go live`, `push to prod`, `launch`).
- **`templates/help.html:410` mis-described `/qualia-idk`.** Was listed as "Alias for /qualia. The smart router handles all 'idk' situations" — directly contradicts the actual SKILL.md which defines it as a diagnostic intelligence running two isolated scans. Team members reading the help page were sent to the wrong skill. Description now matches the skill.
- **`hooks/session-start.js` silent error swallow.** The top-level `try { ... } catch { }` block recorded `result: "allow"` in traces even when the try body threw, so silent session-start crashes were invisible in analytics. Error cases now log to `.qualia-traces/{date}.jsonl` with `result: "error"` and the exception message.

### Notes

Full framework review (142 findings) and v4.2.0 / v4.3.0 / v4.4.0 roadmap documented separately. This release handles the 5 highest-risk silent-fail paths; subsequent releases handle structural debt (3-tier memory, unified color module, orphan skill consolidation) and harness-engineering patterns (adversarial build, continuous reviewer agents, component-fetch skill).

## [4.1.0] — 2026-04-21

**Command quality + build workflow hardening.** Deep research across 5 parallel Opus agents surfaced 15 concrete improvements — shipped across 4 commits. Every agent spawn now loads a shared **Grounding Protocol** (cite-or-INSUFFICIENT-EVIDENCE, no hedging, file:line evidence required for every finding) and deterministic scoring rubrics. Build workflow gains cache-aware prompt ordering (92% prefix-cache hit rate per Anthropic docs), explicit parallel wave dispatch, and a structured builder output contract. `qualia-debug` was fully rewritten from interactive to investigative one-shot. Research reports committed to `docs/research/`. 168/168 tests passing.

### Added

- **`rules/grounding.md` — shared Grounding Protocol + 5 rubrics.** New file referenced from every skill that spawns a subagent. Contains: 8-rule Grounding Protocol (every claim requires `file:line — "quoted"` evidence, no hedging language, scores require rubric citations, output shapes are contracts, tool budgets enforced, preconditions checked); **Severity Rubric** with objective criteria per level and a deterministic `max(1, 5 − ⌊weighted_sum/8⌋)` category-score formula; **Task-Done Rubric** (compiles / no stubs / wired / AC validated / committed); **Evidence Citation Format**; **Deviation JSON Format**; **Design Quality Rubric** (6 dimensions × 3 levels); **cache-aware prompt-ordering rule**. Install.js picks this up automatically via `rules/` directory copy.
- **Structured Output Contract for builder** (`agents/builder.md`). Builder must return `DONE — Task {N}: {commit_hash}` with file list, `BLOCKED — {reason}` with JSON deviation block (`{type, task, file, planned, actual, impact}`), or `PARTIAL — {done}; remaining: {left}`. Orchestrator can now parse results programmatically instead of regex-guessing free-text.
- **Explicit file-based dependency graph for wave assignment** (`agents/planner.md`). Replaces vibes-based "tasks with no dependencies" with a mechanical algorithm: build `writes(T)` / `reads(T)` sets from Files and Context fields, declare edge A→B when `writes(A) ∩ reads(B) ≠ ∅`, topological-sort into waves, enforce write-conflict check within each wave. Worked example table included. Same inputs → same waves.
- **Rule 8 for plan-checker** (`agents/plan-checker.md`). Each task's `**Validation:**` list must include at least one `grep-match` or `command-exit` that tests behavior — a task whose only Validation is `test -f {file}` fails the rule. Stops stubs and placeholders from passing the build gate.
- **Tool budgets** across 3 open-ended agents: researcher (3 Context7 + 3 WebFetch + 2 WebSearch per dimension), verifier (25 bash/grep per invocation), plan-checker (10 per invocation), qualia-debug (10 Read/Grep/Bash). Enforces INSUFFICIENT EVIDENCE return over speculative output when budget exhausted.
- **Frontend gate on verifier's Design Verification section** (`agents/verifier.md`). Grep the phase plan for `.tsx`/`.jsx`/`.css`/`Persona:\s*(frontend|ux)` first — if absent, skip the ~40-command design verification block entirely. Saves substantial time on backend-only phases.
- **`<wave_context>` block in builder prompts** (`skills/qualia-build/SKILL.md`). Lists sibling tasks in the same wave (title + files only, ~50 tokens per task) so parallel builders don't make conflicting semantic choices on shared types or patterns.
- **Evidence citation requirement for milestone suggestions** (`agents/research-synthesizer.md`). Every arc entry must cite `[DIMENSION.md: <finding>]`. Speculative milestones marked `[speculative — no source]`.
- **Parallel Agent fan-out in `qualia-design`** for >5 target files. Batches of 5, one Agent per batch, all dispatched in a single response turn. Post-fix verification greps catch reverted anti-patterns (`outline:none` without replacement, generic fonts, `max-w-7xl`, missing alt, blue-purple gradients).
- **Parallelized security scans in `qualia-review`.** Independent greps now explicitly dispatched as parallel Bash calls in one turn. Saves 15-30s on large codebases.
- **Typed input contracts across 7 agents** (planner, plan-checker, builder, verifier, researcher, qa-browser, roadmapper). Replaces prose "You receive: X + Y" with `<variable>` blocks + types + sources. Catches missing inputs at prompt-assembly time instead of mid-execution.
- **`<full_detail>` declared in roadmapper Input section.** Was a ghost parameter referenced in the body but never declared — orchestrator had no mechanism to pass it.
- **Cache-aware prompt structure in `qualia-build`.** Split `<phase_context>` (PROJECT.md/DESIGN.md, phase-stable) from `<task_context>` (per-task @files, varies). Stable prefix first, dynamic last — preserves Anthropic prompt-caching prefix-hit across parallel wave tasks (docs report 92% hit rate + 81% cost reduction at Claude Code scale when prefix is byte-identical).
- **Research reports in `docs/research/`** documenting the analysis: `2026-04-21-command-quality-deep-research.md` (15-item synthesis from 4 parallel Opus audits) and `2026-04-21-industry-best-practices.md` (255 lines, cited sources on prompt caching, verification loops, hallucination reduction, multi-agent orchestration).

### Changed

- **Plan-checker revision loop capped at 2 iterations** (was 3). Amazon/NeurIPS 2025 measured reflection gains at 74%→86% for 1 round, only 88% for 3 rounds — iteration 3 added 2pp over iteration 1, not worth the extra planner spawn. Updated `qualia-plan/SKILL.md`, `plan-checker.md`, and all stale "3 cycles" references.
- **`qualia-review` scoring replaced subjective thresholds with deterministic formula.** Quick-reference table rewritten to match the computed formula (earlier drafts had inconsistent boundary rules — verified mechanically during release QA and corrected).
- **Verifier now receives PROJECT.md inlined in its spawn prompt.** Previously blind to project conventions — Quality scoring rubric referenced "project conventions" but verifier had no way to read them.
- **Wave dispatch explicitly parallel in `qualia-build/SKILL.md`.** Replaced "parallel if multiple" language with an explicit instruction: spawn all wave tasks as separate `Agent()` calls in the SAME response turn — do NOT await one before the next. Prior natural-language phrasing relied on harness behavior rather than enforcing true concurrency.
- **`qualia-debug` rewritten from interactive to investigative one-shot.** Previously required 4 mandatory user questions and a diagnosis-confirmation gate before any investigation. Now parses symptom from `$ARGUMENTS`, runs diagnostic grep batches (general/frontend/perf modes), hard 10-call tool budget, INSUFFICIENT EVIDENCE return instead of speculative fixes, structured DEBUG-{timestamp}.md report output to `.planning/`. Matches the one-shot pattern of every other `/qualia-*` command.
- **`qualia-design` critique section now uses the structured Design Quality Rubric** (File | Dimension | Issue | Line | Severity) instead of vibes-based evaluation. Any dimension scoring below 4 is a mandatory fix.

### Fixed

- **Latent `grep -qL` bug in `qualia-review` API auth check.** The combination of `-q` (quiet) and `-L` (list non-matching files) is undefined in POSIX and was producing inverted "UNPROTECTED" output. Rewrote as a clean `if ! grep -q ... then echo UNPROTECTED` loop. Verified against mock directory of protected + unprotected routes.
- **Full `npx next build` removed from `qualia-review` Performance Scan.** A 30-120s side-effectful build triggered during a "scan" command was a hidden cost that made review surprisingly slow and polluted `.next/`. Replaced with `du -sh .next/static/chunks/*.js` against existing build artifacts, with a warning if no build output exists.

### Notes

- **Always pin `@latest` when upgrading.** npx caches at `~/.npm/_npx/` and has no time-based TTL, so `npx qualia-framework install` can silently re-run a cached old copy. Use `npx qualia-framework@latest install` (or `npx clear-npx-cache` first). README updated to reflect this. ([npm/rfcs#700](https://github.com/npm/rfcs/issues/700))
- Users who update the framework must re-run the install script so `~/.claude/rules/grounding.md` lands — every skill's spawn prompt now references this file.
- Any client projects mid-phase where the plan-checker was on iteration 3 will now escalate at iteration 2. Acceptable trade-off per the measured reflection-gain data.
- The builder Output Contract (`DONE/BLOCKED/PARTIAL`) is advisory today — existing orchestrator skills do not programmatically parse it. Enforcement will land in a follow-up minor when the parsing is wired through.

### Deferred to v4.2.0

- Mechanical-fix bypass in plan-checker (skip planner re-spawn for frontmatter/wave-assignment issues — ~4 hrs orchestration work, regression risk not suitable for this release).
- Pre-Build Context Packet (single JSON consolidating PROJECT.md + DESIGN.md + plan + wave-context before spawning any builders).
- Intra-wave task verification (run task Validation contracts immediately after each builder completes, before next wave starts).
- New agents: migrator, dependency-auditor, rollback.
- `curl` fallback in qa-browser for environments without Playwright MCP.

## [4.0.5] — 2026-04-19

**Statusline refresh.** The phase segment now shows milestone + tasks +
blockers (not just phase number), and the line closes with a
`⬢ Qualia · {firstName}` signature pulled from
`~/.claude/.qualia-config.json`. Static `hooks N` / `skills N` counters
removed — they never changed between projects, so they added noise
without signal. All 168 tests still green.

### Added

- **`bin/statusline.js` — milestone segment.** When
  `.planning/tracking.json` has `milestone` + `milestone_name`, the
  statusline renders `M{n}·{shortName}` (name truncated to 14 chars)
  before the phase number. Previously only the phase number (`P1/3`)
  was visible — milestone context had to be looked up manually.
- **`bin/statusline.js` — task progress.** When `tasks_total > 0`,
  renders `T{done}/{total}` alongside the phase. Gives mid-phase
  progress at a glance during `/qualia-build` waves.
- **`bin/statusline.js` — blocker badge.** When
  `tracking.json.blockers` is a non-empty array, renders `!{n}` in
  red. Intentionally loud — blockers should never sit unnoticed.
- **`bin/statusline.js` — Qualia signature.** Line 2 now ends with
  `⬢ Qualia · {firstName}` where `firstName` is the first whitespace-
  delimited token of `installed_by` in `~/.claude/.qualia-config.json`.
  Branded closer, makes the statusline feel like ours, not a generic
  Claude Code tool.

### Removed

- **`bin/statusline.js` — hooks/skills counters.** The `hooks N`
  and `skills N` indicators were removed from line 1. Both counts are
  effectively static across all projects on a single machine (a given
  install has the same hooks and skills everywhere), so they were
  visual noise — they didn't help the employee understand *this*
  project's state. `mem N` is retained because it genuinely varies
  per project (different memories accumulated per working directory).

## [4.0.4] — 2026-04-18

**Audit follow-up + ERP integration upgrade.** Eight concrete improvements
from the framework deep-dive audit. Tests: 164 → 168 (+4 regression tests,
covering the new `next-report-id` subcommand and the JOURNEY.md
pre-populate on `close-milestone`).

### Added

- **`qualia-framework erp-ping`** — new CLI subcommand that POSTs a
  synthetic `dry_run: true` payload to the ERP and prints HTTP code,
  response body, and the ERP-returned `report_id`. Single-command
  connectivity + key-validity + endpoint health check. Aliased as `ping`.
- **`QS-REPORT-NN` client-side identifiers** — every session report
  now carries a stable, sequential client ID (`QS-REPORT-01`, `-02`, …
  per project) stored in `tracking.json.report_seq` and sent to the ERP
  in a new `client_report_id` field. Survives retries, survives UUID
  changes on the ERP side, is the preferred dedupe key going forward.
- **`state.js next-report-id [--peek]`** — new mutator subcommand that
  increments `report_seq` and returns the next `QS-REPORT-NN`. `--peek`
  returns without incrementing (for `/qualia-report --dry-run`).
- **`/qualia-report --dry-run`** — assemble + print the payload but
  skip the POST, skip the git commit, and peek the sequence counter
  without consuming one. Useful for previewing before a real clock-out.
- **`/qualia-report` now retries with backoff** — 3 attempts at 1s, 3s,
  9s on transient failures (timeout, 5xx, network). 401/422 are
  permanent failures and fail fast. Local report commit is unchanged —
  no data loss on upload failure, just a stale ERP view until retry.
- **`/qualia-report` now displays both IDs on success** — "Uploaded as
  QS-REPORT-03 (ERP: {uuid})". Employees and the ERP share the same
  stable reference.
- **`/qualia-new --full-detail`** — new flag that instructs the
  roadmapper to write full phase-level detail for EVERY milestone
  upfront (not just M1). Default behavior (progressive detail)
  unchanged. `agents/roadmapper.md` honors `<full_detail>` in its
  prompt contract.
- **Visible progressive-detail notice** — after journey approval,
  `/qualia-new` now explicitly tells the user "Milestone 1 is fully
  planned. M2..M{N-1} are sketched. Full detail fills in when
  /qualia-milestone opens each one." Previously only in template
  comments — easy for a new team member to miss.

### Fixed

- `bin/state.js` `close-milestone` now reads `.planning/JOURNEY.md` to
  pre-populate `tracking.json.milestone_name` with the next milestone's
  name. Previously, between `close-milestone` and the next
  `state.js init --force` from the roadmapper, `milestone_name` sat
  blank — the ERP tree view would briefly show an unnamed milestone.
  Falls back to blank if JOURNEY.md is missing (legacy projects, pre-v4).
- `bin/cli.js` — `QUALIA_AGENT_FILES` expanded from 4 to all 8 agents
  (`planner`, `builder`, `verifier`, `qa-browser`, **`plan-checker`**,
  **`researcher`**, **`research-synthesizer`**, **`roadmapper`**).
  `qualia-framework uninstall` would previously leave the last 4 on
  disk as orphans.
- `bin/cli.js` `cmdMigrate` — removed `block-env-edit.js` from
  `requiredEditHooks`. That hook was deleted in v3.2.0 and
  `install.js` actively purges it; `migrate` was trying to wire a
  non-existent file into `settings.json`.
- `bin/install.js` + `bin/cli.js` — unpinned
  `next-devtools-mcp@0.3.10` → `@latest`. The pin was silent drift.
- `bin/install.js` — warn (instead of OK) when an existing
  `~/.claude/.erp-api-key` is under 10 bytes. Clearly truncated or
  placeholder keys no longer silently pass install. Real bearer tokens
  are ≥ 20 bytes; the threshold is deliberately loose to avoid false
  positives.

### Changed

- `templates/tracking.json` — new field `report_seq: 0`.
- `docs/erp-contract.md` — documented `client_report_id` (recommended)
  and `dry_run` (optional) on the POST payload.

### Tests

- 164 → 168 (+4). New coverage: `next-report-id` increments,
  `next-report-id --peek` is side-effect-free, `close-milestone`
  pre-populates `milestone_name` from JOURNEY.md, and the fallback
  path when JOURNEY.md is absent.

## [4.0.3] — 2026-04-18

**Zero-deferral release.** Closes the last two items that were previously
deferred as trade-offs.

### Fixed

- `hooks/pre-compact.js`: `--no-verify` and `--no-gpg-sign` are now
  configurable via `~/.claude/.qualia-config.json`:

  ```json
  {
    "pre_compact": {
      "respect_user_hooks": true,
      "respect_gpg_signing": true
    }
  }
  ```

  Default behavior is unchanged (bot commits bypass both, because
  compaction can fire at any moment and pre-commit test suites would
  routinely block the auto-save and lose STATE.md). Compliance-sensitive
  projects opt into strict mode per-flag. The flags used are included
  in the hook trace.

### Added

- **All 26 skills now declare `allowed-tools`** in frontmatter. Per-skill
  conservative tool unions — wider rather than narrower to avoid
  breakage. Read-only skills (`qualia-help`, `qualia-resume`) declare
  it explicitly. The framework no longer relies on the user's default
  permission mode for tool scoping.

## [4.0.2] — 2026-04-18

**Stability pass.** Closes every remaining HIGH + MEDIUM item from the
v4.0.0 audit that could surface as a silent failure or instability.
Tests: 159 → 164 (+5 regression tests).

### Fixed — HIGH

- `hooks/session-start.js`: `readConfig()` now defined above its call
  site. Previously worked by function-declaration hoisting — would have
  silently broken on any refactor to `const readConfig = …`.
- `bin/state.js`: write-ahead journal (`.planning/.state.journal`)
  captures the pre-transition snapshot of STATE.md + tracking.json
  before the dual write. On next mutator invocation, if the journal
  exists we recover both files to the pre-transition state. A crashed
  mutator (SIGKILL / power loss between the two renames) no longer
  leaves the pair inconsistent. A corrupt journal is cleared, not fatal.

### Fixed — MEDIUM

- `hooks/migration-guard.js`: DELETE / UPDATE `WHERE` scan is now
  per-statement (split on `;`) instead of file-global. A file
  containing `DELETE FROM foo;` followed by any later `… WHERE …`
  (in a SELECT, JOIN, etc.) would previously pass the check.
- `hooks/migration-guard.js`: stdin read retry loop now sleeps 1ms
  between EAGAIN retries via `Atomics.wait` instead of spinning CPU.
- `hooks/pre-push.js`: commit-failure path now unstages tracking.json
  and restores the working-tree copy, so the user's next manual commit
  isn't polluted by an aborted ERP-stamp change.
- `bin/cli.js` — `cleanSettingsJson`: iterates ALL hook-event keys in
  settings.json instead of the hardcoded three (SessionStart /
  PreToolUse / PreCompact). Future hook events get cleaned automatically.
- `bin/cli.js` — hook cleanup: introduce `QUALIA_LEGACY_HOOK_FILES`
  for removed-in-past-version hook filenames (currently
  `block-env-edit.js`). Uninstall cleans legacy hooks too.
- `bin/statusline.js`: memory-path `dirKey` now strips BOTH `/` and `\`
  so Windows installs get a correct project key and the memory count
  actually renders.

### Tests

- +5 regression tests:
  · state.js recovers STATE.md + tracking.json from `.state.journal`
  · state.js: corrupt `.state.journal` is cleared without crashing
  · migration-guard: `DELETE FROM x; SELECT … WHERE …;` still blocks
  · migration-guard: `UPDATE … SET …; SELECT … WHERE …;` still blocks
  · install.js: reinstall preserves user-added hooks in settings.json

## [4.0.1] — 2026-04-18

**Post-v4.0.0 audit cleanup.** No behavior changes on the happy path —
all fixes patch latent bugs, silent failure modes, and documentation
drift found in a full-framework audit. Tests grew from 156 to 159.

### Fixed — ship-blockers

- `bin/qualia-ui.js`: `/qualia` journey-tree no longer crashes when
  `JOURNEY.md` lacks a `project:` frontmatter line. A `const projectName`
  was shadowing the function name inside its own initializer, triggering
  `ReferenceError: Cannot access 'projectName' before initialization`.
- `templates/help.html`: version pill, subtitle, and footer now render
  the real installed version. Previously hardcoded `v3.6.0` in three
  places, and the `sed "s/{{VERSION}}/$VERSION/g"` in `/qualia-help`
  had nothing to replace.
- `skills/qualia-help/SKILL.md`: version fallback chain rewritten —
  `.qualia-config.json` → `package.json` → `"latest"`. Previously
  fell back to the string `"v3"`.
- `skills/qualia-design/SKILL.md` + `rules/frontend.md`: remove references
  to 5 non-existent design skills (`/bolder`, `/design-quieter`,
  `/colorize`, `/distill`, `/delight`). The rules file ships to every
  user project; the ghost commands would have 404'd.
- `CLAUDE.md`: Road section rewritten to describe the v4 hierarchy.
  Previously no mention of milestones, `JOURNEY.md`, `/qualia-milestone`,
  `/qualia-idk`, or `--auto` — the file Claude reads every session was
  still on v3 mental model.
- `CHANGELOG.md`: add link references for v3.1.0 through v4.0.0 and
  point `[Unreleased]` at v4.0.0. Previous version headers rendered
  as plain text on GitHub / npm.

### Fixed — real bugs

- `hooks/pre-deploy-gate.js`: exits **2** (not 1) on block, matching
  Claude Code's PreToolUse hook contract. Previous code explicitly
  acknowledged the violation in a comment. Test assertions updated in
  `tests/runner.js` and `tests/hooks.test.sh`.
- `bin/state.js` — lock: replace 50ms CPU busy-wait with
  `Atomics.wait`-backed `sleepSync` (no CPU starvation on constrained
  CI runners). Lock fall-through now traces `state-lock/fallthrough`
  so repeated contention is visible instead of silent.
- `bin/state.js` — `cmdTransition`: back up BOTH `STATE.md` and
  `tracking.json` before the dual write, so a failure in the second
  write can roll both files back to a consistent pre-transition state.
- `bin/install.js`: hooks are now merged into `settings.json` instead
  of clobbered. Previous code did `settings.hooks = {...}`, silently
  destroying any user-added hook entries on every reinstall.
  Qualia-owned hook commands are matched by filename and replaced;
  everything else is preserved.

### Fixed — docs / drift

- `agents/plan-checker.md`: Rule 2 heading "6 mandatory fields" →
  "7 mandatory fields" (list contained 7).
- `skills/qualia-task/SKILL.md` + `skills/qualia-plan/SKILL.md`:
  legacy `Done when:` → `Acceptance Criteria:` (matches v3.7.0 story-file
  format that plan-checker validates against).
- `docs/erp-contract.md`: add v4 fields `milestone_name` and
  `milestones[]` to the request body example and required-fields table.
  `/qualia-report` already sent these; the contract doc didn't document
  them.
- `guide.md`: "The 10 Commands" → "The Road Commands" (table has 13 rows).
- `skills/qualia-new/SKILL.md`: strip stale "Unlike v3" language.

### Tests

- +3 new regression tests (156 → 159):
  · `transition --to shipped` actually increments `deploy_count`
  · `qualia-ui journey-tree` renders milestones without crashing
  · `qualia-ui journey-tree` falls back to `projectName()` when
    `JOURNEY.md` frontmatter lacks `project:`

### Deferred to v4.1

- `allowed-tools` frontmatter sweep across 26 skills — requires
  per-skill audit to avoid accidentally blocking tool access that
  skills rely on.
- Finer-grained per-statement `WHERE`-clause scan in
  `migration-guard.js` / `pre-deploy-gate.js`.

## [4.0.0] — 2026-04-18

**Full Journey release.** `/qualia-new` now maps the entire project
arc from kickoff to client handoff upfront, and the Road can chain
itself end-to-end in `--auto` mode with only two human gates per
project. The milestone / phase / task hierarchy is locked down so the
ERP renders a clean tree, and the team stops improvising milestones
after each ship.

### The big shift

Before v4, `/qualia-new` produced a v1 ROADMAP and stopped. Each
subsequent milestone was invented when the previous one shipped,
leading to structural drift (milestones collapsing into single
phases, "Phase 0" entries at milestone level, skipped milestone
numbers). The ERP rendered a flat list of heterogeneous entries.

v4 treats the **Journey** as a first-class artifact:

```
Project
└─ Journey (all milestones defined upfront)
   └─ Milestone (a release — 2-5 total, Handoff is always last)
      └─ Phase (a feature-sized deliverable, 2-5 tasks)
         └─ Task (atomic unit, one commit, verification contract)
```

### Added

- **`.planning/JOURNEY.md`** — the North Star document. Lists every
  milestone with why-now, exit criteria, and phase sketches. Written
  during `/qualia-new`, updated on milestone closure. Hard rules: 2-5
  milestones, ≥ 2 phases per non-Handoff milestone, final milestone
  is always literally named "Handoff" with the fixed 4-phase template
  (Polish, Content + SEO, Final QA, Handoff).
- **`/qualia-new` full-journey flow** — produces JOURNEY.md +
  REQUIREMENTS.md (grouped by milestone) + ROADMAP.md (M1's phase
  detail). **Research runs unconditionally** (no more `workflow.research`
  gate). **Single approval** on the whole journey replaces multiple
  mid-flow gates.
- **`--auto` flag on `/qualia-new`, `/qualia-plan`, `/qualia-build`,
  `/qualia-verify`, `/qualia-milestone`** — chains the Road end-to-end.
  Two human gates per project total: journey approval at kickoff, and
  one pause at each milestone boundary ("Continue to M{N+1}?"). One
  halt case: gap-cycle limit exceeded on a failed phase.
- **Milestone readiness guards** in `state.js close-milestone`:
  `MILESTONE_NOT_READY` (any phase not verified) and `MILESTONE_TOO_SMALL`
  (< 2 phases), both bypassable with `--force`.
- **`tracking.json.milestones[]`** — array of closed milestone summaries
  (num, name, total_phases, phases_completed, tasks_completed,
  shipped_url, closed_at). The ERP uses this to render the project
  tree without replaying git history.
- **`tracking.json.milestone_name`** — human name of the current
  milestone ("Foundation", "Core Features", etc.). Appears in status
  bar and ERP.
- **`build_count` and `deploy_count` bump automatically** on every
  `built` and `shipped` transition. Previously always zero.
- **Pre-inline context at builder dispatch** (GSD-pattern borrowing).
  `/qualia-build` reads PROJECT.md, DESIGN.md, and every `@file`
  referenced in the task's Context BEFORE spawning the builder subagent.
  Inlines them under `<pre-loaded-context>`. Saves 3-5 Read tool calls
  per task; builder starts already oriented.
- **`qualia-ui.js journey-tree`** — ASCII ladder visualization of
  JOURNEY.md. Shipped milestones = green dot, current = teal diamond,
  future = dim open circle, Handoff = [FINAL] tag. Shown by
  `/qualia` router and at `/qualia-milestone` confirmation step.
- **`qualia-ui.js milestone-complete`** — celebration banner on
  milestone closure. Distinguishes Handoff closure ("PROJECT SHIPPED")
  from intermediate milestones ("Next: {name}").
- **5 new banner actions:** milestone ◆, journey ◯, auto ⚡,
  research ◱, roadmap ◐.
- **`qualia-report` ERP payload updated** — now sends all v4 fields
  (project_id, team_id, git_remote, milestone_name, milestones[],
  build_count, deploy_count, session_started_at, last_pushed_at) so
  the ERP renders tree and dedupes correctly.
- **`/qualia-idk` is now a real diagnostic skill**, not a `/qualia` alias.
  When the user's confusion is about *understanding the situation*
  (not picking the next command), it spawns two parallel isolated
  `Explore` subagents: one scans `.planning/` only, the other scans
  source code only. Each produces a 250-word view of its side. The
  main skill synthesizes both views + the user's stated confusion
  into a structured "What I see / What I think is happening / What
  to do next" diagnosis in plain language. Catches plan↔code drift
  that a state-only router can't see.

### Changed

- **`/qualia-handoff` is now explicit about the 4 deliverables** —
  verified production URL, updated documentation, client assets archive,
  ERP finalization. Halts if URL is down or latency > 1s, or if
  `.planning/archive/` is empty (project bypassed `/qualia-milestone`
  and has no archived milestones).
- **`/qualia-milestone` reads next milestone from JOURNEY.md** instead
  of asking the user to name it. Dedicated `journey-tree` visualization
  at confirmation + `milestone-complete` banner at close.
- **`roadmapper` agent rewritten** to produce JOURNEY + REQUIREMENTS +
  ROADMAP. **Dropped** the old "no review/deploy/handoff phases" rule —
  the Handoff milestone is now a first-class feature milestone with
  the 4 standard phases and their own requirements (HAND-01..HAND-15
  in REQUIREMENTS.md).
- **`plan-checker` Rule 2** — task story-file fields are mandatory
  (Why / Depends on / Acceptance Criteria / Validation). Inherited
  from v3.7.0's story-file format.
- **`/qualia` description scoped back to mechanical state routing.**
  Previously claimed "idk / stuck / lost / confused" triggers; those
  interpretive shades now route to `/qualia-idk`. `/qualia` stays the
  fast mechanical router ("what's my next command").
- **`templates/requirements.md`** — multi-milestone format with fixed
  Handoff section.
- **`templates/roadmap.md`** — scoped to current milestone only, with
  pointer to JOURNEY.md for the full arc.

### Tests

150 → 156 green. +6 covering: MILESTONE_NOT_READY, MILESTONE_TOO_SMALL,
milestones[] append idempotency, check-output exposure of milestones +
milestone_name, milestone summary cumulative task count (not current-
phase only), build_count bump on `built`.

### Migration

Fully additive. Projects created on v3.x continue to work:
- Plans without story-file fields: `state.js` accepts both legacy
  `Done when:` and v3.7.0 `Acceptance Criteria:` anchors.
- tracking.json missing `milestones[]` or `milestone_name`: `ensureLifetime`
  hydrates them to `[]` and `""` with zero risk.
- Projects without JOURNEY.md (legacy): `/qualia-milestone` falls back
  to asking the user for the next milestone name. Recommended migration:
  run `/qualia-map` then regenerate JOURNEY.md via the roadmapper, but
  not required.

### Borrowed ideas (credited)

- **Story-file plan format** — inspired by BMAD-METHOD's story files
  with embedded rationale and acceptance criteria (arrived in v3.7.0).
- **State-machine auto-advance** — inspired by GSD v2's `/gsd auto`
  loop (arrived in v4.0.0 as `--auto`).
- **Pre-inline context at dispatch** — inspired by GSD v2's
  pre-inlined dispatch pattern (arrived in v4.0.0 as the builder
  `<pre-loaded-context>` block).
- **Journey-as-first-class-artifact** — informed by NotebookLM
  synthesis across the framework's own documentation (arrived in
  v4.0.0 as JOURNEY.md).

## [3.7.0] — 2026-04-18

Story-file plan format. Every phase plan task now carries inline rationale,
acceptance criteria, explicit dependencies, and self-validation commands —
so builders read plans as briefs and verifiers check against observable
user behaviors, not just grep counts.

### Added

- **Story-file plan format** — `templates/plan.md` rewritten. Each task
  block now mandates: `Wave`, `Files`, `Depends on` (explicit task refs
  or `none`, not blank), `Why` (one-sentence motivation), `Acceptance
  Criteria` (2-4 observable user behaviors), `Action`, `Validation` (1-3
  grep/curl/tsc self-check commands), `Context`. Optional `Persona`
  (security | architect | ux | frontend | backend | performance).
- **Plan-summary dashboard** — new `node bin/qualia-ui.js plan-summary
  <path>` command renders the plan as a terminal dashboard: phase goal,
  waves, colored persona chips, dependency arrows, AC count, validation
  count per task. `/qualia-plan` calls it automatically after the plan
  is finalized.
- **Verifier reads per-task Acceptance Criteria** — verifier now does a
  3-layer check: phase-level Success Criteria + per-task AC + formal
  Verification Contracts. Catches "files exist but user flow doesn't
  work" cases that grep-only verification would miss.
- **Builder reads rationale** — builder agent now reads `Why`, respects
  `Depends on` (refuses to start before deps commit), runs `Validation`
  commands before `git commit`.
- **`ac_count` in validate-plan output** — `state.js validate-plan` now
  reports AC anchor count alongside `done_when_count` and `contract_count`.

### Changed

- **`plan-checker` Rule 2** — expanded from 3 mandatory fields to the 7
  story-file fields. Task without a `Why` or with vague AC now fails
  validation.
- **`plan-checker` Rule 3** — wave assignments now cross-check against
  `Depends on` lines (Wave 2+ with `Depends on: none` is a contradiction).
- **`state.js` plan preconditions** — accepts either `**Done when:**`
  (legacy) or `**Acceptance Criteria:**` (new) as the per-task anchor,
  so in-flight projects with older plans don't break on upgrade.

### Backward compatibility

Fully additive. Plans written before v3.7.0 (with `**Done when:**` only)
continue to pass state.js precondition checks. New plans generated by
the v3.7.0 planner use the story-file format with `**Acceptance
Criteria:**`. No migration required.

## [3.6.0] — 2026-04-17

P2 cleanup release. Schema reconciliation with the ERP, log retention,
and remaining state-machine polish from the audit. Third release of the
night, after v3.4.2 (P0 hotfix) and v3.5.0 (P1 hardening).

### Added

- **`tracking.json` schema additions** — new fields:
  - `team_id`, `project_id` — stable identifiers for ERP dedupe
    (composite `(team_id, project_id)` is the canonical project key,
    surviving directory renames)
  - `git_remote` — lets the ERP correlate tracking with the source repo
  - `session_started_at`, `last_pushed_at` — distinct timestamps
  - `build_count`, `deploy_count` — lifetime counters
  - `submitted_by` — mirrored at the top level (was only in /qualia-report
    payloads)
  - `lifetime.last_closed_milestone` — sentinel for close-milestone
    idempotency (introduced in v3.4.2)
- **Log retention.** Trace files in `~/.claude/.qualia-traces/` older than
  30 days are pruned on ~1% of writes. Heavy users no longer accumulate
  unbounded MB/day.
- 2 new tests covering schema additions and defensive lifetime hydrate.
  Suite is now 150 tests, all green.

### Fixed

- **`polished` transition no longer mis-marks the roadmap.** Was setting
  the LAST roadmap row to status `verified` regardless of which phase the
  user polished. Now marks every passed phase as `polished`.
- **`cmdInit` defensively hydrates partial lifetime objects.** If
  `prevLife.lifetime` was missing keys (older tracking.json format), the
  spread left `undefined`s that subsequent `+=` produced `NaN`. Defaults
  layer underneath the spread so missing keys are 0, not NaN.

### Changed

- **`docs/erp-contract.md`** documents `gap_cycles` polymorphism (object
  in tracking.json, number in `/api/v1/reports` payload — receivers must
  accept both shapes) and adds the new v3.6+ fields to the request body
  example and required-fields table.

## [3.5.0] — 2026-04-17

P1 hardening release. 9 hooks/scripts overhauled, false positives killed,
false negatives caught, cross-platform robustness throughout. Companion to
the v3.4.2 P0 hotfix shipped earlier today.

### Fixed

- **`branch-guard.js` refspec bypass.** Hook checked the *current* branch,
  so EMPLOYEE could push `feature/x:main` from a feature branch and land on
  main. Hook now parses `tool_input.command` from the Claude Code stdin
  payload and rejects any refspec whose destination is `main` or `master`.
  Block messages also routed to stderr (Claude Code surfaces stderr in
  block reasons) and `shell: process.platform === "win32"` added to git
  spawn for Windows reliability.
- **`migration-guard.js` false positives.** SQL comments (`-- …` lines and
  `/* … */` blocks) are now stripped before pattern matching, so
  commented-out `DROP TABLE` calls no longer block. File-path regex
  tightened from `migration|migrate|\.sql$` to
  `(^|/)migrations?/` OR `\.sql$` — `MigrationModal.tsx` and `migrations.md`
  no longer trigger scans. `CREATE TEMP TABLE` and partition tables exempt
  from the RLS requirement.
- **`migration-guard.js` false negatives.** New blockers: `ALTER TABLE …
  DROP COLUMN`, `DROP DATABASE`, `DROP SCHEMA … CASCADE`, `UPDATE …` without
  WHERE, `GRANT … TO PUBLIC`. Edit-tool calls now scan `old_string +
  new_string + content` (was only new_string).
- **`pre-deploy-gate.js` `service_role` scanner.** Tightened from literal
  substring match to `\bservice_role` regex with per-line exemptions for
  comments (`//`, `/*`, `*`), `process.env.SUPABASE_SERVICE_ROLE` reads,
  and explicit `eslint-disable` allowlists. Walk now excludes `dist/`,
  `out/`, `build/`, `coverage/`, `.next/`, `.vercel/`, `.turbo/` so
  post-build artifacts don't slow the gate or false-positive on minified
  output. Block messages routed to stderr.
- **`auto-update.js` 24-hour blackout fixed.** Cache timestamp was written
  *before* the npm version fetch — failed fetches suppressed re-checks for
  24h. Now written only after successful fetch.
- **`auto-update.js` no longer corrupts running sessions.** OWNER branch
  used to spawn `npx qualia-framework@latest install` in the background,
  which rewrote `~/.claude/settings.json` mid-session. Both OWNER and
  EMPLOYEE now write the same notification file; user must explicitly run
  `npx qualia-framework update` to actually upgrade.
- **`pre-compact.js` silent commit failures.** Auto-commit ran with
  `stdio: "ignore"` and could fail invisibly when user had pre-commit
  hooks or commit signing → STATE.md not persisted before context
  compaction → context loss. Commit now uses `--no-verify --no-gpg-sign
  --author="Qualia Framework <bot@qualia.solutions>"` so it can't be
  blocked by user hooks. Commit status traced for visibility.
- **`statusline.js` 3-spawns-per-prompt.** Collapsed three separate `git`
  invocations into a single `git status -b --porcelain=v1` call. Saves
  ~300ms per cold prompt on Windows. Cache write is now atomic
  (`tmp + rename`) so concurrent prompts can't produce corrupt cache.
- **`state.js` CRLF tolerance.** Every `^Field:\s*(.+)$/m` regex is now
  `(.+?)\r?$/m` so Windows editors saving STATE.md with CRLF don't leak
  `\r` into captured `phase_name`, `status`, `assigned_to`.
- **`cli.js cmdMigrate` no longer adds duplicate hooks.** Old check used
  substring match against the absolute path; if home directory ever
  changed, the OLD path didn't match the NEW path and `migrate` appended a
  second entry. Now compares basenames, so `migrate` is idempotent
  regardless of path changes.

### Cleaned

- **Skill agent path refs corrected.** `qualia-verify`, `qualia-build`
  used `@agents/<name>.md` (relative to project cwd, broken from
  `.planning/`). All skills now use `@~/.claude/agents/<name>.md`
  consistently.
- **`qualia-quick` description gained trigger phrases** so the smart
  router actually fires it on natural-language requests.
- **`qualia-map` skill uses `Agent(...)`** instead of legacy `Task(...)`,
  matching framework convention everywhere else.
- **`qualia-idk` skill removed.** Fully redundant — `qualia` (the router)
  already lists "idk" as a trigger phrase.
- **`templates/help.html` regenerated.** Now lists all 26 skills (was 17).
  Grouped: Road, Phase Depth, Quality, Quick Paths, Knowledge, Session,
  Navigation, Meta. Version pill bumped to v3.5.0.

### Added

- **GitHub Actions CI workflow.** `.github/workflows/test.yml` runs
  `npm test` on Ubuntu + macOS + Windows × Node 18/20/22. Triggered on
  every push and PR. 5-minute timeout per job. Tests are no longer
  "local-only" — every commit is verified across the supported matrix.
- 11 new tests covering refspec bypass (3), comment-stripped SQL,
  ALTER TABLE DROP COLUMN, DROP DATABASE, UPDATE-without-WHERE, GRANT TO
  PUBLIC, TEMP-table RLS exemption, MigrationModal.tsx bypass, CRLF
  STATE.md parsing. Suite is now 148 tests, all green.

## [3.4.2] — 2026-04-17

P0 hotfix release. Closes 7 critical bugs surfaced by a deep audit.

### Fixed

- **`pre-push.js` stamp now actually reaches the remote.** Previously the hook
  wrote `last_commit` + `last_updated` to `tracking.json` and `git add`-ed it,
  but the push itself ran on a snapshot prepared before the hook — so the
  stamp never made it onto the wire. The ERP, which reads `tracking.json`
  straight from git, saw stale data forever. Hook now creates a real bot
  commit (`--no-verify --no-gpg-sign --author="Qualia Framework <bot@…>"`)
  so the stamp ships with the push that triggered it.
- **`session-start.js` no longer silently fails on first run.** `TEAL`,
  `RESET`, `DIM` ANSI constants were referenced in the no-project welcome
  branch but never defined in the file (only in `bin/install.js`). The outer
  `try/catch` swallowed the `ReferenceError`, so new users saw a blank
  session. Constants now defined at top of file.
- **`/qualia-optimize` works on fresh installs.** Skill spawned
  `frontend-agent`, `backend-agent`, `performance-oracle`,
  `architecture-strategist` — none of which ship with the framework.
  Rewritten to use `general-purpose` with the same specialized prompts.
- **`.qualia-config.json` is now mode 0600.** Previously written with default
  0644, so any local user could edit `role` to `OWNER` and bypass
  `branch-guard`. The role bit is now access-restricted.
- **Default ERP key no longer shipped.** Installs no longer write the
  hardcoded literal `"qualia-claude-2026"`. New sources, in order:
  `$QUALIA_ERP_KEY` env var → existing `~/.claude/.erp-api-key` →
  ERP disabled until configured. Also chmods existing key file to 0600.
- **Atomic file writes for `STATE.md` and `tracking.json`.** Previous
  direct `writeFileSync` could leave half-written files on SIGINT, OOM, or
  AV scanner interruption — the next `cmdCheck` would return `NO_PROJECT`.
  All writes now go through `tmp + rename` (atomic on POSIX, near-atomic
  on NTFS). Added `.planning/.state.lock` exclusive lockfile so two
  concurrent state.js mutations can't race.
- **`close-milestone` is now idempotent.** Sentinel `last_closed_milestone`
  prevents re-running from double-counting `milestones_completed` and
  `total_phases`. Pass `--force` to deliberately re-close.
- **`backfill-lifetime` no longer destroys history.** Now uses `Math.max`
  instead of overwrite — recomputed values from the current milestone's
  STATE.md cannot reduce lifetime counters that were already accumulated
  by `close-milestone`.

### Added

- **`init` refuses to clobber an existing project.** `state.js init` against
  an active `.planning/STATE.md` now errors with `ALREADY_INITIALIZED`.
  Pass `--force` to re-initialize (lifetime is still preserved).
- **`_trace` signature normalized to 3 args** — `_trace(event, result, data)`.
  Old call sites passing the result string in the data slot produced
  malformed JSONL. Telemetry is now well-formed.
- 8 new tests covering the fixes — pre-push behavioral mutation +
  bot-commit, init guard, close-milestone idempotency, backfill Math.max,
  atomic write cleanup, lock release. Suite is now 137 tests, all green.

### Migration

- Existing installs will pick up the fixes via auto-update or
  `npx qualia-framework@latest install`.
- The `qualia-claude-2026` shared key is grandfathered server-side for 30
  days. After that, every employee needs a per-user token.
- `init --force` is required to re-initialize an existing project (was
  silent before — a footgun).

## [3.4.1] — 2026-04-14

### Added

- **`state.js backfill-lifetime` command** — reconstructs lifetime counters from
  STATE.md roadmap + plan files for existing projects upgrading from pre-v3.4.0.
  Idempotent and safe to run multiple times. Use after updating to sync historical data.
- 2 new tests for backfill (53 state tests, 129 total).

## [3.4.0] — 2026-04-14

ERP tracking was systematically wrong — milestone transitions destroyed all
historical data, phase advances reset task counts, quick/task work was never
counted. This release adds lifetime counters that survive every reset.

### Added

- **`lifetime` object in tracking.json** — `tasks_completed`, `phases_completed`,
  `milestones_completed`, `total_phases`. These counters accumulate and NEVER
  reset on init or phase advance. The ERP can now see the real total.
- **`milestone` field in tracking.json** — current milestone number (1-indexed),
  survives across `state.js init` calls.
- **`state.js close-milestone` command** — snapshots the closing milestone's data
  into lifetime before init resets current-phase fields.
- **`--tasks-done N` on note/activity transitions** — `/qualia-quick` and
  `/qualia-task` now increment `lifetime.tasks_completed` by 1 per invocation.
- **`cmdCheck()` includes milestone + lifetime** in JSON output for ERP/statusline.
- **tracking.json archived during milestone closeout** — previously only STATE.md
  and ROADMAP.md were archived.
- 12 new tests covering lifetime preservation, cross-phase accumulation,
  close-milestone, backward compat. Suite is now 51 state tests, 129 total.

### Fixed

- **`state.js init` no longer destroys historical data.** It now reads the existing
  tracking.json and preserves `milestone` and `lifetime` fields. Current-phase
  fields still reset as expected.
- **`verified(pass)` accumulates before resetting.** Task counts are added to
  `lifetime.tasks_completed` and `lifetime.phases_completed` BEFORE `tasks_done`
  resets to 0. The last phase of a milestone also counts (accumulation moved
  outside the auto-advance conditional).
- **`/qualia-report` endpoint fixed.** Was posting multipart to
  `/api/claude/report-upload`; now sends structured JSON to `/api/v1/reports`
  matching the ERP contract, including milestone + lifetime data.
- Test 38 updated: `--force` bypasses `INVALID_PLAN` (matches v3.3.2 behavior).

### Changed

- `templates/tracking.json` includes `milestone` and `lifetime` fields.
- `docs/erp-contract.md` documents the new fields in request/response schemas.
- `skills/qualia-milestone/SKILL.md` calls `close-milestone` before `init`.

## [3.3.2] — 2026-04-13

Patch release. `state.js transition --force` now bypasses `INVALID_PLAN`
errors so retroactive bookkeeping works.

### Fixed

- **`state.js transition --to planned --force` now unblocks retroactive
  documentation.** When a phase is built without `/qualia-plan` (e.g. an
  employee shipped the work before the framework was wired up), the
  retroactive plan file is documentation, not a runnable plan — so it
  often lacks `**Done when:**` markers. Previously `--force` only
  bypassed status-ordering errors and still hard-failed on
  `INVALID_PLAN`, leaving STATE.md stuck behind reality. `--force` now
  also bypasses `INVALID_PLAN`. It still refuses `MISSING_FILE` /
  `MISSING_ARG` — those would point the state machine at nothing.
- New test: `--force bypasses INVALID_PLAN (retroactive bookkeeping)`,
  plus a sanity test that `--force` still rejects `MISSING_FILE`.
  Suite is now 129 tests, all green.

## [3.3.1] — 2026-04-13

Patch release. Fixes broken `@path` references inside the v3.3.0 deep-flow
skills that were caught by post-release verification. Subagent spawning
itself was unaffected (resolves via frontmatter `name:`), but the literal
`Read your role: @~/.claude/agents/qualia-{name}.md` instruction passed
into the spawned agent's prompt would fail to resolve the file because
agents ship without the `qualia-` prefix (e.g. `researcher.md`, not
`qualia-researcher.md`).

### Fixed

- `skills/qualia-new/SKILL.md` — 6 refs rewritten (4× researcher,
  1× research-synthesizer, 1× roadmapper).
- `skills/qualia-plan/SKILL.md` — 3 refs rewritten (2× planner,
  1× plan-checker).
- `skills/qualia-research/SKILL.md` — 1 researcher ref rewritten.
- `skills/qualia-milestone/SKILL.md` — 1 roadmapper ref rewritten.
- `skills/qualia-optimize/SKILL.md` — removed dead call to
  `~/.claude/qualia-framework/bin/qualia-tools.js` (never shipped in v3.x);
  replaced with a plain `git add && git commit`.

All 128 tests still green.

## [3.3.0] — 2026-04-13

Deep flow release. Adds the comprehensive v2.6-era capabilities (research, plan-check,
requirements traceability, roadmap generation) back into the v3 architecture — ~2k
lines total instead of the v2.6 55k bloat. Same command surface for end users. No
migration needed — existing projects keep working.

### Added

- **`/qualia-new` comprehensive flow** — now runs deep questioning → 4 parallel
  research agents → requirements with REQ-IDs → ROADMAP.md with phases → approval
  gate. The 323-line wizard is replaced by a structured pipeline. Still ships with
  `--quick` flag for trivial projects.
- **`/qualia-plan` plan-checker loop** — planner output is now validated by a
  plan-checker agent against 7 rules (task specificity, wave assignment, contract
  coverage, etc.). Up to 3 revision cycles. `--skip-check` flag available for
  emergencies.
- **4 new skills:**
  - `/qualia-discuss {N}` — capture locked decisions before planning a phase
  - `/qualia-research {N}` — deep research for a niche phase (Context7/WebFetch/WebSearch)
  - `/qualia-map` — brownfield codebase mapping (4 parallel scanners)
  - `/qualia-milestone` — close current milestone, open next
- **4 new agents:**
  - `qualia-researcher` — single researcher agent invoked 4× in parallel with a
    `<dimension>` arg (stack/features/architecture/pitfalls). No more 4 duplicate
    agent files.
  - `qualia-research-synthesizer` — merges 4 research outputs into SUMMARY.md
  - `qualia-roadmapper` — produces REQUIREMENTS.md + ROADMAP.md from PROJECT.md
    + research synthesis
  - `qualia-plan-checker` — validates plans against 7 rules
- **New templates** in `~/.claude/qualia-templates/`:
  - `requirements.md` — REQ-ID traceability format
  - `roadmap.md` — phase structure with REQ mapping
  - `phase-context.md` — output shape for `/qualia-discuss`
  - `research-project/STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md`
  - `projects/website.md, ai-agent.md, voice-agent.md, mobile-app.md` — per-type
    phase templates
- **New references directory** `~/.claude/qualia-references/`:
  - `questioning.md` — the methodology guide loaded by `/qualia-new` during the
    questioning stage
- **`install.js` recursive template copy** — templates/ now supports nested
  directories (projects/, research-project/) via a new `copyTree` helper.
- **`install.js` legacy cleanup** — automatically removes orphaned v2.6 install
  cruft from `~/.claude/qualia-framework/` and any broken `~/.claude/agents/qualia-*.md`
  files that reference the old `/home/qualia/` paths. Runs on upgrade.

### Changed

- **`/qualia-new` replaces the 323-line inline wizard** with a structured 14-step
  process that delegates research/requirements/roadmap generation to specialized
  agents. Still feels the same to the user — same banner, same question style,
  same terminal output — but the backing logic is comprehensive instead of flat.
- **`/qualia-plan` adds the plan-checker revision loop** by default. Existing
  behavior (single planner call) is available via `--skip-check`.
- **ROADMAP.md is now first-class.** v3.0 → v3.2.1 didn't create ROADMAP.md; this
  release does. The ERP sync parser can now read structured roadmap data instead
  of falling back to STATE.md table parsing.

### Compatibility

- **Existing v3.2.1 projects:** continue to work unchanged. The new features are
  only triggered for newly-initialized projects.
- **v3.2.1 skill flow:** same command names, same aesthetics, same statusline.
- **Statusline:** unchanged (`state.js` still writes the same `phase`,
  `total_phases`, `status` fields to `tracking.json`).

### Philosophy

The v2.6 framework was 55k lines because it duplicated bash boilerplate across
30 workflow files and built mega-agents (43KB planner alone). This release ports
the *concepts* (research, plan-check, requirements, roadmap) into the v3
architecture (small focused agents, inline skills, single state tool). Total
added: ~2k lines. Philosophy preserved: skills orchestrate, agents focus.

## [3.2.1] — 2026-04-12

Patch release. Republishes the v3.2.0 feature set on top of the committed
main branch. The original v3.2.0 was published from an uncommitted working
tree earlier in the day and then rebased onto `origin/main` during cleanup;
this release captures the post-rebase state — correct `repository.url`,
fixed test assertions (hook count 8 → 7), and minor comment tweaks.

No behavior changes from v3.2.0 for end users.

## [3.2.0] — 2026-04-12

Sticky update notifications for employees, env access unblocked for the whole
team, new `/qualia-optimize` deep optimization skill.

### Added
- **Sticky update banner** for EMPLOYEE installs. When `auto-update.js` detects
  a newer version on npm, it writes `.qualia-update-available.json` instead of
  auto-installing. `session-start.js` renders a visible banner every session
  until the employee runs `npx qualia-framework@latest install`. OWNER still
  auto-updates silently — never sees the banner.
- **`qualia-optimize`** skill — deep optimization pass that reads `.planning/`
  AND the codebase together. Spawns parallel specialists (frontend, backend,
  performance, architecture). Modes: `full`, `--perf`, `--ui`, `--backend`,
  `--alignment`, `--fix`.
- `bin/qualia-ui.js` — new `update <current> <latest>` command renders the
  sticky banner.
- `bin/install.js` — new `DEPRECATED_HOOKS` cleanup list proactively removes
  retired hooks from existing installs during upgrade.

### Changed
- `hooks/auto-update.js` now branches on `cfg.role`. OWNER gets the silent
  background install (unchanged). EMPLOYEE writes the sticky notification so
  they can no longer ignore updates by accident.

### Removed
- **`hooks/block-env-edit.js`** — team decision. Claude now has full read/write
  on `.env*` files across the team. `install.js` no longer wires this hook and
  `DEPRECATED_HOOKS` purges it from existing installs on upgrade.
- Employee role descriptions updated — no longer claim "cannot edit .env files".

## [3.1.0] — 2026-04-12

Package rename and gap closure release. The package is now `qualia-framework`
(dropping the `-v2` suffix). Adds settings migration, skill outcome scoring,
analytics, cross-platform tests, and fills all v3.0.0 gaps.

### Changed
- **Package renamed** `qualia-framework-v2` → `qualia-framework`. All CLI
  commands are now `qualia-framework install`, `qualia-framework update`, etc.
  The old name continues to work via npm alias.

### Added
- **`qualia-framework migrate`** — upgrades v2 settings to v3 without
  reinstalling. Wires missing hooks, env vars, status line, and MCP config.
- **`qualia-framework analytics`** — aggregates hook telemetry and shows
  first-pass verification rate, gap cycles, per-hook breakdown.
- **Skill outcome scoring** — state transitions now write trace entries to
  `~/.claude/.qualia-traces/` for plan→outcome correlation tracking.
- **Verification contract format validation** — `validate-plan` now checks
  contract structure (check-type, command, expected, fail-if fields) with
  warnings for invalid types or missing fields. Backward compatible.
- **next-devtools-mcp integration** — install and migrate now configure
  `next-devtools-mcp@0.3.10` as an MCP server for runtime error visibility
  in Next.js 16+ projects.
- **Cross-platform Node.js test runner** — 134 tests using `node:test`,
  replacing bash-only test scripts. Works on Fedora, EndeavourOS, Windows.
- **ERP API contract documentation** — `docs/erp-contract.md` specifying
  endpoints, auth, request/response shapes, rate limits, and security.

### Fixed
- Contract validation regex in `validate-plan` — section extraction was
  always returning empty due to `$` matching end-of-line in multiline mode.

## [3.0.0] — 2026-04-11

Harness engineering release. Applies lessons from Anthropic's "Harness Design
for Long-Running Apps" article. The verifier becomes a scored evaluator, the
planner generates verification contracts, guards get smarter, and the harness
gains observability.

### Added
- **Scored evaluator rubric** — verifier now scores on 4 dimensions
  (Correctness, Completeness, Wiring, Quality), each 1-5. Hard threshold:
  any score < 3 = FAIL. Two few-shot calibration examples included.
- **Verification contracts** — planner generates testable contract entries
  (`file-exists`, `grep-match`, `command-exit`, `behavioral`) per task.
  Verifier executes contracts before ad-hoc verification.
- **Plan content validation** — `state.js` now rejects plans with no task
  headers or missing "Done when" criteria. New `validate-plan` subcommand.
- **Configurable gap cycle limit** — default remains 2; override via
  `tracking.json.gap_cycle_limit` or `PROJECT.md gap_cycle_limit:` field.
- **Pre-deploy gate: Server Component detection** — `route.ts`,
  `middleware.ts`, `app/api/` paths, and `"use server"` directive files are
  now exempt from the service_role leak scan.
- **Dynamic team management** — `qualia-framework team list|add|remove`
  CLI commands. Team dict externalized to `~/.claude/.qualia-team.json`;
  falls back to embedded defaults.
- **ERP decoupling** — ERP config (`enabled`, `url`, `api_key_file`) stored
  in `.qualia-config.json`. `/qualia-report` skips upload when disabled.
- **Hook telemetry** — all 8 hooks write JSONL traces to
  `~/.claude/.qualia-traces/YYYY-MM-DD.jsonl`. New `traces` CLI command
  shows recent hook activity.
- **Build recovery tags** — `/qualia-build` creates `pre-build-phase-{N}`
  git tag before execution. `--force` flag on `state.js transition` enables
  state recovery after failed builds.
- **Knowledge base dedup** — `/qualia-learn` checks for existing entries
  before appending. Entries now include UUID and ISO timestamp.
- New tests for deploy gate, state machine, and guard hooks.
  Total: 152 tests passing (50 hooks + 40 state + 48 bin + 14 statusline).

### Fixed
- **block-env-edit + branch-guard hooks not wired** — both hooks were
  copied during install but never registered in `settings.json`. Employees
  could push to main and edit `.env` files unchecked. Now registered in
  `PreToolUse` hooks.
- **Auto-update background script broken** — detached child script used
  `return` at top level in `node -e`, which is a SyntaxError. The entire
  update check silently failed every time. Replaced with `process.exit(0)`.
- **branch-guard exit code** — used `exit(1)` (hook error) instead of
  `exit(2)` (clean block). Now consistent with block-env-edit and
  migration-guard.
- Install summary hardcoded "Hooks: 6" despite installing 8. Fixed.
- Duplicate `statusline.js` copy in installer removed.

### Changed
- `agents/verifier.md` — complete rewrite of the Scoring section into a
  structured 4-criterion rubric with calibration examples and contract
  verification workflow.
- `agents/planner.md` — new Verification Contracts section with contract
  format, types, and rules.
- `templates/plan.md` — includes Verification Contract section.
- `bin/state.js` — `getGapCycleLimit()`, `cmdValidatePlan()`, `--force`
  flag, `gap_cycle_limit` in check output, plan content validation in
  preconditions.
- `bin/install.js` — `CLAUDE_DIR`/`FRAMEWORK_DIR` moved above `loadTeam()`;
  team dict externalized via `loadTeam()`; ERP config in `.qualia-config.json`.
- `bin/cli.js` — `team`, `traces` commands; uninstall cleans team file and
  traces dir; updated help text.
- `bin/qualia-ui.js` — gap cycle display uses dynamic limit from state.
- `hooks/pre-deploy-gate.js` — 4 new server-side file exemptions.
- `skills/qualia-verify/SKILL.md` — spawn prompt references contracts.
- `skills/qualia-report/SKILL.md` — config-driven ERP upload.
- `skills/qualia-build/SKILL.md` — recovery point step before execution.
- `skills/qualia-learn/SKILL.md` — dedup check, UUID+timestamp format.

## [2.10.0] — 2026-04-11

Modern icon system, statusline context indicators.

### Added
- Statusline now shows memory count (`⊙`), hooks count (`⚙`), and skills count (`✦`) on the top bar.
- Each Qualia action has a unique, meaningful glyph: `⬢` router, `✦` new, `▣` plan, `⚙` build,
  `◎` verify, `✧` polish, `△` ship, `⇢` handoff, `▤` report, `⊘` debug, `⊙` learn,
  `⏸` pause, `▶` resume, `⊛` review, `◈` design, `⚡` quick, `▪` task, `⟐` gaps.

### Changed
- Replaced all `◆` diamond glyphs with `⬢` hexagon (Qualia brand mark) across all files:
  qualia-ui.js, statusline.js, install.js, cli.js, hooks, and skill documentation.
- Updated utility glyphs: spawn (`⬡`), wave (`»`), next (`⟶`), banner separator (`▸`).
- Spinner tips and hook status messages now use `⬢` prefix.

## [2.9.0] — 2026-04-11

Housekeeping, test coverage, and release hygiene.

### Added
- GitHub Actions CI workflow — runs the full test suite on every push and PR.
- Behavioral test suites for `bin/cli.js`, `bin/install.js`, `bin/qualia-ui.js`,
  `bin/statusline.js`, and the `pre-deploy-gate` / `branch-guard` hooks.
- `CHANGELOG.md` — this file. Backfilled from commit history.
- `npx qualia-framework uninstall` — clean, surgical removal of the framework
  from `~/.claude/`. Supports `--yes` / `-y` for scripted use. Preserves
  user-customized `CLAUDE.md` and non-Qualia entries in `settings.json`.
  Optionally preserves the knowledge base (default Yes).
- Seeded knowledge base content — `learned-patterns.md` and `common-fixes.md`
  now ship with real entries harvested from v2.7–v2.8 work, so new installs
  have something to learn from immediately instead of empty stubs.

### Changed
- `bin/cli.js` version check: `execSync("npm view ... 2>/dev/null")` → `spawnSync`
  with argv. Removes the last bash-only redirect from the CLI, matching the
  cross-platform pattern established in v2.8.0.
- `STATE.md` parser hardened against edge cases (missing sections, malformed
  phase headers, non-ASCII phase names).
- `README.md` — adds a Changelog section and documents the `uninstall` command.

## [2.8.1] — 2026-04-10

Small patch release. Dogfood-driven: caught while installing v2.8.0 on a real
machine immediately after publishing — typing `QS-FAWZI-O1` (letter O) instead
of `QS-FAWZI-01` (digit zero) was rejected by the exact-match TEAM lookup.

### Added
- `resolveTeamCode(input)` helper in `bin/install.js`. Normalizes case, trims
  whitespace, and replaces letter `O` → digit `0` in the numeric suffix only
  (after the last dash).
- Invalid-code error message now echoes the code the user typed and adds a tip
  about the `O` vs `0` convention.

### Fixed
- Install codes with letter `O` in the numeric suffix (`QS-FAWZI-O1`) are now
  tolerated and normalized to the canonical form.
- `package.json` `repository.url` and `homepage` corrected from the
  hyphenated `qualia-solutions` owner to the real CamelCase `Qualiasolutions`
  GitHub org. npm had been silently auto-normalizing on publish but the
  metadata was still wrong.
- Critical constraint: the O→0 normalization only touches the segment after
  the last dash, so `QS-MOAYAD-03` (real `O` in the name) is preserved.
  Verified against 13 test cases including the adversarial `qs-moayad-O3`.

## [2.8.0] — 2026-04-10

Cross-platform hardening, real test coverage for the state machine, and a
pure-Node status line. Closes 6 audit findings in one pass. Windows, macOS,
and Linux all get a more honest, more tested, more portable framework.

### Added
- `bin/statusline.js` — pure Node status line (~200 lines, zero deps). Same
  teal palette and 2-line layout as the previous bash version. Uses
  `os.tmpdir()` with a per-user cache filename instead of hardcoded `/tmp`.
- `tests/state.test.sh` — 22 behavioral tests covering `cmdInit`, `cmdCheck`,
  every `VALID_FROM` transition, every precondition failure mode
  (`PRECONDITION_FAILED`, `MISSING_FILE`, `MISSING_ARG`, `INVALID_STATUS`),
  the gap-cycle circuit breaker (1 → 2 → blocked → reset on pass), and
  special note/activity transitions.
- `package.json` `test` script now runs both the hooks and state suites.
  Total: 56 tests (34 hooks + 22 state), all passing.

### Changed
- `bin/qualia-ui.js` `readState`: `execSync` shell string → `spawnSync` argv.
  Fixes the Windows banner when the username has spaces and removes the
  bash-only `2>/dev/null` redirect.
- `bin/cli.js` `cmdUpdate`: replaced bash `<<<` here-string with `spawnSync`
  + `input:`. Manual `npx qualia-framework update` now works on Windows
  and on Debian/Ubuntu (where `/bin/sh` is `dash`, which also lacks `<<<`).
- `skills/qualia-skill-new/SKILL.md` — removed 5 hardcoded
  `/home/qualia/Projects/...` paths in favor of `${FRAMEWORK_DIR}` detection
  (env var → git origin check → ask user). The skill no longer violates its
  own anti-patterns section.
- `bin/install.js` wires the status line as `node ~/.claude/bin/statusline.js`
  instead of shelling out to bash. Scripts count updated 2 → 3 in the
  install summary.
- README truthfulness pass: "3 rules" → "4 rules"; "auto-loaded by skills"
  → "loaded by /qualia-plan, /qualia-debug, /qualia-new" (only those skills
  actually cat the knowledge files); "No Git Bash, no WSL, no bash dependency"
  claim rescoped to be accurate (hooks and status line are pure Node; skills
  run through Claude Code's own Bash tool); "Production-Grade Hooks" bullet
  now says "All 8 hooks" instead of leaving the count ambiguous.

### Fixed
- Windows session-start banner now shows phase/status even when the user's
  path contains spaces.
- Manual `update` command no longer fails silently on Windows or Debian/Ubuntu.
- The `qualia-skill-new` skill no longer embeds developer-specific absolute
  paths into generated skills.

### Removed
- `bin/statusline.sh` — replaced by `bin/statusline.js`. "Every hook and the
  status line are pure Node.js" is now a claim the framework actually keeps.
- `SubagentStart` echo hook from `install.js` — cosmetic-only, and it shipped
  broken output on Windows cmd.exe due to literal single quotes.
- Undocumented `settings.effortLevel = "high"` no-op from `install.js`.

## [2.7.0] — 2026-04-10

Every hook is now pure Node.js with zero shell dependencies. Works identically
on Windows 10/11, macOS, and Linux. The only runtime requirement is Node.js
18+, which was already required for `state.js`, `qualia-ui.js`, and the
installer itself. Motivation: the previous `.sh` hooks required bash in PATH,
which on Windows means Git Bash — an extra install most team members don't
have. Windows team members had been running the framework with silently
broken hooks for weeks.

### Added
- 8 pure-Node hooks: `session-start.js`, `auto-update.js`, `branch-guard.js`,
  `block-env-edit.js`, `migration-guard.js`, `pre-push.js`, `pre-compact.js`,
  `pre-deploy-gate.js`.
- `tests/hooks.test.sh` now exercises `.js` hooks via stdin-piped JSON input,
  including a Windows-path test case (`C:\project\.env.local` should block).
- 34/34 hook tests passing (up from 21).

### Changed
- `install.js` writes hook commands as `node "<absolute-path>"` in
  `settings.json`, avoiding any bash/Git Bash requirement on Windows.
- `install.js` deletes orphaned `.sh` files from `~/.claude/hooks/` before
  copying `.js` hooks (clean upgrade path for existing v2.5/v2.6 installs).
- `chmod 755` on `.js` files (no-op on Windows, harmless).
- `block-env-edit.js` normalizes Windows backslashes in file paths.
- `pre-deploy-gate.js` uses a Node directory walker — no `grep -r`, no `find`.

### Fixed
- Relative `HOOKS_DIR` bug that broke tests after `cd` into subshells.

### Removed
- All 8 `.sh` hook files. Replaced 1:1 with `.js` equivalents.

## [2.6.1] — 2026-04-09

### Fixed
- `session-start.js` hook never exits with a non-zero code. Previously, a
  transient failure in the banner renderer could surface as a hard error on
  session start, which felt broken even though nothing was actually wrong.

## [2.6.0] — 2026-04-09

### Added
- `qa-browser` agent for browser-based verification.
- `qualia-skill-new` skill — authoring tool for new skills and agents.
- `bin/qualia-ui.js` cosmetics library — consistent banners across every
  skill with a shared teal palette and layout.
- Memory activation: framework now participates in Claude Code's memory
  system instead of opting out.

### Fixed
- Deploy gate false positives reduced.

## [2.5.0] — 2026-04-08

### Added
- `auto-update.js` hook — daily silent update in a detached subprocess so
  teams stay on the current version without manual `update` calls.
- Design best practices baked into the entire build pipeline (planner,
  builder, verifier, and the design rules).

### Changed
- Quality gates are now role-aware: OWNER bypasses env/branch/sudo
  restrictions; EMPLOYEE is held to the original rules.

### Fixed
- `/qualia-report` ERP upload path and API key setup flow in the installer.

## [2.4.0] — 2026-04-08

### Added
- `version` and `update` CLI commands (`npx qualia-framework version`,
  `npx qualia-framework update`).
- Knowledge system: `~/.claude/knowledge/` with `learned-patterns.md`,
  `common-fixes.md`, `client-prefs.md`.
- `/qualia-learn` skill for capturing patterns, fixes, and client prefs to
  the knowledge base.

## [2.3.0] — 2026-04-08

### Added
- `bin/state.js` state machine — validates preconditions, updates `STATE.md`
  and `tracking.json` atomically, tracks gap-closure cycles.
- Smart router (`/qualia`) that reads project state and tells you the exact
  next command.
- `/qualia-idk` as an alias for the smart router.

### Changed
- All 10 skills replaced manual `STATE.md` / `tracking.json` updates with
  `state.js` calls.
- `/qualia-report` rewritten to drop DOCX generation and raw `curl` usage.

### Fixed
- Report generation pipeline.

## [2.2.0] — 2026-04-08

### Added
- Ports of 6 skills from v1: `/qualia-idk`, `/qualia-design`, `/qualia-debug`,
  `/qualia-review`, `/qualia-pause`, `/qualia-resume`.
- `pre-push` hook rewritten to Node.js.
- `state.js` install step added to the installer.
- `gap_cycles` counter added to the `tracking.json` template.

## [2.1.2] — 2026-04-08

### Added
- Install codes for Rama and Sally (team expansion).

## [2.1.1] — 2026-04-07

Safeguards release, incorporating lessons from the v1 code review.

### Added
- Task validation at plan-time.
- Stub detection in the verifier (flags `// TODO` and placeholder-only files).
- Scope discipline checks.
- Explicit deviation criteria.
- Routing clarity improvements in `/qualia`.
- Gap-closure documentation.
- Hook tests (first pass).

## [2.1.0] — 2026-04-07

### Added
- Full agent wiring: planner, builder, verifier — each in an isolated
  subagent context.
- Full hook system (first production-grade pass).
- Install codes and role-based access control (OWNER vs EMPLOYEE).

### Changed
- README rewritten with architecture rationale and accurate counts.

## [2.0.0] — 2026-04-07

Initial v2 release. Framework rewrite with agent wiring, full hook system,
and install codes.

### Added
- Initial `qualia-framework` repo with full hook system and agent wiring.
- Core skills, agents, hooks, rules, and templates.
- `bin/install.js` and `bin/cli.js` installer / CLI.

[Unreleased]: https://github.com/Qualiasolutions/qualia-framework/compare/v4.0.3...HEAD
[4.0.3]: https://github.com/Qualiasolutions/qualia-framework/compare/v4.0.2...v4.0.3
[4.0.2]: https://github.com/Qualiasolutions/qualia-framework/compare/v4.0.1...v4.0.2
[4.0.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v4.0.0...v4.0.1
[4.0.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.7.0...v4.0.0
[3.7.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.6.0...v3.7.0
[3.6.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.5.0...v3.6.0
[3.5.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.4.2...v3.5.0
[3.4.2]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.4.1...v3.4.2
[3.4.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.3.2...v3.4.0
[3.3.2]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.3.1...v3.3.2
[3.3.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.3.0...v3.3.1
[3.3.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.2.1...v3.3.0
[3.2.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.2.0...v3.2.1
[3.2.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.1.0...v3.2.0
[3.1.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.10.0...v3.0.0
[2.10.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.9.0...v2.10.0
[2.9.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.8.1...v2.9.0
[2.8.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.8.0...v2.8.1
[2.8.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.7.0...v2.8.0
[2.7.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.6.1...v2.7.0
[2.6.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.1.2...v2.2.0
[2.1.2]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/Qualiasolutions/qualia-framework/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Qualiasolutions/qualia-framework/releases/tag/v2.0.0
