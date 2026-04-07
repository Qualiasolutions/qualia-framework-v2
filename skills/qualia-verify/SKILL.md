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

```
◆ QUALIA ► VERIFYING Phase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Spawning verifier...
```

```
Agent(prompt="
Read your role: @agents/verifier.md

Phase plan with success criteria:
@.planning/phase-{N}-plan.md

{If re-verification: Previous verification with gaps:}
{@.planning/phase-{N}-verification.md}

Verify this phase. Write report to .planning/phase-{N}-verification.md
", subagent_type="qualia-verifier", description="Verify phase {N}")
```

### 3. Present Results

Read the verification report. Present:

**If PASS:**
```
◆ QUALIA ► Phase {N} VERIFIED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  All {count} criteria passed.

  → Run: /qualia-plan {N+1}
```

**If FAIL:**
```
◆ QUALIA ► Phase {N} GAPS FOUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Passed: {pass_count}
  Failed: {fail_count}

  Gaps:
    ✗ {gap 1 — specific description}
    ✗ {gap 2 — specific description}

  → Run: /qualia-plan {N} --gaps
```

### 4. Update State

Update STATE.md: verification result
Update tracking.json: verification → "pass" or "fail"
