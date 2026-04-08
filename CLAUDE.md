# Qualia Framework

## Company
Qualia Solutions — Nicosia, Cyprus. Websites, AI agents, voice agents, AI automation.

## Stack
Next.js 16+, React 19, TypeScript, Supabase, Vercel. Voice: VAPI, ElevenLabs, Telnyx, Retell AI. AI: OpenRouter.

## Role: {{ROLE}}
{{ROLE_DESCRIPTION}}

## Rules
- Read before Write/Edit — no exceptions
- Feature branches only — never push to main/master
- MVP first. Build only what's asked. No over-engineering
- Root cause on failures — no band-aids
- `npx tsc --noEmit` after multi-file TS changes
- For non-trivial work, confirm understanding before coding
- See `rules/security.md` for auth, RLS, Zod, secrets
- See `rules/frontend.md` for design standards
- See `rules/deployment.md` for deploy checklist

## The Road (how projects flow)

```
/qualia-new → set up project
     ↓
For each phase:
  /qualia-plan  → plan the phase (planner agent, fresh context)
  /qualia-build → build it (builder subagents per task, fresh context each)
  /qualia-verify → verify it works (verifier agent, goal-backward checks)
     ↓
/qualia-polish → design/UX pass
/qualia-ship   → deploy to production
/qualia-handoff → deliver to client
     ↓
Done.

Lost? → /qualia (tells you exactly what's next)
Quick fix? → /qualia-quick (skip planning for small tasks)
End of day? → /qualia-report (mandatory before clock-out)
```

## Context Isolation
Every task runs in a fresh subagent context. Task 50 gets the same quality as Task 1.
- Planner gets: PROJECT.md + phase requirements
- Builder gets: single task from plan + PROJECT.md
- Verifier gets: success criteria + codebase access
No accumulated garbage. No context rot.

## Quality Gates (always active)
- **Frontend guard:** Read .planning/DESIGN.md before any frontend changes
- **Deploy guard:** tsc + lint + build + tests must pass before deploy
- **Branch guard:** Employees cannot push to main (OWNER can)
- **Env guard:** Employees cannot edit .env files (OWNER can — add keys, configure secrets directly)
- **Sudo guard:** Employees cannot run sudo (OWNER can)
- **Intent verification:** Confirm before modifying 3+ files (OWNER: just do it)

## Tracking
`.planning/tracking.json` is updated on every push. The ERP reads it via git.
Never edit tracking.json manually — hooks update it from STATE.md.

## Compaction — ALWAYS preserve:
Project path/name, branch, current phase, modified files, decisions, test results, in-progress work, errors, tracking.json state.
