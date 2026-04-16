# Session Report — 2026-04-17

**Project:** qualia-framework
**Branch:** main (merged from feature/audit-fixes)
**Released:** v3.4.2 → v3.5.0 → v3.6.0 (3 releases, same night)
**Owner:** Fawzi Goussous
**Duration:** ~3 hours

## What shipped

Three sequential releases, all on npm at `qualia-framework@3.6.0` (latest).

| Tag    | Theme              | Commit  | Files | Tests added |
|--------|--------------------|---------|-------|-------------|
| v3.4.2 | P0 hotfix          | 874e04a | 8     | 8           |
| v3.5.0 | P1 hardening       | 8c8603e | 18    | 11          |
| v3.6.0 | P2 cleanup         | f07478d | 7     | 2           |

**Test suite:** 137 → 148 → 150 (+21 net, all green)
**Package:** 165 kB, 79 files

## What started this

Fawzi: "audit, review, optimize, propose changes — works great now on Linux and Windows but there are a lot of gaps and the ERP sync is still some kind of an issue."

## Audit findings (5 parallel specialist agents)

### P0 (ship-blockers fixed in v3.4.2)

1. **pre-push.js stamp never reached the remote.** Hook wrote to `tracking.json` and `git add`-ed it, but the `git push` had already computed its commit list — stamp sat in the index forever. ERP saw stale data on every push. **This was the "ERP sync issue" Fawzi had been chasing.**
2. **session-start.js threw `ReferenceError` on first run** — `TEAL/RESET/DIM` referenced but never defined. Outer try/catch swallowed it. Every brand-new install showed a blank session.
3. **/qualia-optimize broken on fresh installs** — referenced four agents (frontend-agent, backend-agent, performance-oracle, architecture-strategist) that don't ship with the framework.
4. **Local privilege escalation** — `.qualia-config.json` written with default 0644. Any local user could edit `role` to `OWNER` and bypass `branch-guard`.
5. **Hardcoded shared ERP key** `qualia-claude-2026` shipped to every install. Same value for every employee. Token theft = ERP impersonation.
6. **Non-atomic dual writes** — STATE.md + tracking.json could corrupt under SIGINT/AV/concurrent invocations.
7. **close-milestone double-counted on re-run; backfill-lifetime overwrote history.**

### P1 (hardening in v3.5.0)

8. **branch-guard refspec bypass.** EMPLOYEE could `git push origin feature/x:main` from a feature branch — guard checked current branch, not push target.
9. **migration-guard false positives:** `MigrationModal.tsx`, commented-out SQL, TEMP tables, partition tables.
10. **migration-guard false negatives:** `ALTER TABLE … DROP COLUMN`, `DROP DATABASE`, `DROP SCHEMA`, `UPDATE` without WHERE, `GRANT TO PUBLIC` — all undetected.
11. **service_role scanner trivially bypassable** — literal substring match. `"service_" + "role"` walked through.
12. **auto-update.js 24h blackout** on failed npm fetches. **And** auto-installed mid-session (corrupted live settings.json).
13. **pre-compact silent commit failures** — used user identity, no `--no-verify`, broke when user had pre-commit hooks/signing → context loss before compaction.
14. **statusline ran 3 git spawns per shell prompt** — ~450ms cold prompt on Windows.
15. **CRLF poisoning** — Windows-saved STATE.md leaked `\r` into captured `phase_name`.
16. **cli.js cmdMigrate added duplicate hook entries** when home directory changed.
17. **9 broken @path refs** in skills (`@agents/*` should be `@~/.claude/agents/*`).
18. **qualia-quick had no trigger phrases** — router never fired it on natural language.
19. **qualia-map used wrong subagent invocation API.**
20. **qualia-idk fully redundant** with qualia router (deleted).
21. **help.html undercounted skills by 9.**
22. **No GitHub Actions CI** — tests ran only locally.

### P2 (cleanup in v3.6.0)

23. **tracking.json schema drift** vs ERP contract — `gap_cycles` polymorphism, missing fields.
24. **Trace files grew unboundedly** — no rotation in `~/.claude/.qualia-traces/`.
25. **`polished` transition mis-marked roadmap** — set last phase to `verified` regardless of context.
26. **cmdInit hydrated partial lifetime as `NaN`** when older tracking.json was missing keys.

## How we shipped

1. Spawned 5 parallel audit agents (one per concern: ERP sync, state machine, hooks, skills, tests). 22 minutes wall-clock, 50+ findings ranked by severity.
2. Branched `feature/audit-fixes` off main.
3. v3.4.2: implemented P0 sequentially (overlapping files in state.js + install.js needed careful ordering). 8 fixes + 8 tests.
4. v3.5.0: spawned 6 parallel implementer agents for non-conflicting hook files + 3 more for safe v3.6.0 cleanup. ~5 minutes wall-clock for 9 files of concurrent edits. Then I added 11 regression tests myself.
5. v3.6.0: state.js + tracking.json + ERP contract reconciliation, log retention, polish fixes. 2 more tests.
6. Fast-forward merged to main, tagged v3.4.2/v3.5.0/v3.6.0, pushed all to GitHub.
7. `npm publish` (Fawzi authenticated and ran).
8. Post-publish smoke: `npm install qualia-framework@latest` confirms 3.6.0 lands.

## ERP coordination

A second Claude session worked the ERP side in parallel (`feature/erp-v3.4.2-compat`). We disagreed once on ship order, then reconciled:

- **Framework v3.4.2/v3.5.0:** wire format unchanged or purely additive — ERP's existing Zod strip-unknowns pattern handles new fields silently.
- **Framework v3.6.0:** introduces `team_id`, `project_id`, `git_remote`, `last_pushed_at`, `build_count`, `deploy_count`, `session_started_at`, `submitted_by`, `lifetime.last_closed_milestone` — all optional, additive. Documented in `docs/erp-contract.md`.
- **Existing employee installs:** preserved their `qualia-claude-2026` key on auto-update. No auth break.
- **30-day grandfather window:** ERP keeps the shared key valid until employees migrate to per-user tokens.

ERP session is shipping `feature/erp-v3.4.2-compat` to portal.qualiasolutions.net tonight in parallel.

## Verification (pre-publish)

```
✅ Git           main at v3.6.0, 3 tags pushed
✅ Tests         150/150 pass
✅ Secrets       hardcoded "qualia-claude-2026" removed from install.js
✅ Secrets       no leaked Bearer/sk-/api_key tokens in bin/ or hooks/
✅ Package       79 files, 165 kB, no .npmrc/.env in tarball
✅ Install       end-to-end install works → .qualia-config.json mode 0600 confirmed
✅ State.js      init writes new schema fields, ALREADY_INITIALIZED guard fires
✅ Post-publish  npm install qualia-framework@latest → version 3.6.0
```

## Follow-up items (next milestone)

- **ERP-side per-user token endpoint** (already in ERP session's plan, blocking new-employee onboarding)
- **Idempotency-Key support** in `/api/v1/reports` (ERP-side)
- **Drop `cmdMigrate` from cli.js entirely?** It's a leftover from v2.x → v3.x migration. Worth evaluating in v3.7+.
- **Rolling out per-project gap_cycle_limit override docs.**
- **Consider HMAC-signing the team file** so a local user can't fabricate `~/.claude/.qualia-team.json` to grant themselves OWNER.
- **Tests for cmdUninstall and cmdMigrate** — still zero coverage on those functions.

## Changelog highlights (full detail in CHANGELOG.md)

- **v3.4.2:** ERP sync stamp finally reaches the remote. Role file mode 0o600. Hardcoded ERP key removed. Atomic writes + lockfile. close-milestone idempotency. backfill Math.max. init clobber guard.
- **v3.5.0:** branch-guard refspec parsing. migration-guard 5 new patterns + comment stripping. service_role regex hardening. auto-update no longer corrupts session. pre-compact bot author. statusline single git call. CRLF tolerance. CI workflow.
- **v3.6.0:** tracking.json schema reconciled with ERP contract. Log retention (30 days). polished transition fix. Defensive lifetime hydrate.
