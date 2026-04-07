---
name: qualia
description: "Router — reads STATE.md and tells you the exact next command. Use whenever you type /qualia, 'what next', 'next', or are lost."
---

# /qualia — What's Next?

Read project state. Tell the employee the exact next command. No analysis, no advice — just routing.

## Process

### 1. Read State

```bash
echo "---STATE---"
cat .planning/STATE.md 2>/dev/null || echo "NO_STATE"
echo "---TRACKING---"
cat .planning/tracking.json 2>/dev/null || echo "NO_TRACKING"
echo "---PHASE_PLANS---"
ls .planning/phase-*-plan.md 2>/dev/null || echo "NO_PLANS"
echo "---VERIFICATIONS---"
ls .planning/phase-*-verification.md 2>/dev/null || echo "NO_VERIFICATIONS"
```

### 2. Route

| Condition | Command |
|-----------|---------|
| No `.planning/` | → `/qualia-new` |
| Phase N has no plan | → `/qualia-plan {N}` |
| Phase N has plan, not built | → `/qualia-build {N}` |
| Phase N built, not verified | → `/qualia-verify {N}` |
| Phase N verified with FAIL | → `/qualia-plan {N} --gaps` |
| Phase N verified PASS, more phases | → `/qualia-plan {N+1}` |
| All phases verified PASS | → `/qualia-polish` |
| Polish done | → `/qualia-ship` |
| Shipped | → `/qualia-handoff` |
| Handed off | → Done. Run `/qualia-report` |

### 3. Display

```
◆ QUALIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Project    {name}
  Phase      {N} of {total} — {name}
  Status     {status}
  Progress   {bar} {percent}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  → Run: /qualia-{next command}
```

That's it. One command. One answer.
