# Changelog

All notable changes to the Qualia Framework are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Note: git tags for historical versions were not retained; commit references are approximate
> and dates reflect commit history rather than npm publish timestamps.

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

[Unreleased]: https://github.com/Qualiasolutions/qualia-framework/compare/v3.0.0...HEAD
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
