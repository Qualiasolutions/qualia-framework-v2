---
name: qualia-verify
description: "Goal-backward verification — checks if the phase ACTUALLY works, not just if tasks completed. Spawns verifier agent."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
---

# /qualia-verify — Verify a Phase

Spawn a verifier agent to check if the phase goal was achieved. Does NOT trust build summaries — greps the actual codebase.

## Usage
`/qualia-verify` — verify the current built phase
`/qualia-verify {N}` — verify specific phase
`/qualia-verify {N} --auto` — verify + auto-chain: PASS → next phase (or milestone close); FAIL → gap closure; gap limit → halt with escalation
`/qualia-verify {N} --adversarial` — run a SECOND verifier in fresh context with an adversarial prompt ("find what's wrong, not what's right"). Union the findings. Recommended for high-stakes phases (Handoff milestone, payment/auth/migration code) where a biased single-pass review would silently approve a bad change. v4.3.0+.

## Process

### 1. Load Context

```bash
echo "---PLAN---"
cat .planning/phase-{N}-plan.md 2>/dev/null
echo "---PREVIOUS---"
cat .planning/phase-{N}-verification.md 2>/dev/null || echo "NONE"
```

### 2. Spawn Verifier (Fresh Context)

```bash
node ~/.claude/bin/qualia-ui.js banner verify {N} "{phase name}"
node ~/.claude/bin/qualia-ui.js spawn verifier "Goal-backward check..."
```

```
Agent(prompt="
Read your role: @~/.claude/agents/verifier.md
Grounding + rubrics: @~/.claude/rules/grounding.md

Project conventions (MUST consult before scoring Quality):
@.planning/PROJECT.md

Phase plan with success criteria AND verification contracts:
@.planning/phase-{N}-plan.md

{If re-verification: Previous verification with gaps:}
{@.planning/phase-{N}-verification.md}

Verify this phase. Apply the Grounding Protocol — every finding needs file:line evidence. Use the Severity Rubric for all severity labels. Write report to .planning/phase-{N}-verification.md
", subagent_type="qualia-verifier", description="Verify phase {N}")
```

### 2b. Browser QA (if phase touched frontend)

If the phase plan's Files section includes any `.tsx`, `.jsx`, `.css`, `.scss`, or `app/`/`pages/`/`components/` paths, ALSO spawn the browser QA agent in parallel:

```bash
# Detect frontend touch
grep -l "\.tsx\|\.jsx\|\.css\|app/\|components/\|pages/" .planning/phase-{N}-plan.md && FRONTEND=true
```

If frontend:

```
Agent(prompt="
Read your role: @~/.claude/agents/qa-browser.md

Phase plan: @.planning/phase-{N}-plan.md
Existing verification: @.planning/phase-{N}-verification.md

Drive the running dev server and test the routes this phase touched. Append a '## Browser QA' section to the verification file.
", subagent_type="qualia-qa-browser", description="Browser QA phase {N}")
```

Wait for both the main verifier and the QA browser agent before moving to step 3. If Playwright MCP is unavailable, the QA browser agent returns BLOCKED — that's not a phase failure, just a note in the report.

### 2c. Adversarial Second Opinion (--adversarial flag, optional)

When `--adversarial` is in the args, OR when the current milestone is
`Handoff` OR the phase plan touches files matching `auth|payment|migration|rls|service_role`, spawn a SECOND verifier in fresh context with an
adversarial prompt. This is the "kid-grading-their-own-homework"
mitigation — a single verifier instance trained on the same rubric the
planner+builder optimized against gets ~70% fewer real findings than a
fresh-context adversarial pass (Cole Medin, NotebookLM 2026-04-25, citing
PR-acceptance studies).

```bash
node ~/.claude/bin/qualia-ui.js spawn verifier "Adversarial pass — find what's wrong"
```

```
Agent(prompt="
Read your role: @~/.claude/agents/verifier.md
Grounding + rubrics: @~/.claude/rules/grounding.md

You are an ADVERSARIAL reviewer. Your job is to find what's WRONG with
this phase, not to confirm it works. Assume the previous verifier missed
something. Use the same Severity Rubric, the same evidence-citation
requirement, but bias your search toward edge cases the cooperative
verifier would skip:
  • What untested error path exists?
  • What input would crash this?
  • What concurrent access pattern is unhandled?
  • What downstream consumer breaks if this contract changes?
  • Where is a security assumption (auth, RLS, secrets) implicit
    instead of enforced?

Project conventions: @.planning/PROJECT.md
Phase plan: @.planning/phase-{N}-plan.md
Cooperative verifier's report (do NOT re-find what they found, find
what they MISSED): @.planning/phase-{N}-verification.md

Append a '## Adversarial Findings' section to the verification file.
Empty section is fine if you genuinely found nothing — better that than
inventing findings to look productive.
", subagent_type="qualia-verifier", description="Adversarial verify phase {N}")
```

Findings from the adversarial pass merge into the main verification
report. The combined PASS/FAIL is the union: if either pass found a
CRITICAL or HIGH gap, the phase is FAIL.

### 3. Present Results

Read the verification report. Present:

**If PASS:**
```bash
node ~/.claude/bin/qualia-ui.js ok "All {count} criteria passed"
node ~/.claude/bin/qualia-ui.js end "PHASE {N} VERIFIED" "/qualia-plan {N+1}"
```
(If phase == total phases, use `/qualia-polish` as the next command.)

**If FAIL:**
```bash
node ~/.claude/bin/qualia-ui.js ok "Passed: {pass_count}"
node ~/.claude/bin/qualia-ui.js fail "Failed: {fail_count}"
```

Then for each gap:
```bash
node ~/.claude/bin/qualia-ui.js fail "{gap description}"
```

**Self-healing layer (v4.3.0+):** before re-planning the gaps, run a
postmortem so the framework itself learns from the miss. This is Cole
Medin's pillar 5: don't just fix the bug, fix the AI-layer file that
should have caught it. The postmortem writes a report to
`.planning/phase-{N}-postmortem.md` for review — it does NOT auto-apply
deltas to agents/rules unless the user runs `/qualia-postmortem --apply`
explicitly. Without this loop, the same class of bug ships in PR-3, PR-7,
PR-11 of the next project.

```
/qualia-postmortem --phase {N}
```

End:
```bash
node ~/.claude/bin/qualia-ui.js end "PHASE {N} GAPS FOUND" "/qualia-plan {N} --gaps"
```

### 4. Update State

```bash
node ~/.claude/bin/state.js transition --to verified --phase {N} --verification {pass|fail}
```
If PASS and more phases in this milestone: state.js auto-advances to the next phase.
If FAIL and gap_cycles >= limit: state.js returns GAP_CYCLE_LIMIT — escalate.
If FAIL and gap_cycles < limit: proceed to `/qualia-plan {N} --gaps`.
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

After state transition, capture the new state for auto-chain routing:

```bash
NEW_STATE=$(node ~/.claude/bin/state.js check)
# Parse: .phase (new current phase), .total_phases, .status, .verification
# Also read .planning/JOURNEY.md to know if this was the last phase of a milestone
```

### 4b. Route (auto-chain aware)

**In `--auto` mode**, the router decides the next step based on verify result + journey position:

| Result | Journey position | Action |
|---|---|---|
| PASS | More phases remain in current milestone | Inline invoke `/qualia-plan {N+1} --auto` |
| PASS | Last phase of current milestone (not Handoff) | Inline invoke `/qualia-milestone --auto` |
| PASS | Last phase of Handoff milestone | Inline invoke `/qualia-ship`, then `/qualia-handoff`, then `/qualia-report` |
| FAIL | gap_cycles < limit | Inline invoke `/qualia-plan {N} --gaps --auto` |
| FAIL | gap_cycles >= limit | **HALT** — show escalation message, require human intervention |

Detect "last phase of current milestone":
```bash
# tracking.json.milestone gives current milestone number
# .planning/JOURNEY.md describes phases per milestone
# If the just-verified phase's number == total phases of current milestone → last phase
```

Detect "last phase of Handoff milestone":
```bash
# If the current milestone's name in JOURNEY.md is "Handoff" AND this was its last phase
```

**Halt case (gap cycle limit)** — stop auto-chain and show:

```bash
node ~/.claude/bin/qualia-ui.js fail "Phase {N} has failed verification {cycles} times — gap limit reached"
node ~/.claude/bin/qualia-ui.js warn "Human intervention required. Options:"
echo "  1. Re-plan this phase from scratch: /qualia-plan {N}"
echo "  2. Adjust the roadmap — phase scope may be wrong"
echo "  3. Escalate to Fawzi (for EMPLOYEE role)"
```

**Default (guided mode)** behavior is unchanged — show the next command and stop:

```bash
# PASS
node ~/.claude/bin/qualia-ui.js end "PHASE {N} VERIFIED" "/qualia-plan {N+1}"
# (or "/qualia-milestone" if last phase of milestone, "/qualia-polish" if overall last phase)

# FAIL
node ~/.claude/bin/qualia-ui.js end "PHASE {N} GAPS FOUND" "/qualia-plan {N} --gaps"
```

### 5. Passive Knowledge Capture (on FAIL)

When verification fails, after showing the gaps, ask the user:

> *"Was any of this a recurring issue worth saving to common-fixes.md? (yes / no / which ones)"*

If yes, for each flagged gap spawn a brief `/qualia-learn` flow with type=`fix` — the gap title and fix direction from the verification report become the entry. Do NOT save every failure automatically — only the ones the user flags. The point is to build a real knowledge base, not a log of every mistake.
