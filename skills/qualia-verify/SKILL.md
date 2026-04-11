---
name: qualia-verify
description: "Goal-backward verification — checks if the phase ACTUALLY works, not just if tasks completed. Spawns verifier agent."
---

# /qualia-verify — Verify a Phase

Spawn a verifier agent to check if the phase goal was achieved. Does NOT trust build summaries — greps the actual codebase.

## Usage
`/qualia-verify` — verify the current built phase
`/qualia-verify {N}` — verify specific phase

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
Read your role: @agents/verifier.md

Phase plan with success criteria AND verification contracts:
@.planning/phase-{N}-plan.md

{If re-verification: Previous verification with gaps:}
{@.planning/phase-{N}-verification.md}

Verify this phase. Write report to .planning/phase-{N}-verification.md
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
Read your role: @agents/qa-browser.md

Phase plan: @.planning/phase-{N}-plan.md
Existing verification: @.planning/phase-{N}-verification.md

Drive the running dev server and test the routes this phase touched. Append a '## Browser QA' section to the verification file.
", subagent_type="qualia-qa-browser", description="Browser QA phase {N}")
```

Wait for both the main verifier and the QA browser agent before moving to step 3. If Playwright MCP is unavailable, the QA browser agent returns BLOCKED — that's not a phase failure, just a note in the report.

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

End:
```bash
node ~/.claude/bin/qualia-ui.js end "PHASE {N} GAPS FOUND" "/qualia-plan {N} --gaps"
```

### 4. Update State

```bash
node ~/.claude/bin/state.js transition --to verified --phase {N} --verification {pass|fail}
```
If PASS and more phases: state.js auto-advances to the next phase.
If FAIL and gap_cycles >= 2: state.js returns GAP_CYCLE_LIMIT — tell the employee to escalate.
If FAIL and gap_cycles < 2: proceed to `/qualia-plan {N} --gaps`.
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

### 5. Passive Knowledge Capture (on FAIL)

When verification fails, after showing the gaps, ask the user:

> *"Was any of this a recurring issue worth saving to common-fixes.md? (yes / no / which ones)"*

If yes, for each flagged gap spawn a brief `/qualia-learn` flow with type=`fix` — the gap title and fix direction from the verification report become the entry. Do NOT save every failure automatically — only the ones the user flags. The point is to build a real knowledge base, not a log of every mistake.
