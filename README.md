# Qualia Framework v4

A harness engineering framework for [Claude Code](https://claude.ai/code). It installs into `~/.claude/` and wraps your AI-assisted development workflow with structured planning, execution, verification, and deployment gates.

It is not an application framework like Rails or Next.js. It doesn't generate code, run servers, or process data. It's an opinionated workflow layer that tells Claude how to plan, build, and verify your projects — end-to-end, from "tell me what you want to make" to "here's the handoff doc for your client."

**v4 is the Full Journey release.** `/qualia-new` now maps the entire project arc from kickoff to client handoff upfront (all milestones, not just v1), and the Road can chain itself end-to-end in `--auto` mode with only two human gates per project. Story-file plan format, goal-backward verification, and the 4-dimension scoring rubric from v3 all carry forward.

## Install

```bash
npx qualia-framework@latest install
```

Enter your team code when prompted. Get your code from Fawzi.

> **Why `@latest`?** npx caches packages at `~/.npm/_npx/` and has no time-based TTL — `npx qualia-framework install` (without `@latest`) will silently run whatever version you happened to fetch the first time, even if a newer one shipped. Always pin `@latest` when installing or upgrading. If a stale cache still bites you: `npx clear-npx-cache` then re-run.

**Other commands:**
```bash
npx qualia-framework@latest version    # Check installed version + updates
npx qualia-framework@latest update     # Update to latest (remembers your code)
npx qualia-framework@latest uninstall  # Clean removal from ~/.claude/
npx qualia-framework@latest team list  # Show team members
npx qualia-framework@latest team add   # Add a team member
npx qualia-framework@latest traces     # View recent hook telemetry
```

## Usage

Open Claude Code in any project directory.

### The Road — guided mode (default)

```
/qualia-new         # Set up a project: questioning + research + JOURNEY.md with all milestones → Handoff
/qualia-plan N      # Plan phase N of the current milestone (story-file format, plan-checker validation loop)
/qualia-build N     # Build phase N (builder subagents with pre-inlined context, wave-based parallel tasks)
/qualia-verify N    # Verify phase N works (goal-backward + per-task acceptance criteria + browser QA)
...repeat plan/build/verify per phase...
/qualia-milestone   # Close current milestone, open next (loads next scope from JOURNEY.md)
...repeat per milestone until the final "Handoff" milestone...
/qualia-polish      # Design and UX pass (first phase of the Handoff milestone)
/qualia-ship        # Deploy to production
/qualia-handoff     # Enforce the 4 mandatory handoff deliverables
/qualia-report      # Mandatory end-of-session report + ERP upload
```

### The Road — auto mode

```
/qualia-new --auto
```

Research runs automatically. User approves the full journey once. Framework chains plan → build → verify → (next phase) → ... → milestone boundary. User approves continuation per milestone. Framework resumes, eventually reaches the Handoff milestone's last phase → ship → handoff → report. Done.

Two human gates per project. One halt case (gap-cycle limit exceeded on a failing phase).

### Phase-specific depth (optional)

```
/qualia-discuss N   # Capture decisions before planning a complex phase (locks constraints for the planner)
/qualia-research N  # Deep-research a niche phase (Context7/WebFetch/WebSearch)
/qualia-map         # Map existing codebase (brownfield projects — run before /qualia-new)
```

### Navigation & state

```
/qualia           # Mechanical state router — "what's my next command?"
/qualia-idk       # Diagnostic — "what's actually going on?" Two isolated scans (planning / codebase), then a plain-language explanation
/qualia-pause     # Save session, continue later
/qualia-resume    # Pick up where you left off
```

### Quality & shortcuts

```
/qualia-debug     # Structured debugging
/qualia-design    # One-shot design transformation
/qualia-review    # Production audit (scored diagnostics)
/qualia-optimize  # Deep optimization pass (parallel specialist agents)
/qualia-quick     # Fast path for trivial fixes (skips planning)
/qualia-task      # Build one thing properly (fresh builder, atomic commit, no phase plan)
/qualia-test      # Generate or run tests
```

### Knowledge & meta

```
/qualia-learn     # Save a pattern, fix, or client pref to ~/.claude/knowledge/
/qualia-skill-new # Author a new Qualia skill or agent
/qualia-help      # Open the framework reference in your browser
```

See `guide.md` for the full developer guide.

## The Full Journey (v4)

Every v4 project has a `.planning/JOURNEY.md` — the North Star document that maps the entire arc from kickoff to client handoff.

```
Project
└─ Journey (all milestones defined upfront)
   └─ Milestone (a release — 2-5 total, Handoff is always last)
      └─ Phase (a feature-sized deliverable, 2-5 tasks)
         └─ Task (atomic unit, one commit, one verification contract)
```

**Hard rules:**
- Hard floor: 2 milestones. Hard ceiling: 5.
- Final milestone is **always literally named "Handoff"** with 4 fixed phases (Polish, Content + SEO, Final QA, Handoff).
- Every non-Handoff milestone needs **≥ 2 phases** (enforced by `state.js close-milestone`).
- Milestone numbering is contiguous.

**Why it matters:** non-technical team members can follow the ladder from any entry point. `/qualia` and `/qualia-milestone` render JOURNEY.md as a visual ladder with current position highlighted.

## What's Inside (v4.0.0)

- **26 skills** — from setup to handoff, plus debug, design, review, optimize, diagnostic (`qualia-idk`), session management, skill authoring, per-phase depth (discuss, research, map), and full-journey additions (`--auto` chaining, milestone closure)
- **8 agents** (each runs in fresh context): planner, builder, verifier, qa-browser, researcher, research-synthesizer, roadmapper, plan-checker
- **7 hooks** (pure Node.js, cross-platform): session-start, branch-guard, pre-push tracking sync, migration-guard, pre-deploy-gate, pre-compact state save, auto-update
- **5 rules**: security, frontend, design-reference, deployment, infrastructure
- **19 template files**: project.md, **journey.md** (new in v4), plan.md (story-file format), state.md, DESIGN.md, tracking.json (now with `milestone_name` + `milestones[]`), requirements.md (multi-milestone), roadmap.md (current milestone only), phase-context.md, 4 project-type templates (website, ai-agent, voice-agent, mobile-app), 5 research-project templates (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY), help.html
- **1 reference** — questioning.md methodology for deep project initialization

## Supported Platforms

Works on **Windows 10/11, macOS, and Linux**. Requires Node.js 18+ and Claude Code.

- Every hook and the status line are pure Node.js — no external bash, jq, or GNU coreutils required.
- Skills are executed by Claude Code's own Bash tool (which Claude Code provides on all platforms, including Windows).
- Tested on Fedora, EndeavourOS, macOS, and Windows 10/11.

## Why It Works

### Full Journey (v4)

`/qualia-new` maps every milestone from kickoff to handoff. Team members see the entire ladder before climbing. No improvising the next chunk after each ship. The final milestone is always "Handoff" with 4 mandatory deliverables (verified production URL, updated docs, archived client assets, final ERP report) — so the path to "shipped" is visible from day 1.

### Auto-Chain End-to-End

`--auto` mode chains `/qualia-plan → /qualia-build → /qualia-verify → …` without re-typing commands. The framework pauses only at real decisions: journey approval at kickoff, each milestone boundary, and one halt on gap-cycle-limit failures. Everything in between runs on rails.

### Goal-Backward Verification

Most CI checks "did the task run." Qualia checks "does the outcome actually work." The verifier scores on 4 dimensions (Correctness, Completeness, Wiring, Quality), each 1–5, with a hard threshold at 3. It doesn't trust summaries — it greps the codebase for stubs, placeholders, unwired imports, and walks each task's observable Acceptance Criteria.

### Story-File Plans (Plans Are Prompts)

Plan files aren't documents that get translated into prompts — they ARE the prompts. Every task carries inline `Why` (rationale), `Acceptance Criteria` (observable user behaviors), `Depends on` (explicit ordering), and `Validation` (self-check commands) before the builder touches code. `@file` references tell the orchestrator what to pre-inline into the builder's prompt, saving 3-5 orientation Read calls per task.

### Agent Separation

Splitting planner, builder, and verifier into separate agents with separate contexts prevents the "God prompt" problem. Each agent gets fresh context. Task 50 gets the same quality as task 1.

### Production-Grade Hooks

All 7 hooks are real ops engineering, not theoretical:

- **Pre-deploy gate** — TypeScript, lint, tests, build, and `service_role` leak scan before `vercel --prod`
- **Branch guard** — Role-aware: owner can push to main, employees can't (parses refspec so `feature/x:main` bypass is blocked)
- **Migration guard** — Catches `DROP TABLE` without `IF EXISTS`, `DELETE`/`UPDATE` without `WHERE`, `CREATE TABLE` without RLS, `GRANT ... TO PUBLIC`, `ALTER TABLE ... DROP COLUMN`
- **Pre-push** — Stamps tracking.json via a bot commit so the ERP always sees fresh data
- **Pre-compact** — Saves state before context compression

### Enforced State Machine

Every workflow step calls `state.js` — a Node.js state machine that validates preconditions (including plan content), updates both STATE.md and tracking.json atomically, and tracks gap-closure cycles. v4 adds milestone readiness guards: `close-milestone` refuses to close a milestone with unverified phases or < 2 phases (unless `--force`), and appends a summary to `tracking.json.milestones[]` so the ERP renders a clean project tree.

### Wave-Based Parallelization

Plans are grouped into waves for parallel execution. No fancy DAG solver — the planner assigns wave numbers, the orchestrator spawns agents per wave. Pragmatic over clever.

### Diagnostic Intelligence

`/qualia-idk` is a real diagnostician (not a router alias). When the user's confusion is about *understanding the situation*, it spawns two isolated scans in parallel — one reads only `.planning/`, the other reads only source code — then synthesizes a plain-language "What I see / What I think is happening / What to do next" diagnosis. Catches plan↔code drift that a state-only router can't see.

## Architecture

```
npx qualia-framework@latest install
     |
     v
~/.claude/
  ├── skills/             26 slash commands
  ├── agents/             8 agent definitions (planner, builder, verifier, qa-browser, roadmapper, research-synthesizer, researcher, plan-checker)
  ├── hooks/              7 Node.js hooks — cross-platform (no bash dependency)
  ├── bin/                state.js (state machine) + qualia-ui.js (cosmetics, banners, journey-tree) + statusline.js
  ├── knowledge/          learned-patterns.md, common-fixes.md, client-prefs.md
  ├── rules/              security, frontend, design-reference, deployment, infrastructure
  ├── qualia-templates/   project.md, journey.md, plan.md (story-file), state.md, DESIGN.md, tracking.json, requirements.md, roadmap.md, + projects/*.md + research-project/*.md + help.html
  ├── qualia-references/  questioning.md (deep project initialization methodology)
  ├── CLAUDE.md           global instructions (role-configured per team member)
  └── (settings.json wired for hooks, statusline, spinner verbs, etc.)
```

## For Qualia Solutions Team

Stack: Next.js 16+, React 19, TypeScript, Supabase, Vercel. Voice: Retell AI, ElevenLabs, Telnyx. AI: OpenRouter. Compute: Railway (agents/background jobs).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the full version history. v4.0.0 release notes are the most recent section.

Built by [Qualia Solutions](https://qualiasolutions.net) — Nicosia, Cyprus.
