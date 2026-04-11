# Qualia Framework v3

A harness engineering framework for [Claude Code](https://claude.ai/code). It installs into `~/.claude/` and wraps your AI-assisted development workflow with structured planning, execution, verification, and deployment gates.

It is not an application framework like Rails or Next.js. It doesn't generate code, run servers, or process data. It's an opinionated workflow layer that tells Claude how to plan, build, and verify your projects.

v3 applies lessons from Anthropic's ["Harness Design for Long-Running Apps"](https://www.anthropic.com/engineering/harness-design-long-running-apps) article: scored evaluator rubrics, verification contracts, smarter guards, hook telemetry, and dynamic team management.

## Install

```bash
npx qualia-framework-v2 install
```

Enter your team code when prompted. Get your code from Fawzi.

**Other commands:**
```bash
npx qualia-framework-v2 version    # Check installed version + updates
npx qualia-framework-v2 update     # Update to latest (remembers your code)
npx qualia-framework-v2 uninstall  # Clean removal from ~/.claude/
npx qualia-framework-v2 team list  # Show team members
npx qualia-framework-v2 team add   # Add a team member
npx qualia-framework-v2 traces     # View recent hook telemetry
```

## Usage

Open Claude Code in any project directory:

```
/qualia-new       # Set up a new project
/qualia           # What should I do next?
/qualia-idk       # I'm stuck — smart advisor
/qualia-plan      # Plan the current phase
/qualia-build     # Build it (parallel tasks)
/qualia-verify    # Verify it actually works
/qualia-design    # One-shot design transformation
/qualia-debug     # Structured debugging
/qualia-review    # Production audit
/qualia-quick     # Skip planning, just do it
/qualia-task      # Build one thing properly
/qualia-polish    # Design and UX pass
/qualia-ship      # Deploy to production
/qualia-handoff   # Deliver to client
/qualia-pause     # Save session, continue later
/qualia-resume    # Pick up where you left off
/qualia-learn     # Save a pattern, fix, or client pref
/qualia-report    # Log your work (mandatory)
```

See `guide.md` for the full developer guide.

## What's Inside

- **19 skills** — slash commands from setup to handoff, plus debugging, design, review, knowledge, session management, and skill authoring
- **4 agents** — planner, builder, verifier, qa-browser (each in fresh context)
- **8 hooks** — session start, branch guard, pre-push tracking sync, env protection, migration guard, deploy gate, pre-compact state save, auto-update (all Node.js — cross-platform)
- **4 rules** — security, frontend, design-reference, deployment
- **5 templates** — tracking.json, state.md, project.md, plan.md, DESIGN.md

## Supported Platforms

Works on **Windows 10/11, macOS, and Linux**. Requires Node.js 18+ and Claude Code.

- Every hook and the status line are pure Node.js — no external bash, jq, or GNU coreutils required.
- Skills are executed by Claude Code's own Bash tool (which Claude Code provides on all platforms, including Windows).
- Tested on Fedora, EndeavourOS, macOS, and Windows 10/11.

## Why It Works

### Goal-Backward Verification

Most CI checks "did the task run." Qualia checks "does the outcome actually work." The verifier scores on 4 dimensions (Correctness, Completeness, Wiring, Quality), each 1-5, with a hard threshold at 3. It doesn't trust summaries — it greps the codebase for stubs, placeholders, unwired imports. The planner generates verification contracts (testable commands) that the verifier executes before ad-hoc checks.

### Agent Separation

Splitting planner, builder, and verifier into separate agents with separate contexts prevents the "God prompt" problem where one massive context tries to plan AND code AND test. Each agent gets fresh context. This directly addresses Claude's quality degradation curve — task 50 gets the same quality as task 1.

### Production-Grade Hooks

All 8 hooks are real ops engineering, not theoretical. Highlights:

- **Pre-deploy gate** — TypeScript, lint, tests, build, and `service_role` leak scan before `vercel --prod`
- **Branch guard** — Role-aware: owner can push to main, employees can't
- **Migration guard** — Catches `DROP TABLE` without `IF EXISTS`, `DELETE` without `WHERE`, `CREATE TABLE` without RLS
- **Env block** — Prevents Claude from touching `.env` files
- **Pre-compact** — Saves state before context compression

### Enforced State Machine

Every workflow step calls `state.js` — a Node.js state machine that validates preconditions (including plan content), updates both STATE.md and tracking.json atomically, and tracks gap-closure cycles. The gap-closure limit is configurable per project (default: 2). A `--force` flag enables recovery after failed builds.

### Wave-Based Parallelization

Plans are grouped into waves for parallel execution. No fancy DAG solver — the planner assigns wave numbers, the orchestrator spawns agents per wave. Pragmatic over clever.

### Plans Are Prompts

Plan files aren't documents that get translated into prompts — they ARE the prompts. `@file` references, explicit task actions, and verification criteria baked in. This eliminates translation loss between "what we planned" and "what Claude actually reads."

## Architecture

```
npx qualia-framework-v2 install
     |
     v
~/.claude/
  ├── skills/          19 slash commands
  ├── agents/          planner.md, builder.md, verifier.md, qa-browser.md
  ├── hooks/           8 Node.js hooks — cross-platform (no bash dependency)
  ├── bin/             state.js (state machine) + qualia-ui.js (cosmetics library)
  ├── knowledge/       learned-patterns.md, common-fixes.md, client-prefs.md (loaded by plan/debug/new)
  ├── rules/           security.md, frontend.md, design-reference.md, deployment.md
  ├── qualia-templates/ tracking.json, state.md, project.md, plan.md, DESIGN.md
  ├── CLAUDE.md        global instructions (role-configured per team member)
  └── statusline.js    teal-branded 2-line status bar
```

## For Qualia Solutions Team

Stack: Next.js 16+, React 19, TypeScript, Supabase, Vercel.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

Built by [Qualia Solutions](https://qualiasolutions.net) — Nicosia, Cyprus.
