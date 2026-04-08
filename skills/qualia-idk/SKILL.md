---
name: qualia-idk
description: "Intelligent next-step advisor. Reads .planning/ AND codebase, classifies your situation, tells you what to do. Trigger on 'idk', 'what now', 'I'm stuck', 'what should I do', 'help me decide', 'lost', 'confused', or when user seems stuck."
---

# /qualia-idk — What Should I Do?

Not a status report. A senior dev advisor that understands your situation and tells you what to do.

## Process

### 1. Gather Context (parallel)

```bash
cat .planning/STATE.md 2>/dev/null || echo "NO_STATE"
cat .planning/tracking.json 2>/dev/null || echo "NO_TRACKING"
ls .planning/phase-*-plan.md 2>/dev/null || echo "NO_PLANS"
ls .planning/phase-*-verification.md 2>/dev/null || echo "NO_VERIFICATIONS"
test -f .continue-here.md && head -30 .continue-here.md || echo "NO_HANDOFF"
git status --short 2>/dev/null | head -10
git log --oneline -5 2>/dev/null
```

Also read conversation context — what has the user been doing, what errors occurred.

### 2. Classify Situation

| Situation | Detection |
|-----------|-----------|
| `no-project` | No `.planning/` directory |
| `handoff` | `.continue-here.md` exists |
| `mid-work` | Uncommitted changes, phase in progress |
| `phase-done` | Phase built but not verified, or verified and next phase exists |
| `blocked` | STATE.md lists blockers or same error 3+ times in conversation |
| `bug-loop` | Same files edited 3+ times, user frustrated |
| `all-done` | All phases verified |
| `frustrated` | Multiple errors, user expressing frustration |

### 3. Respond

**`no-project`:** "No Qualia project here." → `/qualia-new` or `/qualia-quick`

**`handoff`:** Read `.continue-here.md`, summarize what happened, route to next step.

**`mid-work`:** Show uncommitted files + current phase. Options: continue, commit, `/qualia-pause`.

**`phase-done`:** Route naturally — unverified → `/qualia-verify`, verified → `/qualia-plan {N+1}`.

**`blocked`:** Analyze WHY. Suggest alternative approach, reordering, or research.

**`bug-loop`:** "Let's try a different angle." Analyze what was tried, suggest alternative. Offer `/qualia-debug`.

**`all-done`:** → `/qualia-polish` → `/qualia-ship` → `/qualia-handoff`

**`frustrated`:** "What's the ONE thing you need working right now?" Focus on single issue.

**Employee escalation:** If role is EMPLOYEE and situation is `bug-loop` or `blocked` for 3+ attempts, suggest: "Want to flag this for Fawzi?"

### 4. Format

```
## Where You Are
{1-2 sentences from STATE.md / git / conversation}

## I Recommend
**{action}** — {why, 1 sentence}
{copy-paste command}

## Other Options
1. **{option}** — {what}
2. **{option}** — {what}
3. **{option}** — {what}
```

User can respond with a number, "just do it", or natural language. Follow the thread.
