---
name: qualia-milestone
description: "Close the current milestone and open the next one — loads the next milestone's scope from JOURNEY.md (no ad-hoc naming). Archives artifacts, marks requirements Complete, regenerates ROADMAP.md for the next milestone."
---

# /qualia-milestone — Milestone Closeout

Triggered after `/qualia-verify` passes on the LAST phase of the current milestone. Archives the current milestone's artifacts, marks its requirements Complete, and opens the next milestone — **scope pulled directly from JOURNEY.md**, not improvised.

## When to Use

- After `/qualia-verify N` passes on the LAST phase of the current milestone
- NOT for individual phase completions — use `/qualia-verify N` for that
- NOT for starting a brand-new project — use `/qualia-new` for that

## Usage

`/qualia-milestone` — close the current milestone, open the next from JOURNEY.md
`/qualia-milestone --auto` — close + open next, then pause at the milestone boundary to ask "Continue to M{N+1}?" (the one human gate in auto mode beyond initial journey approval)

## Process

### 1. Validate Readiness

```bash
node ~/.claude/bin/state.js check
```

`state.js close-milestone` enforces two guards:
- `MILESTONE_NOT_READY` — any phase not verified
- `MILESTONE_TOO_SMALL` — milestone has < 2 phases

If either fires (without `--force`), stop and show the error. The user must verify remaining phases first (or add `--force` for explicit bypass on a preview/demo milestone).

### 2. Banner + Confirm

```bash
node ~/.claude/bin/qualia-ui.js banner milestone
node ~/.claude/bin/qualia-ui.js journey-tree .planning/JOURNEY.md
```

The journey-tree shows the user WHERE they are on the ladder before asking the close question. Read `.planning/JOURNEY.md` to find the next milestone's name + scope. Show:
- Current milestone name + phases completed + requirements delivered
- Next milestone name + phase sketch + why-now from JOURNEY.md

- header: "Close + open next?"
- question: "Close {current} and open Milestone {N+1}: {next name}?"
- options:
  - "Close + open next" — archive this one, regenerate ROADMAP.md for {next name}
  - "Pause" — don't close yet

### 3. Archive Current Milestone

```bash
milestone_slug="milestone-{N}-$(echo '{current name}' | tr '[:upper:] ' '[:lower:]-')"
mkdir -p .planning/archive/$milestone_slug

cp .planning/ROADMAP.md .planning/archive/$milestone_slug/ROADMAP.md
cp .planning/STATE.md .planning/archive/$milestone_slug/STATE.md
cp .planning/tracking.json .planning/archive/$milestone_slug/tracking.json
# Move per-phase artifacts if present
for f in .planning/phase-*-plan.md .planning/phase-*-verification.md .planning/phase-*-context.md .planning/phase-*-research.md .planning/phase-*-gaps-plan.md; do
  [ -f "$f" ] && mv "$f" .planning/archive/$milestone_slug/ 2>/dev/null
done
```

### 4. Mark Requirements Complete

Edit `.planning/REQUIREMENTS.md`:
- In the Traceability table, flip this milestone's REQ-IDs from Pending/In Progress → **Complete**
- Leave the per-milestone section structure intact (preserves history)

### 5. Close Milestone in State Machine

Closes current milestone's counters, appends a summary to `tracking.json` milestones[]:

```bash
node ~/.claude/bin/state.js close-milestone
```

If all phases are verified and ≥ 2 phases exist, this succeeds without `--force`. Otherwise add `--force` (rare — usually means the user is closing a preview/demo milestone).

### 6. Read Next Milestone From JOURNEY.md

Parse `.planning/JOURNEY.md` to extract the next milestone's:
- name
- phase list with goals
- requirements covered (REQ-IDs)
- exit criteria

If the next milestone is **Handoff** (always the last milestone), use the fixed 4-phase Handoff template (Polish, Content + SEO, Final QA, Handoff) from the journey template.

If JOURNEY.md doesn't exist (legacy project pre-v4), fall back to asking the user:

- header: "Next milestone"
- question: "What's the next milestone called?"

Then manually sketch its phases. But ideally every v4 project has a JOURNEY.md from the start.

### 7. Regenerate ROADMAP.md for the New Milestone

Spawn the roadmapper with the next milestone's JOURNEY.md sketch as input:

```
Agent(prompt="
Read your role: @~/.claude/agents/roadmapper.md

<mode>next-milestone</mode>
<journey_file>.planning/JOURNEY.md</journey_file>
<next_milestone_num>{N+1}</next_milestone_num>
<next_milestone_name>{next name from JOURNEY.md}</next_milestone_name>

<task>
Regenerate .planning/ROADMAP.md for Milestone {N+1}. The sketch in JOURNEY.md
gives you phase names + one-line goals — elevate to full phase-level detail:
- 2-5 success criteria per phase
- requirements coverage from REQUIREMENTS.md (section for this milestone)
- dependency ordering

Do NOT re-plan completed milestones. Do NOT create a new JOURNEY.md — the
existing one stays the source of truth.

After writing ROADMAP.md, update STATE.md via:
  node ~/.claude/bin/state.js init --force \\
    --project '{project}' --client '{client}' --type '{type}' \\
    --milestone_name '{next name}' \\
    --phases '<JSON: next milestone phases>' \\
    --total_phases <count>

--force is needed because a project already exists.
</task>
", subagent_type="qualia-roadmapper", description="Open milestone {N+1}")
```

### 8. Commit

```bash
git add .planning/
git commit -m "milestone: close M{N} ({current name}) → open M{N+1} ({next name})"
```

### 9. Route (auto-chain aware — the milestone boundary is a human gate in auto mode)

**Case A: this WAS the Handoff milestone closing → project is done.**

```bash
node ~/.claude/bin/qualia-ui.js milestone-complete {N} "Handoff" ""
node ~/.claude/bin/qualia-ui.js end "PROJECT SHIPPED" "/qualia-report"
```

In `--auto` mode, inline-invoke `/qualia-report` and stop. No further chaining — the project is done.

**Case B: a non-final milestone just closed → next milestone is open.**

```bash
node ~/.claude/bin/qualia-ui.js milestone-complete {N} "{current name}" "{next name}"
```

**In `--auto` mode**, pause here and ask (this is ONE of the two human gates in auto mode, the other being journey approval at `/qualia-new` time):

- header: "Milestone {N} shipped"
- question: "Continue to Milestone {N+1}: {next name} now?"
- options:
  - "Continue" — inline-invoke `/qualia-plan 1 --auto` for the new milestone
  - "Pause here" — stop and let the user resume later with `/qualia-plan 1 --auto`

If "Continue": the auto-chain resumes. If "Pause": stop, show:

```bash
node ~/.claude/bin/qualia-ui.js end "M{N} CLOSED · M{N+1} READY" "/qualia-plan 1 --auto"
```

**In guided mode**, always stop and show the next step regardless of position:

```bash
node ~/.claude/bin/qualia-ui.js end "M{N} CLOSED · M{N+1} OPEN" "/qualia-plan 1"
```

## What Stays, What Changes

**Stays:**
- `.planning/PROJECT.md` — the project identity doesn't change
- `.planning/JOURNEY.md` — the North Star is the SAME file across all milestones; don't regenerate it
- `.planning/DESIGN.md` — design system persists
- `.planning/archive/` — historical milestones preserved
- `tracking.json` lifetime fields + milestones[] array — cumulative history

**Changes:**
- `.planning/REQUIREMENTS.md` — this milestone's REQ-IDs marked Complete
- `.planning/ROADMAP.md` — regenerated for the new milestone's phases
- `.planning/STATE.md` — reset to Phase 1 of the new milestone

**Discarded (but archived):**
- `.planning/phase-*-*.md` files from the closed milestone — moved to archive

## Rules

1. **Don't close early.** state.js enforces: all phases verified + ≥ 2 phases, unless `--force`.
2. **JOURNEY.md is the source of truth for next milestone.** Don't ask the user to name it unless JOURNEY.md is missing (legacy project).
3. **Archive, don't delete.** Old phase work stays accessible via `.planning/archive/`.
4. **New milestone = fresh phase numbering.** First phase of the new milestone is Phase 1, not Phase {N+1}.
5. **ERP sync aware.** tracking.json milestones[] gets a summary entry on close — the ERP reads this to render the tree.
6. **Handoff is the final milestone.** If the current milestone IS Handoff, there is no "next" — route to `/qualia-report` and the project is done.
