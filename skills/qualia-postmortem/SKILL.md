---
name: qualia-postmortem
description: "Self-healing AI layer — when /qualia-verify returns FAIL, identify which agent/rule/skill should have caught the failure and propose a delta to that file so the same class of bug never recurs. Trigger on 'postmortem', 'why did the framework miss this', 'self-heal', 'qualia-postmortem', or auto-invoked by /qualia-verify on FAIL with --auto."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /qualia-postmortem — Self-Healing AI Layer

When the verifier finds a gap, fixing the **code** alone is not enough.
The framework let the bug through — that means a rule, agent prompt,
plan-checker check, or skill instruction was insufficient. This skill
runs after a verify FAIL and asks: *which file in the AI layer should
have caught this, and what delta would catch the next one like it?*

This is Cole Medin's **pillar 5** from the parallel-worktrees playbook
(NotebookLM 2026-04-25): "anytime we encounter a bug in a pull request,
we don't just fix the bug and move on, we fix the underlying system that
allowed for the bug." Without this loop, the same class of bug ships in
PR-3, PR-7, PR-11 of every project.

## When to run

- **Manually:** `/qualia-postmortem` after any verify FAIL where the gap
  feels preventable — i.e. a rule could have flagged it, a builder
  instruction could have steered around it, a plan-checker rule could
  have rejected the plan that produced it.
- **Auto:** `/qualia-verify --auto` will invoke this skill on every FAIL
  before the gap-closure loop fires. The postmortem write happens before
  the user re-plans, so the next planner spawn benefits from the
  updated AI layer immediately.

## Inputs

- `--phase N` (default: current phase from STATE.md)
- `--apply` (optional) — apply the proposed delta to disk. Without
  `--apply`, the skill writes `.planning/phase-{N}-postmortem.md` for
  human review and stops there.
- `--report-only` (optional) — just emit the analysis, write nothing.

If invoked from `/qualia-verify --auto`, default to writing the
postmortem report but **not** applying — applying touches the AI layer
itself, which is high-stakes. The user reviews and types `/qualia-learn`
or applies manually.

## Process

### 1. Load the failure

```bash
node ~/.claude/bin/qualia-ui.js banner postmortem 2>/dev/null || true

PHASE="${PHASE:-$(node ~/.claude/bin/state.js check 2>/dev/null | node -e 'let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s).phase)}catch{console.log("")}})')}"
[ -z "$PHASE" ] && { echo "QUALIA: Could not resolve current phase. Pass --phase N explicitly."; exit 1; }

VERIFY_FILE=".planning/phase-${PHASE}-verification.md"
PLAN_FILE=".planning/phase-${PHASE}-plan.md"

[ -f "$VERIFY_FILE" ] || { echo "QUALIA: $VERIFY_FILE missing — nothing to post-mortem."; exit 1; }
[ -f "$PLAN_FILE" ] || echo "QUALIA: $PLAN_FILE missing — analysis will be partial."
```

Read both files. The verification report tells you *what failed*. The
plan tells you *what was supposed to happen*. The gap between them is
where the AI layer fell short.

### 2. Read the AI layer

The framework's prompts live in three places. Load all three so you can
match a finding to the file most likely responsible:

```bash
# Agent prompts (planner, builder, plan-checker, verifier, etc.)
ls ~/.claude/agents/
# Skill descriptions (qualia-plan, qualia-build, qualia-verify, etc.)
ls ~/.claude/skills/
# Project rules + grounding
ls ~/.claude/rules/
# Already-curated knowledge
node ~/.claude/bin/knowledge.js
```

You don't read all of them — you read the ones whose job description
matches the failure. Use this lookup:

| Failure shape | Likely AI-layer owner |
|---|---|
| Builder produced a stub / placeholder | `agents/builder.md` (Read Before Write, no-stub rule) |
| Plan listed Validation: `test -f file.ts` only — missed behavior check | `agents/plan-checker.md` (Rule 8: at least one grep-match or command-exit per task) |
| Wave 2 task ran before wave 1 committed | `agents/planner.md` (dependency graph) |
| Build passed locally, broke in CI | `rules/deployment.md` or a missing pre-deploy-gate scan |
| RLS missing on new table | `rules/security.md` + `agents/builder.md` (security persona handling) |
| Design regression — fonts off, contrast fail | `rules/frontend.md` + `skills/qualia-design/SKILL.md` |
| Migration unsafe (DROP without IF EXISTS, etc.) | `hooks/migration-guard.js` |
| Verifier missed it | `agents/verifier.md` — most embarrassing case, address with extra care |

### 3. Diagnose

For **each** gap in the verification report (process them one at a time
when there are multiple), produce a four-field analysis:

```markdown
## Gap: {gap title from verification report}

**Severity:** {CRITICAL | HIGH | MEDIUM | LOW}  (from verifier's rubric)
**Owner file:** `agents/builder.md` (or rules/X.md, skills/Y/SKILL.md, etc.)
**Why it slipped:**
  Quote the relevant section of the owner file. Show the gap. The owner
  file SHOULD have prevented this — either the rule wasn't there, or it
  was there but not enforceable, or a rule was there but the agent was
  free to ignore it.

**Proposed delta:**
  Concrete diff for the owner file. New line, edited section, or rule
  addition. Keep it minimal — one new sentence is better than a new
  paragraph. The goal is "the next planner/builder spawn catches this
  class of bug."
```

### 4. Write the postmortem report

```bash
cat > .planning/phase-${PHASE}-postmortem.md <<'EOF'
# Phase {N} Postmortem

**Phase:** {N}
**Verify result:** FAIL ({gap_count} gaps)
**Date:** {ISO date}
**Run ID:** {short uid}

## Findings

{one ## Gap section per gap, format from step 3}

## Cumulative AI-layer drift

{If multiple postmortems exist for this project, group recurring owner
files: "agents/builder.md has been flagged 3 times this milestone — its
no-stub rule may need reinforcement or wave-2 stubs need a hard hook."}

## Apply?

To apply all proposed deltas:
  /qualia-postmortem --apply --phase {N}

To save the recurring patterns to knowledge instead (recommended for
project-spanning lessons):
  /qualia-learn  (pick the relevant entries from this report)

EOF
```

### 5. (Optional) Apply

If invoked with `--apply`, walk each "Proposed delta" and use the Edit
tool to make the literal change to the owner file. After every edit, run
the framework's own type/test gates (`node --test tests/runner.js` if you
modified anything in `bin/`, `agents/`, or `rules/`) to confirm no
regression.

If a proposed delta is to a `~/.claude/agents/X.md` file (the installed
copy), edit that copy directly — the user re-running the installer will
overwrite it next release, so also flag a TODO in the postmortem report
saying "this delta should be PR'd back to the framework repo at
`agents/X.md`" so it survives reinstall.

### 6. Promote durable lessons to the knowledge layer

For lessons that apply across projects (e.g. "Supabase RLS must be in
the same migration as the table — applying it later creates a window
where data is unprotected"), append to the curated tier so future
builders pick it up:

```bash
node ~/.claude/bin/knowledge.js append \
  --type pattern \
  --title "{lesson title}" \
  --body "{lesson body}" \
  --project "{project name from .planning/PROJECT.md or 'general' if cross-project}" \
  --context "Postmortem from phase ${PHASE}, verify FAIL on {date}"
```

### 7. Summarize

```
⬢ Postmortem complete — phase {N}
  {G} gaps analyzed
  Owner files implicated:
    - agents/builder.md (gap 1, gap 3)
    - rules/security.md (gap 2)
  Report: .planning/phase-${PHASE}-postmortem.md
  {if --apply: deltas applied; framework reinstall TODO'd}
  {if no --apply: review and run --apply OR /qualia-learn the patterns}
```

## Style

- **Be charitable.** The framework didn't fail because someone was
  careless. It failed because a contract wasn't tight enough. Frame
  every finding as "the contract was X; it should have been Y."
- **Keep deltas surgical.** A 2-line addition to a rule is durable; a
  paragraph rewrite is brittle. Smaller deltas survive future framework
  updates.
- **Don't reach.** If a gap genuinely doesn't map to an AI-layer file
  (e.g. it's an external service outage), say so explicitly — don't
  invent a rule to retroactively own it.
- **Rate limit yourself.** Don't propose more than 3 deltas per
  postmortem. If there are 8 gaps, the top 3 by severity get deltas; the
  rest get noted but not deltad. Otherwise the AI layer becomes a museum
  of edge cases.

## Anti-patterns

- **Re-fixing the same code as the verifier.** This skill is about the
  AI layer, not the codebase. The gap-closure loop (`/qualia-plan
  {N} --gaps`) handles the code. Postmortem only touches `agents/`,
  `rules/`, `skills/`, and the knowledge layer.
- **Auto-applying deltas to `~/.claude/agents/X.md` without flagging a
  framework PR TODO.** That edit lasts until the next reinstall. Always
  note the TODO so the lesson reaches the framework repo.
- **Promoting every postmortem finding to knowledge.** Most are
  project-specific contract tightening — they belong in the project's
  AI-layer files, not in cross-project knowledge. Only generalizable
  patterns get appended via `knowledge.js`.

## Output contract

The skill writes `.planning/phase-{N}-postmortem.md` and either applies
deltas (with `--apply`) or stops with a summary that points the user at
the next step (`--apply` to apply, or `/qualia-learn` to promote
specific patterns). No follow-up prompts. Idempotent: re-running on the
same phase appends `### Re-run {timestamp}` to the existing report
rather than overwriting.
