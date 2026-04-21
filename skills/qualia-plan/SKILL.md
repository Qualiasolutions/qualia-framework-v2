---
name: qualia-plan
description: "Plan the current phase — spawns planner, validates with plan-checker in a revision loop (max 2), optionally runs discuss/research first. Use when ready to plan a phase."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - TaskCreate
  - TaskUpdate
---

# /qualia-plan — Plan a Phase

Spawn a planner agent to break the current phase into executable tasks, then validate the plan with a checker (up to 2 revision cycles) before routing to build.

## Usage

`/qualia-plan` — plan the next unplanned phase
`/qualia-plan {N}` — plan specific phase N
`/qualia-plan {N} --gaps` — plan fixes for verification failures
`/qualia-plan {N} --skip-check` — skip the plan-checker validation loop (not recommended)
`/qualia-plan {N} --auto` — plan + auto-chain into `/qualia-build {N} --auto` when done (no human approval between plan and build)

## Process

### 1. Determine Phase & Load Context

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/ROADMAP.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
cat ~/.claude/knowledge/learned-patterns.md 2>/dev/null
cat ~/.claude/knowledge/client-prefs.md 2>/dev/null
```

If no phase number given, use the current phase from STATE.md.

**Read phase-specific context if it exists:**
```bash
cat .planning/phase-{N}-context.md 2>/dev/null   # from /qualia-discuss
cat .planning/phase-{N}-research.md 2>/dev/null  # from /qualia-research
```

### 2. Optional: Suggest Deeper Prep

**If ROADMAP.md marked this phase as a "research flag" AND no phase-{N}-research.md exists:**

- header: "Research first?"
- question: "This phase was flagged for deeper research. Run /qualia-research {N} first?"
- options:
  - "Yes, research first" — Run /qualia-research {N} inline, then continue
  - "Skip, plan directly" — I know enough

**If phase involves compliance/regulatory/architectural stakes AND no phase-{N}-context.md exists:**

Briefly suggest: *"Want to run /qualia-discuss {N} first to lock decisions? Optional."*

Don't force it. Some phases don't need it.

### 3. Spawn Planner (Fresh Context)

```bash
node ~/.claude/bin/qualia-ui.js banner plan {N} "{phase name from ROADMAP.md}"
node ~/.claude/bin/qualia-ui.js spawn planner "Breaking phase into tasks..."
```

Spawn the planner:

```
Agent(prompt="
Read your role: @~/.claude/agents/planner.md
Grounding + rubrics: @~/.claude/rules/grounding.md

<project_context>
@.planning/PROJECT.md
</project_context>

<current_state>
@.planning/STATE.md
</current_state>

<phase_details>
Phase {N} from ROADMAP.md:
@.planning/ROADMAP.md

Goal: {goal from ROADMAP.md}
Requirements: {REQ-IDs from ROADMAP.md}
Success criteria: {success criteria from ROADMAP.md}
</phase_details>

<locked_decisions>
{if phase-{N}-context.md exists, inline its Locked Decisions section; else 'none'}
</locked_decisions>

<research_findings>
{if phase-{N}-research.md exists, inline its recommendation; else 'none'}
</research_findings>

{If --gaps: Also read @.planning/phase-{N}-verification.md for failures to fix. Create gap-closure plan.}

<relevant_learnings>
{inline any applicable patterns from knowledge/learned-patterns.md}
</relevant_learnings>

Create the plan at .planning/phase-{N}-plan.md (or .planning/phase-{N}-gaps-plan.md for --gaps).
", subagent_type="qualia-planner", description="Plan phase {N}")
```

### 4. Validate the Plan (unless --skip-check)

Read the generated plan. Spawn the plan-checker:

```
Agent(prompt="
Read your role: @~/.claude/agents/plan-checker.md
Grounding + rubrics: @~/.claude/rules/grounding.md

<plan_path>.planning/phase-{N}-plan.md</plan_path>
<phase_goal>{goal from ROADMAP.md}</phase_goal>
<success_criteria>{criteria from ROADMAP.md}</success_criteria>
<project_context>@.planning/PROJECT.md</project_context>

Validate against the 7 rules. Return PASS or REVISE with structured issues.
", subagent_type="qualia-plan-checker", description="Check plan phase {N}")
```

**Revision loop (max 2 iterations):**

- Iteration 1: Check → if REVISE, re-spawn planner with checker issues
- Iteration 2: Re-check → if REVISE or BLOCKED, escalate to user

Rationale: Amazon/NeurIPS 2025 measured reflection gains at 74→86% for 1 round, 88% for 3 rounds. Iteration 3 only added 2pp over iteration 1 — not worth the extra planner spawn (serial cost ~30-60s).

For each revision:

```
Agent(prompt="
Read your role: @~/.claude/agents/planner.md

<revision_mode>true</revision_mode>
<current_plan>@.planning/phase-{N}-plan.md</current_plan>
<checker_feedback>
{inline REVISE output from plan-checker}
</checker_feedback>

Revise the plan in place. Address every issue. Do NOT add new tasks or change scope
— only fix what the checker flagged.
", subagent_type="qualia-planner", description="Revise plan phase {N}")
```

After revision, spawn the checker again. Max 2 total revision cycles.

**If checker returns BLOCKED after 2 cycles:**

```bash
node ~/.claude/bin/qualia-ui.js fail "Plan failed validation after 2 revisions"
```

Show the remaining issues. Ask:
- "Skip validation and proceed anyway" (use `--skip-check`)
- "Adjust the roadmap" (phase scope may be wrong)
- "Adjust the phase goal" (success criteria may be under-specified)

### 5. Present Final Plan

Render the story-file dashboard — this is a single command that parses the plan and shows the phase goal, waves, tasks, personas, dependencies, acceptance-criteria counts, and validation counts:

```bash
node ~/.claude/bin/qualia-ui.js plan-summary .planning/phase-{N}-plan.md
```

End with plain text: *"Approve? (yes / adjust)"*

If "adjust" — get feedback, re-spawn planner with revision context, re-validate.

### 6. Update State

```bash
node ~/.claude/bin/state.js transition --to planned --phase {N}
```

If state.js returns an error, show it and stop. Do NOT manually edit STATE.md or tracking.json.

### 7. Route (auto-chain aware)

**If invoked with `--auto`:** immediately invoke `/qualia-build {N} --auto` inline. The user already approved the whole journey at `/qualia-new` time — no additional approval needed per phase plan.

```bash
node ~/.claude/bin/qualia-ui.js info "Auto mode — chaining into /qualia-build {N}"
```

Then invoke the `qualia-build` skill inline with `--auto`.

**Otherwise (guided mode):** stop and show the next step:

```bash
node ~/.claude/bin/qualia-ui.js end "PHASE {N} PLANNED" "/qualia-build {N}"
```

## Gap Closure Mode (`--gaps`)

When invoked as `/qualia-plan {N} --gaps`, the planner is in gap-closure mode:

1. Read `.planning/phase-{N}-verification.md` — extract ONLY the FAIL items
2. For each FAIL item, create a targeted fix task:
   - **Files:** specific files that failed verification
   - **Action:** specific fix (not "fix auth" — "add session persistence check in src/lib/auth.ts signIn function")
   - **Acceptance Criteria:** the exact verification criterion that previously failed, restated as an observable behavior
3. Do NOT re-plan passing items. Do NOT add new features. Gap plans are surgical.
4. Write to `.planning/phase-{N}-gaps-plan.md` (separate from original plan)
5. All gap tasks are Wave 1 (parallel) unless they share files
6. Plan-checker still validates the gap plan — same 7 rules apply

## Rules

1. **Plan-checker is mandatory by default.** Only skip with `--skip-check`, and only if you know what you're doing.
2. **Max 3 revision cycles.** After 3 failed checks, escalate — the phase scope is probably wrong.
3. **Honor locked decisions.** If phase-{N}-context.md exists, its locked decisions are non-negotiable.
4. **One plan file per phase.** Don't create phase-1-plan.md AND phase-1-plan-v2.md. Edit in place.
5. **Revision is surgical.** When revising, only fix what the checker flagged — no scope creep.
