---
name: qualia-task
description: "Build a single task — more structured than /qualia-quick, lighter than /qualia-build. Spawns a fresh builder agent for one focused task."
---

# /qualia-task — Single Task Builder

Build one thing properly. Fresh builder context, atomic commit, but no phase plan needed.

## Usage
`/qualia-task` — describe what to build interactively
`/qualia-task {description}` — build it directly

## When to Use
- Too big for a quick fix, too small for a full phase
- Adding a single feature, component, API route, or integration
- Refactoring one module
- Building something specific someone asked for

## Process

### 1. Clarify

If no description provided, ask: **"What do you want to build?"**

Then use AskUserQuestion:

```
question: "How complex is this task?"
header: "Scope"
options:
  - label: "Small (30min-1hr)"
    description: "Single file or component, straightforward implementation"
  - label: "Medium (1-3hrs)"
    description: "Multiple files, some integration work, needs testing"
  - label: "Large (3hrs+)"
    description: "Significant feature, multiple components, consider /qualia-plan instead"
```

If "Large" — suggest `/qualia-plan` instead. Ask if they want to proceed anyway.

### 2. Task Spec

Write a quick task spec (don't save to file, just confirm with user):

```
◆ QUALIA ► TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  What:    {what to build}
  Files:   {files to create/modify}
  Done:    {what "done" looks like}
```

Ask: **"Good to build?"**

### 3. Build

Spawn a builder agent with the task:

```
Agent(subagent_type: "qualia-builder")

Task: {task description}
Files: {files to create/modify}
Done when: {completion criteria}

Context: Read PROJECT.md if it exists. Follow all rules (security, frontend, deployment).
```

The builder runs in fresh context — reads before writing, follows rules, commits atomically.

### 4. Verify

After the builder finishes:
- Run `npx tsc --noEmit` if TypeScript
- Quick smoke test if applicable
- Review what was built

### 5. Report

```
◆ QUALIA ► TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Task      {description}
  Files     {files changed}
  Commit    {commit hash}
  Status    ✓ Done
```

Update `.planning/tracking.json` notes field if it exists.
