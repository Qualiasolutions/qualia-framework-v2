# Qualia Developer Guide (v4)

> Follow the road. Type the commands. The framework handles the rest.
> v4 adds a `--auto` flag that chains the whole road end-to-end with only two human checkpoints per project.

## The Road

```
/qualia-new                ← Set up project (once). Produces JOURNEY.md — all milestones to handoff.
     ↓
For each phase of the current milestone:
  /qualia-plan             ← Plan it (planner + plan-checker, story-file format)
  /qualia-build            ← Build it (builder subagents with pre-inlined context)
  /qualia-verify           ← Check it actually works (goal-backward + per-task AC)
     ↓
/qualia-milestone          ← Close milestone, open next from JOURNEY.md
     ↓
...repeat per milestone until the Handoff milestone...
     ↓
/qualia-polish             ← Design pass (part of Handoff milestone)
/qualia-ship               ← Deploy to production
/qualia-handoff            ← Enforce the 4 handoff deliverables
     ↓
Done.
```

## Auto Mode (v4)

Append `--auto` to `/qualia-new` and the framework chains every step:

```
/qualia-new --auto
  → research runs → JOURNEY.md written → approve the whole journey ONCE
  → auto: plan 1 → build 1 → verify 1 → plan 2 → build 2 → verify 2 → ...
  → pause at each milestone boundary: "Continue to M{N+1}?"
  → resume: plan 1 → build 1 → ... of new milestone
  → eventually reaches Handoff milestone's last phase → ship → handoff → report → done
```

**Human gates in auto mode (total: 2 per project):**
1. Journey approval after `/qualia-new` research
2. Each milestone boundary

**Plus one halt case:** if a phase fails verification beyond the gap-cycle limit (default 2), the chain stops and asks for human intervention.

## The Road Commands

| When | Command | What it does |
|------|---------|-------------|
| Starting | `/qualia-new` | Set up project with full journey (all milestones → Handoff) |
| Starting (auto) | `/qualia-new --auto` | Same + chain through building automatically |
| Building | `/qualia-plan` | Plan the current phase |
| | `/qualia-build` | Build it (parallel tasks) |
| | `/qualia-verify` | Check it actually works |
| Milestone | `/qualia-milestone` | Close current, open next from JOURNEY.md |
| Quick fix | `/qualia-quick` | Skip planning, just do it |
| Finishing | `/qualia-polish` | Design and UX pass |
| | `/qualia-ship` | Deploy to production |
| | `/qualia-handoff` | Deliver to client (4 mandatory deliverables) |
| Reporting | `/qualia-report` | Log what you did (mandatory before clock-out) |
| Lost? | `/qualia` | Mechanical next-command router |
| Confused? | `/qualia-idk` | Diagnostic — scans planning + code, explains what's going on |

## Full Journey Hierarchy (v4)

```
Project
└─ Journey           (the whole arc — mapped upfront by /qualia-new, lives in .planning/JOURNEY.md)
   └─ Milestone      (a release — 2-5 total, Handoff is always last)
      └─ Phase       (a feature-sized deliverable, 2-5 tasks)
         └─ Task     (atomic unit, one commit, one verification contract)
```

Hard rules (enforced by `state.js` and the roadmapper):
- **Milestone count: 2 to 5.** Final milestone is always literally named "Handoff".
- **≥ 2 phases per non-Handoff milestone** (single-phase "milestones" are phases, not milestones).
- **Milestone numbering is contiguous** — no skipped numbers.
- **Handoff milestone has fixed 4 phases:** Polish, Content + SEO, Final QA, Handoff (credentials + walkthrough + archive + ERP report).

## Rules

1. **Feature branches only** — never push to main
2. **Read before write** — don't edit files you haven't read
3. **MVP first** — build what's asked, nothing extra
4. **Every task has a `Why`** (story-file format) — if you can't explain why a task matters in one sentence, it probably shouldn't exist
5. **`/qualia` is your friend** — lost? type it
6. **`/qualia-idk` is your deeper friend** — not lost on "what command", but confused about the *situation*? Type `idk`.

## When You're Stuck

```
/qualia       ← "what command should I run next?" (state-driven, instant)
/qualia-idk   ← "what's actually going on here?" (diagnostic, scans planning + code, ~30s)
```

If neither helps, paste the error and ask Claude directly. If Claude can't fix it, tell Fawzi.

## Session Start / End

**Start:** Claude loads your project context automatically. The router banner shows your journey position ("M2 of 4 · P2 of 3").
**End:** Run `/qualia-report` — this is mandatory before clock-out. The report is committed to git and (if ERP is enabled) uploaded to https://portal.qualiasolutions.net.

## How It Works (you don't need to know this, but if curious)

- **Journey-first planning:** `/qualia-new` produces JOURNEY.md listing every milestone from kickoff to Handoff with exit criteria and phase sketches. The whole team sees the path on day 1.
- **Context isolation:** Each task runs in a fresh AI brain. Task 50 gets the same quality as Task 1.
- **Pre-inlined context at dispatch:** The builder starts with PROJECT.md, DESIGN.md, and all Context @files already loaded — no wasted orientation reads.
- **Goal-backward verification:** The verifier doesn't trust "I built it." It greps the code to check if things actually work AND walks every task's Acceptance Criteria.
- **Story-file plans:** Every task has Why / Acceptance Criteria / Depends on / Validation inline — the plan IS the brief.
- **Wave execution:** Independent tasks run in parallel. Dependent tasks wait.
- **Milestone-boundary pauses:** In `--auto` mode, the framework pauses only at real decision points. Everything else runs on rails.
- **tracking.json:** Updated on every push. The ERP reads it automatically. v4 adds `milestone_name` + `milestones[]` so the ERP renders a proper tree instead of a flat list.

## Quick Reference

| Situation | Run |
|---|---|
| Starting a new client project | `/qualia-new` (or `/qualia-new --auto` to roll end-to-end) |
| Starting a quick throwaway | `/qualia-new --quick` |
| Brownfield project | `/qualia-map` first, then `/qualia-new` |
| Stuck picking next command | `/qualia` |
| Confused about the situation | `/qualia-idk` |
| Finished the last phase of a milestone | `/qualia-milestone` |
| About to ship | `/qualia-ship` |
| Client is ready to take over | `/qualia-handoff` |
| End of workday | `/qualia-report` (mandatory) |
