# Qualia Developer Guide

> Follow the road. Type the commands. The framework handles the rest.

## The Road

```
/qualia-new          ← Set up project (once)
     ↓
For each phase:
  /qualia-plan       ← Plan it (planner agent)
  /qualia-build      ← Build it (builder subagents)
  /qualia-verify     ← Verify it works (verifier agent)
     ↓
/qualia-polish       ← Design pass
/qualia-ship         ← Deploy to production
/qualia-handoff      ← Deliver to client
     ↓
Done.
```

## The 10 Commands

| When | Command | What it does |
|------|---------|-------------|
| Starting | `/qualia-new` | Set up project from scratch |
| Building | `/qualia-plan` | Plan the current phase |
| | `/qualia-build` | Build it (parallel tasks) |
| | `/qualia-verify` | Check it actually works |
| Quick fix | `/qualia-quick` | Skip planning, just do it |
| Finishing | `/qualia-polish` | Design and UX pass |
| | `/qualia-ship` | Deploy to production |
| | `/qualia-handoff` | Deliver to client |
| Reporting | `/qualia-report` | Log what you did (mandatory) |
| **Lost?** | **`/qualia`** | **Tells you the exact next command** |

## Rules

1. **Feature branches only** — never push to main
2. **Read before write** — don't edit files you haven't read
3. **MVP first** — build what's asked, nothing extra
4. **`/qualia` is your friend** — lost? type it

## When You're Stuck

```
/qualia       ← "what's next?"
```

If that doesn't help, paste the error and ask Claude directly. If Claude can't fix it, tell Fawzi.

## Session Start / End

**Start:** Claude loads your project context automatically.
**End:** Run `/qualia-report` — this is mandatory before clock-out.

## How It Works (you don't need to know this, but if curious)

- **Context isolation:** Each task runs in a fresh AI brain. Task 50 gets the same quality as Task 1.
- **Goal-backward verification:** The verifier doesn't trust "I built it." It greps the code to check if things actually work.
- **Plans are prompts:** The plan file IS what the builder reads. No translation loss.
- **Wave execution:** Independent tasks run in parallel. Dependent tasks wait.
- **tracking.json:** Updated on every push. The ERP reads it automatically.
