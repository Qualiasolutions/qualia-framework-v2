---
name: qualia-plan
description: "Plan the current phase — spawns planner agent in fresh context. Use when ready to plan a phase."
---

# /qualia-plan — Plan a Phase

Spawn a planner agent to break the current phase into executable tasks.

## Usage
`/qualia-plan` — plan the next unplanned phase
`/qualia-plan {N}` — plan specific phase
`/qualia-plan {N} --gaps` — plan fixes for verification failures

## Process

### 1. Determine Phase

```bash
cat .planning/STATE.md 2>/dev/null
```

If no phase number given, use the current phase from STATE.md.

### 2. Spawn Planner (Fresh Context)

```
◆ QUALIA ► PLANNING Phase {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Spawning planner...
```

Spawn a subagent with `agents/planner.md` instructions:

```
Agent(prompt="
Read your role: @agents/planner.md

Project context:
@.planning/PROJECT.md

Current state:
@.planning/STATE.md

Phase {N} goal: {goal from STATE.md roadmap}
Phase {N} success criteria: {criteria from STATE.md}

{If --gaps: Also read @.planning/phase-{N}-verification.md for failures to fix}

Create the plan file at .planning/phase-{N}-plan.md
", subagent_type="qualia-planner", description="Plan phase {N}")
```

### 3. Review Plan

Read the generated plan. Present to employee:

```
◆ Phase {N} Plan
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Tasks: {count}
  Waves: {count}

  Wave 1 (parallel):
    Task 1: {title}
    Task 2: {title}

  Wave 2 (after Wave 1):
    Task 3: {title}

  Approve? (yes / adjust)
```

If "adjust" — get feedback, re-spawn planner with revision context.

### 4. Update State

Update STATE.md: status → "planned"
Update tracking.json: status → "planned"

```
  → Run: /qualia-build {N}
```
