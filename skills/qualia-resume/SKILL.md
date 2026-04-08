---
name: qualia-resume
description: "Restore context from a previous session. Reads .continue-here.md or STATE.md, summarizes where you left off, routes to next action. Trigger on 'resume', 'continue', 'pick up where I left off', 'what was I doing'."
---

# /qualia-resume — Resume Work

Restore context and route to the right next action.

## Process

### 1. Find Context (priority order)

1. `.continue-here.md` — richest source, from `/qualia-pause`
2. `.planning/STATE.md` — project state
3. Git history — `git log --oneline -10` + `git diff --stat`

### 2. Restore

**If `.continue-here.md` exists:** Read fully. Summarize: what was done, what's in progress, next steps, blockers.

**If only STATE.md:** Read STATE.md + tracking.json. Show current phase and status.

**If neither:** Reconstruct from git. Present findings, ask user to confirm.

### 3. Detect Incomplete Work

- Phase has plan but no verification → execution may be incomplete
- Uncommitted changes → `git status --short`
- Phase marked in-progress in STATE.md

### 4. Present and Route

```
◆ QUALIA ► RESUMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Last session: {summary}
  Phase: {N} — {status}
  {Uncommitted changes if any}

  → {next command}
```

Clean up `.continue-here.md` after restoration (or offer to keep it).
