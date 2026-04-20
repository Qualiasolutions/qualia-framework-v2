# Qualia Framework — Command Quality & Build Workflow Deep Research
**Date:** 2026-04-21
**Scope:** design, debug, optimize, review + plan/build/verify workflow + 8 subagent prompts
**Method:** 4 parallel Opus agents, each auditing one dimension, synthesized by framework owner

## Executive Summary

The framework's biggest accuracy leak is **evidence-free claims**: 3 of 4 diagnostic commands (design, debug, review) do not require file:line citations for findings, so the model hallucinates specifics under pressure. The biggest speed leak is **serial work that should be parallel**: qualia-design and qualia-review list `Agent` in allowed-tools but never spawn, so large codebases get processed in a single context window; the plan-checker revision loop serially re-spawns the planner for issues (frontmatter, wave assignment) that can be fixed mechanically.

The single highest-leverage change is a shared **Grounding Protocol** + **Rubric Library** referenced from every skill and agent — it eliminates ~60% of the determinism defects at once.

---

## Top 15 Improvements — Ranked by Impact × Ease

| # | Change | Impact | Effort | Where |
|---|--------|--------|--------|-------|
| 1 | Add shared Grounding Protocol (cite-or-say-INSUFFICIENT-EVIDENCE) to all agents | 🔥 Accuracy | 30 min | `rules/grounding.md` + import into 8 agent files |
| 2 | Add deterministic severity formula (CRITICAL=8/HIGH=4/MED=2/LOW=1; score = max(1, 5−⌊Σ/8⌋)) to qualia-review | 🔥 Accuracy | 45 min | `skills/qualia-review/SKILL.md:124` |
| 3 | Pre-inline PROJECT.md into verifier prompt (currently missing) | 🔥 Accuracy | 10 min | `skills/qualia-verify/SKILL.md:42` |
| 4 | Make qualia-build spawn wave tasks in parallel explicitly ("all Agent() calls in SAME response") | ⚡ Speed | 30 min | `skills/qualia-build/SKILL.md:65` |
| 5 | Convert qualia-debug from interactive (4 questions) to investigative (parse $ARGUMENTS, run diagnostic greps) | 🔥 Accuracy | 2 hrs | `skills/qualia-debug/SKILL.md:39-44` |
| 6 | Add structured Output Contract (DONE/BLOCKED/PARTIAL prefix) to builder.md | ⚡ Speed + 🔥 Accuracy | 20 min | `agents/builder.md:14` |
| 7 | Mechanical-fix bypass in plan-checker (skip planner re-spawn for frontmatter/wave issues) | ⚡ Speed | 4 hrs | `skills/qualia-plan/SKILL.md:129-153` |
| 8 | Make wave assignment deterministic: file-based dependency graph, topological sort (not "tasks with no dependencies") | 🔥 Accuracy | 3 hrs | `agents/planner.md:33` |
| 9 | Add Rule 8 to plan-checker: "Validation must test behavior, not file-existence only" (stops stubs passing) | 🔥 Accuracy | 30 min | `agents/plan-checker.md` after Rule 7 |
| 10 | Split qualia-design/review into parallel agent fan-out for large file sets (5+ files) | ⚡ Speed | 3 hrs | `skills/qualia-design/SKILL.md`, `skills/qualia-review/SKILL.md` |
| 11 | Add wave-context summary (adjacent task titles + files) to builder prompt — stops semantic drift across parallel tasks | 🔥 Accuracy | 1 hr | `skills/qualia-build/SKILL.md:82` |
| 12 | Fix `grep -qL` bug in qualia-review API auth check (backwards logic) | 🔥 Accuracy | 15 min | `skills/qualia-review/SKILL.md:59-61` |
| 13 | Add tool budgets: researcher (8 external calls), verifier (25 bash calls), debug (10 reads) | ⚡ Speed | 45 min | `agents/researcher.md`, `agents/verifier.md`, `skills/qualia-debug` |
| 14 | Standardize input contracts across 8 agents with `<variable>` typed blocks (only plan-checker does this today) | 🔥 Accuracy | 2 hrs | All 8 agent files |
| 15 | Drop full `next build` from qualia-review; read existing `.next/` or skip with warning | ⚡ Speed | 20 min | `skills/qualia-review/SKILL.md:98` |

**Total effort for #1–#15:** ~20 hours of focused work → framework-wide accuracy and speed step-change.

---

## Per-Command Scores (before changes)

| Command | Score | Weakest Dimension |
|---------|-------|-------------------|
| qualia-debug | 4/10 | Interactive-by-default (4 mandatory questions), no output file, cheat sheets instead of diagnostic commands |
| qualia-design | 6/10 | No critique output contract, `Agent` listed but never spawned, tsc-only verification |
| qualia-review | 7/10 | Serial bash scans, latent `grep -qL` bug, no parallelism |
| qualia-optimize | 8/10 | Strongest — uses agent fan-out, severity labels, OPTIMIZE.md output. Loses points on inline `find`/`grep` in Step 6 + no `--fix` dry-run |

## Per-Agent Scores (before changes)

| Agent | Overall | Biggest Gap |
|-------|---------|-------------|
| plan-checker | 9.5/10 | No tool budget |
| verifier | 9.0/10 | No frontend gate on design verification (runs 40 greps on backend phases) |
| planner | 8.5/10 | Prose input contract, no failure-mode handling |
| builder | 8.5/10 | No structured output contract |
| researcher | 8.5/10 | Unbounded WebSearch loops |
| qa-browser | 8.5/10 | Probes for dev server URL instead of receiving it; no fallback when Playwright unavailable |
| roadmapper | 8.5/10 | `full_detail` is a ghost parameter — referenced but not declared |
| research-synthesizer | 8.0/10 | No evidence requirement on milestone suggestions |

---

## Rubrics to Ship as `rules/rubrics.md`

**Severity (with deterministic category score):**
```
CRITICAL = 8 | HIGH = 4 | MEDIUM = 2 | LOW = 1
weighted_sum = Σ(count_i × weight_i)
category_score = max(1, 5 − ⌊weighted_sum / 8⌋)
```

**Design Quality (1–5 per dimension, any <3 = mandatory fix):**
Typography / Color / Spacing / States / Responsiveness / Accessibility — each with objective criteria (see `skills/qualia-design` comment thread for full matrix).

**Task-Done:**
- Compiles (`tsc --noEmit` = 0)
- No stubs (`grep -c "TODO|FIXME|placeholder" touched_files` = 0)
- Wired (every export imported somewhere)
- Each acceptance criterion has a passing validation command
- Committed (git log matches task title)

**Evidence Citation Format:**
```
file:line — "quoted code" — {assessment}
```
Claims missing this format are rejected. If evidence cannot be found: `INSUFFICIENT EVIDENCE: searched {files} with {commands}`.

---

## Grounding Protocol (paste into every agent)

```markdown
## Grounding Protocol (MANDATORY)
1. Every factual claim requires `file:line — "quoted code"`. No exception.
2. No hedging: "seems / probably / might" → verified or INSUFFICIENT EVIDENCE.
3. Findings without file:line are discarded.
4. Scores without evidence on the next line = 0.
5. Severity requires quoting the matching Severity Rubric criterion.
6. Output shape is a contract — missing sections = protocol violation.
7. Stop at tool budget. Return what you found, not what you wish.
8. Precondition: verify every @file exists before work; HALT if missing.
```

---

## 3 Architectural Changes (bigger, keep for later)

1. **Pre-Build Context Packet** — assemble one JSON with PROJECT.md + DESIGN.md + plan + wave-context before spawning builders. Eliminates per-builder file reads.
2. **Intra-Wave Verification** — run each task's Validation contracts immediately after its builder completes, before next wave starts. Catches failure at task granularity, not phase.
3. **Plan Cache** — cache parsed project identity in `.planning/.project-cache.json`; invalidate on PROJECT.md change. Saves ~30% planner context on multi-phase `--auto` runs.

---

## Missing Agents Worth Adding (ranked)

1. **`migrator.md`** — generates + validates Supabase migrations. Current gap: builder writes raw SQL ad-hoc, migration guard catches only obvious patterns.
2. **`dependency-auditor.md`** — pre-build peer-dependency / vulnerability check. Current gap: builder hits `npm install` conflicts mid-phase and wastes context debugging.
3. **`rollback.md`** — on verify FAIL, bisect to last-good commit instead of always patching forward. Current gap: gap-closure plans build on broken code.

---

## Anti-Patterns to Kill

- `find` inside skills (use Glob) — qualia-optimize:302, qualia-review multiple places
- `Agent` in allowed-tools but never spawned — qualia-design, qualia-debug, qualia-review
- Interactive question gates in one-shot commands — qualia-debug
- Full `next build` as part of a "scan" — qualia-review:98
- Vague "investigate the codebase" with no tool budget — qualia-debug, researcher
- "seems / probably / might" language anywhere in agent output
