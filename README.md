# Qualia Framework v2

Claude Code workflow framework for Qualia Solutions. Guides projects from setup to client handoff.

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
/qualia-plan      # Plan the current phase
/qualia-build     # Build it
/qualia-verify    # Verify it works
/qualia-ship      # Deploy
/qualia-report    # Log your work
```

See `guide.md` for the full developer guide.

## What's Inside

- **10 skills** — the commands that guide you from setup to handoff
- **3 agents** — planner, builder, verifier (each in fresh context)
- **6 hooks** — session start, branch guard, env protection, deploy gate, state save, tracking sync
- **3 rules** — security, frontend, deployment
- **4 templates** — tracking.json, state.md, project.md, plan.md

## Architecture

- **Context isolation:** Each task runs in a fresh AI context. No quality degradation.
- **Goal-backward verification:** Verifier greps the code to check if things actually work.
- **Plans are prompts:** Plan files ARE the builder's instructions.
- **Wave execution:** Independent tasks run in parallel.
- **ERP integration:** `tracking.json` updated on every push, ERP reads via git.

## For Qualia Solutions Team

Stack: Next.js, React, TypeScript, Supabase, Vercel.
