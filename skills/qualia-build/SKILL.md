---
name: qualia-build
description: "Execute the current phase — spawns builder subagents per task with wave-based parallelization. Fresh context per task."
---

# /qualia-build — Build a Phase

Execute the phase plan. Each task runs in a fresh subagent context. Independent tasks run in parallel.

## Usage
`/qualia-build` — build the current planned phase
`/qualia-build {N}` — build specific phase
`/qualia-build {N} --auto` — build + chain into `/qualia-verify {N} --auto` when done (no human gate between build and verify)

## Process

### 1. Load Plan

```bash
cat .planning/phase-{N}-plan.md
```

Parse: tasks, waves, file references.

### 1b. Create Recovery Point

Before executing any tasks, tag current HEAD for rollback:

```bash
git tag -f "pre-build-phase-{N}" HEAD 2>/dev/null
```

```bash
node ~/.claude/bin/qualia-ui.js info "Recovery point: pre-build-phase-{N}"
```

If a wave fails and the user needs to roll back:
```bash
git reset --hard pre-build-phase-{N}
node ~/.claude/bin/state.js transition --to planned --force
```

### 2. Execute Waves

```bash
node ~/.claude/bin/qualia-ui.js banner build {N} "{phase name}"
```

**For each wave (sequential):**

```bash
node ~/.claude/bin/qualia-ui.js wave {W} {total_waves} {tasks_in_wave}
```

**For each task in the wave (parallel if multiple):**

```bash
node ~/.claude/bin/qualia-ui.js task {task_num} "{task title}"
```

**Pre-inline context before spawning** (saves 3-5 Read calls inside each builder subagent — GSD-style dispatch):

1. Parse the task's `Context:` field to get `@file` references
2. Read PROJECT.md
3. Read DESIGN.md if any file in the task is `.tsx`, `.jsx`, `.css`, `.scss`
4. Read each `@file` referenced in Context
5. Inline all of the above into the agent prompt under `<pre-loaded-context>` so the builder starts with full context

Spawn a fresh builder subagent:

```
Agent(prompt="
Read your role: @~/.claude/agents/builder.md

<pre-loaded-context>
# PROJECT.md
{inlined contents of .planning/PROJECT.md}

# DESIGN.md (if frontend task)
{inlined contents of .planning/DESIGN.md}

# {each @file from task.Context}
{inlined contents}
</pre-loaded-context>

YOUR TASK:
{paste the single task block from the plan — title, wave, persona, files, depends-on, why, acceptance-criteria, action, validation, context}

All files in <pre-loaded-context> are already in your working memory — do NOT
re-Read them. Only Read files NOT in the pre-loaded context (e.g. existing
project code you need to modify).

Execute the task. Commit when done.
", subagent_type="qualia-builder", description="Task {N}: {title}")
```

**Why pre-inline:** without it, the builder's first actions are 3-5 Read tool calls to orient itself (PROJECT.md, DESIGN.md, context files). With pre-inline, the builder starts already oriented and spends its context budget on the actual task.

**After each task completes:**
- Verify the commit exists: `git log --oneline -1`
- Show result:
```bash
node ~/.claude/bin/qualia-ui.js done {task_num} "{title}" {commit_hash}
```

**After each wave completes:**
- Move to next wave
- Show wave summary

### 3. Wave Completion

After all waves complete:

```bash
node ~/.claude/bin/qualia-ui.js divider
node ~/.claude/bin/qualia-ui.js ok "Tasks: {done}/{total}"
node ~/.claude/bin/qualia-ui.js ok "Commits: {count}"
node ~/.claude/bin/qualia-ui.js ok "Waves: {count}"
```

### 4. Handle Failures

If a builder subagent returns a deviation or blocker:
- **Minor deviation:** Log it, continue
- **Major deviation:** Show to employee, ask how to proceed
- **Blocker:** Show the blocker, suggest fix or escalation

### 5. Update State

```bash
node ~/.claude/bin/state.js transition --to built --phase {N} --tasks-done {done} --tasks-total {total} --wave {wave}
```
If state.js returns an error, show it to the employee and stop.
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

### 6. Route (auto-chain aware)

**If invoked with `--auto`:** immediately invoke `/qualia-verify {N} --auto` inline. No pause, no permission ask. Verify will either chain into the next phase (if PASS), into gap closure (if FAIL and gap cycles remain), or halt with clear escalation (if gap limit reached).

```bash
node ~/.claude/bin/qualia-ui.js info "Auto mode — chaining into /qualia-verify {N}"
```

Then invoke the `qualia-verify` skill inline with the same `--auto` flag.

**Otherwise (default guided mode):** stop and show the next step:

```bash
node ~/.claude/bin/qualia-ui.js end "PHASE {N} BUILT" "/qualia-verify {N}"
```
