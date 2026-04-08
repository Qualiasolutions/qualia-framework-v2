---
name: qualia-pause
description: "Save session context for seamless handoff. Creates .continue-here.md so the next session picks up exactly where you left off. Trigger on 'pause', 'stop for now', 'save progress', 'continue later', 'pick up tomorrow'."
---

# /qualia-pause — Session Handoff

Save context so the next session picks up where you left off.

## Process

### 1. Read State

```bash
cat .planning/STATE.md 2>/dev/null
git status --short 2>/dev/null
git log --oneline -5 2>/dev/null
```

### 2. Create `.continue-here.md`

```markdown
# Continue Here

## Session Summary
{What was accomplished — from conversation context + git log}

## Current Phase
Phase {N}: {name} — {status}

## In Progress
- {What's partially done}
- {Where exactly work stopped}

## Next Steps
1. {Immediate next action}
2. {Following action}

## Decisions Made
- {Decision and rationale}

## Blockers
- {Any unresolved issues}

## Files Modified
- {List from git status/diff}
```

### 3. Commit

```bash
git add .continue-here.md {any uncommitted work files}
git commit -m "WIP: {phase name} — session handoff"
```

Update STATE.md last activity.
