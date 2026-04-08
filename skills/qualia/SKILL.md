---
name: qualia
description: "Smart router — reads project state, classifies your situation, tells you the exact next command. Use whenever you type /qualia, 'what next', 'next', 'idk', 'what now', 'what should I do', 'I'm stuck', 'help me decide', 'lost', 'confused', or are unsure about your next step."
---

# /qualia — What's Next?

Read project state. Classify your situation. Tell you the exact next command.

## Process

### 1. Get State

```bash
node ~/.claude/bin/state.js check 2>/dev/null
```

Also gather context:
```bash
test -f .continue-here.md && echo "HANDOFF_EXISTS" && head -20 .continue-here.md || echo "NO_HANDOFF"
git status --short 2>/dev/null | head -10
git log --oneline -3 2>/dev/null
ls .planning/phase-*-plan.md 2>/dev/null || echo "NO_PLANS"
ls .planning/phase-*-verification.md 2>/dev/null || echo "NO_VERIFICATIONS"
```

Read conversation context — what has the user been doing, what errors occurred.

### 2. Classify and Route

Use the state.js JSON output plus gathered context:

| Situation | Detection | Route |
|-----------|-----------|-------|
| `no-project` | state.js returns NO_PROJECT | → `/qualia-new` |
| `handoff` | `.continue-here.md` exists | → Read it, summarize, route to next step |
| `mid-work` | Uncommitted changes + phase in progress | → Continue or `/qualia-pause` |
| `ready-to-plan` | status == "setup" | → `/qualia-plan {N}` |
| `ready-to-build` | status == "planned" | → `/qualia-build {N}` |
| `ready-to-verify` | status == "built" | → `/qualia-verify {N}` |
| `gaps-found` | status == "verified", verification == "fail", gap_cycles < 2 | → `/qualia-plan {N} --gaps` |
| `gap-limit` | status == "verified", verification == "fail", gap_cycles >= 2 | → Escalate to Fawzi or re-plan from scratch |
| `phase-complete` | state.js auto-advanced (status == "setup", phase > 1) | → `/qualia-plan {N}` |
| `all-verified` | last phase verified pass, status == "verified" | → `/qualia-polish` |
| `polished` | status == "polished" | → `/qualia-ship` |
| `shipped` | status == "shipped" | → `/qualia-handoff` |
| `handed-off` | status == "handed_off" | → `/qualia-report` then done |
| `blocked` | STATE.md lists blockers or same error 3+ times | → Analyze, suggest `/qualia-debug` |
| `bug-loop` | Same files edited 3+ times, user frustrated | → Different approach, `/qualia-debug` |

**Employee escalation:** If role is EMPLOYEE and situation is `gap-limit` or `bug-loop`, suggest: "Want to flag this for Fawzi?"

### 3. Display

**Clear next step:**
```
◆ QUALIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project    {name}
  Phase      {N} of {total} — {name}
  Status     {status}
  Progress   {bar} {percent}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  → Run: {next_command from state.js}
```

**Ambiguous situation (multiple options):**
```
## Where You Are
{1-2 sentences}

## I Recommend
**{action}** — {why}
{command}

## Other Options
1. **{option}** — {what}
2. **{option}** — {what}
3. **{option}** — {what}
```

User can respond with a number, "just do it", or natural language.
