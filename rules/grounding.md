# Grounding Protocol & Rubrics

Shared quality standards for every Qualia skill and subagent. Reference from every SKILL.md and agent prompt that produces findings, scores, or recommendations.

## Grounding Protocol (MANDATORY for every agent)

Paste or reference this block in every agent.md and every skill that spawns agents:

1. **Every factual claim requires a citation.** Format: `file:line — "quoted snippet"`. If you cannot cite, write `INSUFFICIENT EVIDENCE: searched {files} with {commands}` instead of inventing.
2. **No hedging language.** Do not write "it seems", "it appears", "probably", "might be", "likely". Either you verified it (cite) or you did not (say INSUFFICIENT EVIDENCE).
3. **Findings without `file:line` are discarded.** Any bug, issue, or recommendation missing a file:line citation is automatically removed from the report.
4. **Scores require evidence on the next line.** When scoring 1–5, the evidence line must appear directly below the score. Score without evidence = 0.
5. **Severity requires criteria match.** When assigning CRITICAL/HIGH/MEDIUM/LOW, quote the matching criterion from the Severity Rubric below. Do not assign severity by feel.
6. **Output shapes are contracts.** If the prompt specifies a Markdown/JSON structure, produce EXACTLY that structure. Missing sections = protocol violation.
7. **Stopping criterion.** If a task says "investigate", stop at the specified tool budget (default 10 Read/Grep calls). Return what you found, not what you wish you found.
8. **Precondition checks.** Before starting work, verify every `@file` reference exists. If a required file is missing, HALT with the missing file name. Do not proceed with assumptions.

## Severity Rubric

| Level    | Weight | Objective criteria                                                                                                           |
|----------|:------:|------------------------------------------------------------------------------------------------------------------------------|
| CRITICAL |   8    | Security breach possible; data loss; auth bypass; service_role exposed client-side; crashes on happy path                    |
| HIGH     |   4    | Feature broken for >50% of users; no error handling on user-facing path; wiring missing (component exists but unreachable)   |
| MEDIUM   |   2    | Feature works but missing states (loading/error/empty); a11y violation (contrast, alt); hardcoded values that should be vars |
| LOW      |   1    | Style; TODO comments; console.log in prod; naming inconsistency; minor perf (no user-visible impact)                         |

### Category Score Formula (deterministic — same inputs → same score)

```
weighted_sum   = (critical × 8) + (high × 4) + (medium × 2) + (low × 1)
category_score = max(1, 5 − floor(weighted_sum / 8))
```

Examples (CRITICAL/HIGH/MEDIUM/LOW counts):
- 0/0/0/0 → ws=0 → score 5
- 0/0/2/0 → ws=4 → score 5
- 0/1/0/0 → ws=4 → score 5
- 0/2/0/0 → ws=8 → score 4
- 0/3/0/0 → ws=12 → score 4
- 1/0/0/0 → ws=8 → score 4
- 1/2/0/0 → ws=16 → score 3
- 2/0/0/0 → ws=16 → score 3
- 2/2/0/0 → ws=24 → score 2
- 3/0/0/0 → ws=24 → score 2
- 4/0/0/0 → ws=32 → score 1

## Task-Done Rubric (for verifier, builder self-check)

| Gate                | Check                                                                       | Method    |
|---------------------|-----------------------------------------------------------------------------|-----------|
| Compiles            | `npx tsc --noEmit` exits 0                                                  | Automated |
| No stubs            | `grep -c "TODO\|FIXME\|placeholder\|not implemented"` = 0 in touched files  | Automated |
| Wired               | Every export is imported in at least one consumer                           | Grep      |
| Acceptance criteria | Each AC has a passing validation command (not just file-exists)             | Builder   |
| Committed           | `git log --oneline -1` matches task title                                   | Automated |

## Evidence Citation Format

```
file:line — "quoted code" — {assessment}
```

Example: `src/lib/auth.ts:42 — "return null // TODO" — stub, not implemented (Completeness: 1)`

Claims missing this format are rejected. If evidence cannot be found:
```
INSUFFICIENT EVIDENCE: searched {files} with {commands}
```

## Deviation Format (builder → verifier handoff)

```json
{
  "type": "minor|major|blocker",
  "task": 1,
  "file": "src/x.ts",
  "planned": "what the plan said",
  "actual": "what the code does",
  "impact": "user-facing consequence"
}
```

Log all deviations to `.planning/phase-{N}-deviations.json`.

## Prompt Structure (cache-aware)

Every skill that spawns an agent must order the prompt from most-stable to most-dynamic, so Anthropic prompt caching (92% hit rate at Claude Code scale, 81-90% cost reduction, 85% latency reduction) can reuse the prefix across recurring spawns:

```
1. <role>              session-stable (role.md + grounding.md)
2. <phase_context>     phase-stable  (PROJECT.md, DESIGN.md)
3. <task_context>      task-specific (per-task @files)
4. <task>              dynamic       (the task block itself)
```

**Rules:**
- Never mutate the prefix mid-session. Tool definitions, role, grounding.md must be locked at spawn time.
- Per-task content goes LAST. Mixing task-specific files into `<phase_context>` breaks cache on every spawn within the same wave.
- Reference files via `@path` when the harness auto-expands, OR inline the content — but pick one and stick with it per section (switching styles breaks prefix match).

## Design Quality Rubric (any dimension < 3 = mandatory fix before commit)

| Dimension       | 1 (Fail)                                | 3 (Acceptable)                           | 5 (Excellent)                              |
|-----------------|-----------------------------------------|------------------------------------------|--------------------------------------------|
| Typography      | Inter/Arial/system-ui                   | Project font loaded, 2+ weights          | Full DESIGN.md hierarchy, fluid clamp()    |
| Color           | Hardcoded hex, no palette               | CSS vars defined, brand color present    | Full palette, AA contrast verified         |
| Spacing         | Arbitrary px, no system                 | 8px grid mostly followed                 | Fluid clamp() padding, consistent scale    |
| States          | No loading/error/empty states           | Loading OR error handled                 | All 7 states on every interactive element  |
| Responsiveness  | Fixed px, breaks on mobile              | Works at 375px and 1440px                | Fluid, mobile-first, 44px+ touch targets   |
| Accessibility   | No alt, no labels, outline:none         | Labels + alt present                     | Skip link, ARIA, keyboard nav, headings    |
