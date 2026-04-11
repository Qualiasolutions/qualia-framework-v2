---
name: qualia-build
description: "Execute the current phase — spawns builder subagents per task with wave-based parallelization. Fresh context per task."
---

# /qualia-build — Build a Phase

Execute the phase plan. Each task runs in a fresh subagent context. Independent tasks run in parallel.

## Usage
`/qualia-build` — build the current planned phase
`/qualia-build {N}` — build specific phase

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

Spawn a fresh builder subagent:

```
Agent(prompt="
Read your role: @agents/builder.md

Project context:
@.planning/PROJECT.md

YOUR TASK:
{paste the single task block from the plan — title, files, action, context refs, done-when}

Execute this task. Read all @file references before writing. Commit when done.
", subagent_type="qualia-builder", description="Task {N}: {title}")
```

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

```bash
node ~/.claude/bin/qualia-ui.js end "PHASE {N} BUILT" "/qualia-verify {N}"
```
