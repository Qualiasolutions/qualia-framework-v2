# Qualia Framework v2

A prompt orchestration framework for [Claude Code](https://claude.ai/code). It installs into `~/.claude/` and wraps your AI-assisted development workflow with structured planning, execution, verification, and deployment gates.

It is not an application framework like Rails or Next.js. It doesn't generate code, run servers, or process data. It's an opinionated workflow layer that tells Claude how to plan, build, and verify your projects.

## Install

```bash
npx qualia-framework-v2 install
```

Enter your team code when prompted. Get your code from Fawzi.

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
/qualia-report    # Log your work (mandatory)
```

See `guide.md` for the full developer guide.

## What's Inside

- **17 skills** — slash commands from setup to handoff, plus debugging, design, review, and session management
- **3 agents** — planner, builder, verifier (each in fresh context)
- **7 hooks** — branch guard, pre-push tracking sync, env protection, migration guard, deploy gate, pre-compact state save, session start
- **3 rules** — security, frontend, deployment
- **4 templates** — tracking.json, state.md, project.md, plan.md

## Why It Works

### Goal-Backward Verification

Most CI checks "did the task run." Qualia checks "does the outcome actually work." The verifier doesn't trust summaries — it greps the codebase for stubs, placeholders, unwired imports. When Claude says "I built the chat component," this catches the cases where it wrote a skeleton with `// TODO` inside.

### Agent Separation

Splitting planner, builder, and verifier into separate agents with separate contexts prevents the "God prompt" problem where one massive context tries to plan AND code AND test. Each agent gets fresh context. This directly addresses Claude's quality degradation curve — task 50 gets the same quality as task 1.

### Production-Grade Hooks

The `settings.json` hooks are real ops engineering, not theoretical:

- **Pre-deploy gate** — TypeScript, lint, tests, build, and `service_role` leak scan before `vercel --prod`
- **Branch guard** — Role-aware: owner can push to main, employees can't
- **Migration guard** — Catches `DROP TABLE` without `IF EXISTS`, `DELETE` without `WHERE`, `CREATE TABLE` without RLS
- **Env block** — Prevents Claude from touching `.env` files
- **Pre-compact** — Saves state before context compression

### Enforced State Machine

Every workflow step calls `state.js` — a Node.js state machine that validates preconditions, updates both STATE.md and tracking.json atomically, and tracks gap-closure cycles. You can't build without planning, can't verify without building, and can't loop on gap-closure more than twice before escalating.

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
  ├── skills/          17 slash commands
  ├── agents/          planner.md, builder.md, verifier.md
  ├── hooks/           7 shell scripts (branch, env, migration, deploy, push, compact, session)
  ├── bin/             state.js (state machine with precondition enforcement)
  ├── rules/           security.md, frontend.md, deployment.md
  ├── qualia-templates/ tracking.json, state.md, project.md, plan.md
  ├── CLAUDE.md        global instructions (role-configured per team member)
  └── statusline.sh    teal-branded 2-line status bar
```

## For Qualia Solutions Team

Stack: Next.js 16+, React 19, TypeScript, Supabase, Vercel.

Built by [Qualia Solutions](https://qualiasolutions.net) — Nicosia, Cyprus.
