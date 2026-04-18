---
name: qualia-new
description: "Set up a new project from scratch — deep questioning, ALWAYS-AUTO research, JOURNEY.md with all milestones to handoff, single approval gate, optional auto-chain into building. Use when starting any new client project."
---

# /qualia-new — New Project (Full Journey)

Initialize a project with the **entire arc mapped from kickoff to handoff**. All milestones defined upfront so the team follows a clear path, not improvising after each ship.

## Flags

- `/qualia-new` — full-journey flow, stops after approval (default, backward-compatible)
- `/qualia-new --auto` — full-journey flow, then auto-chains into `/qualia-plan 1 → /qualia-build → /qualia-verify` for Milestone 1
- `/qualia-new --quick` — 4-phase flat wizard for trivial projects (landing pages, prototypes). Skips research and journey mapping.

## The Shift From Previous Versions

**Before:** `/qualia-new` produced a v1 ROADMAP and stopped. Team improvised subsequent milestones ad hoc.

**Now:** `/qualia-new` produces **JOURNEY.md** (all milestones → Handoff) + REQUIREMENTS.md (multi-milestone, REQ-IDs) + ROADMAP.md (Milestone 1's phase detail). **One approval gate** on the whole journey. Research always runs — no permission ask.

## Process

### Step 0. Banner

```bash
node ~/.claude/bin/qualia-ui.js banner new
```

Then say: **"Let's build something. Tell me what you want to make."**

Wait for free-text answer. Do NOT use AskUserQuestion here — let them talk naturally.

### Step 0.5. Brownfield Check

```bash
test -f package.json && echo "HAS_PACKAGE"
test -d .git && echo "HAS_GIT"
test -f .planning/codebase/README.md && echo "ALREADY_MAPPED"
```

If existing code is detected AND not already mapped, ask the user whether to run `/qualia-map` inline first. If yes, invoke the `qualia-map` skill inline, wait for completion, then continue to Step 1.

### Step 1. Deep Questioning

Load the questioning methodology:

```bash
cat ~/.claude/qualia-references/questioning.md 2>/dev/null
```

Follow the thread. Challenge vagueness. Make abstract concrete. Check the 4-item mental checklist (what, why, who, done).

Use `AskUserQuestion` for forks with 2-4 concrete interpretations. Use free text when you want them to think freely.

**Decision gate** — when you could write a clear PROJECT.md:

- header: "Ready?"
- question: "I understand what you're building. Create PROJECT.md and move forward?"
- options: ["Create PROJECT.md", "Keep exploring"]

Loop until "Create PROJECT.md".

### Step 2. Detect Project Type

From questioning answers, infer type → `website` | `ai-agent` | `voice-agent` | `mobile-app` | `null`. If matched, `cat ~/.claude/qualia-templates/projects/{type}.md` gives suggested milestone arc. Store `template_type` for Step 10.

### Step 3. Design Direction (frontend only)

- header: "Design"
- question: "What's the design vibe?"
- options: ["Dark & Bold", "Clean & Minimal", "Colorful & Playful", "Corporate / Professional"]

Plus free-text: "Any brand colors or reference sites I should look at?"

### Step 4. Client Context

- header: "Client"
- question: "Client project or internal?"
- options: ["Client project", "Internal / Qualia", "Personal / Side project"]

If client, ask name. Check saved prefs:
```bash
cat ~/.claude/knowledge/client-prefs.md 2>/dev/null | grep -A 10 "{client name}"
```

### Step 5. Write PROJECT.md

Create `.planning/PROJECT.md` from the template. Include: client, what we're building, core value, validated + active requirements (empty for greenfield), out of scope, stack, design direction, decisions table.

```bash
git init 2>/dev/null
git add .planning/PROJECT.md
git commit -m "docs: initialize project"
```

### Step 6. Create config.json

```json
{
  "mode": "interactive",
  "depth": "standard",
  "template_type": "{detected or null}",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
```

**Note:** `workflow.research` is ALWAYS `true` for v4. It exists for telemetry but is no longer read as a gate.

### Step 7. Create DESIGN.md (frontend projects)

If frontend work is involved, generate `.planning/DESIGN.md` from the template with concrete palette, distinctive typography (NEVER Inter/Roboto/system-ui), 8px spacing grid, motion approach, component patterns.

```bash
git add .planning/DESIGN.md .planning/config.json
git commit -m "docs: design direction + config"
```

### Step 8. Run Research (ALWAYS, no permission ask)

**In v4, research runs unconditionally.** The previous `workflow.research` gate is gone. Skipping research leads to generic roadmaps and surprises late in the project — the 4-agent cost is worth it.

Only `/qualia-new --quick` skips this step.

```bash
node ~/.claude/bin/qualia-ui.js banner research
mkdir -p .planning/research
```

Say: **"Running 4 parallel research agents (stack, features, architecture, pitfalls)..."**

Spawn 4 researchers in parallel (single message, 4 Agent tool calls), with multi-milestone scope:

```
Agent(prompt="
Read your role: @~/.claude/agents/researcher.md

<dimension>stack</dimension>
<domain>{inferred domain from PROJECT.md}</domain>
<project_context>{PROJECT.md summary}</project_context>
<milestone_context>multi-milestone — research must cover scalability through Milestone 3+</milestone_context>
<output_path>.planning/research/STACK.md</output_path>
", subagent_type="qualia-researcher", description="Stack research")

Agent(prompt="
Read your role: @~/.claude/agents/researcher.md

<dimension>features</dimension>
<domain>{inferred domain}</domain>
<project_context>{PROJECT.md summary}</project_context>
<milestone_context>multi-milestone — distinguish v1 table stakes from v2 differentiators</milestone_context>
<output_path>.planning/research/FEATURES.md</output_path>
", subagent_type="qualia-researcher", description="Features research")

Agent(prompt="
Read your role: @~/.claude/agents/researcher.md

<dimension>architecture</dimension>
<domain>{inferred domain}</domain>
<project_context>{PROJECT.md summary}</project_context>
<milestone_context>multi-milestone — Phase 1 foundations must support final-milestone requirements</milestone_context>
<output_path>.planning/research/ARCHITECTURE.md</output_path>
", subagent_type="qualia-researcher", description="Architecture research")

Agent(prompt="
Read your role: @~/.claude/agents/researcher.md

<dimension>pitfalls</dimension>
<domain>{inferred domain}</domain>
<project_context>{PROJECT.md summary}</project_context>
<milestone_context>multi-milestone — flag risks that stall LATER milestones, not just v1</milestone_context>
<output_path>.planning/research/PITFALLS.md</output_path>
", subagent_type="qualia-researcher", description="Pitfalls research")
```

**After all 4 complete, spawn synthesizer:**

```
Agent(prompt="
Read your role: @~/.claude/agents/research-synthesizer.md

Merge the 4 research files at .planning/research/ into .planning/research/SUMMARY.md.
This is a multi-milestone project — the SUMMARY must suggest a FULL milestone arc
(2-5 milestones including Handoff), not just a v1 phase list. Include roadmap
implications AND handoff implications (what client takeover requires).
", subagent_type="qualia-research-synthesizer", description="Synthesize research")
```

**Commit:**
```bash
git add .planning/research/
git commit -m "docs: research synthesis (4 dimensions, multi-milestone scope)"
```

Show key findings:
```bash
node ~/.claude/bin/qualia-ui.js ok "Research complete"
```
Display top 3 from SUMMARY.md (stack recommendation, table stakes, top pitfall).

### Step 9. Feature Scoping (Multi-Milestone)

Read `.planning/research/FEATURES.md` and present the feature landscape. Unlike v3, features are scoped **to milestones**, not just to v1/v2.

For each category, use AskUserQuestion:

- header: "{Category name}"
- question: "Which {category} features belong to v1 (Milestones 1..N-1 excluding Handoff)?"
- multiSelect: true
- options: each feature from FEATURES.md + "None for v1"

Track selections:
- Selected → v1 scope (roadmapper assigns to specific milestones based on dependency order)
- Unselected table stakes → Post-Handoff v2 (users expect these)
- Unselected differentiators → Out of Scope

Gather any additional requirements the user wants that research missed.

### Step 10. Run Roadmapper

```bash
node ~/.claude/bin/qualia-ui.js banner roadmap
```

Spawn the roadmapper with full-journey mandate:

```
Agent(prompt="
Read your role: @~/.claude/agents/roadmapper.md

<task>
Create the FULL JOURNEY for this project:
  - .planning/JOURNEY.md — all milestones (2-5 including Handoff) with exit criteria
  - .planning/REQUIREMENTS.md — requirements grouped by milestone
  - .planning/ROADMAP.md — Milestone 1's phase detail only (ready for /qualia-plan 1)

User-scoped v1 features:
{list of features selected in Step 9, grouped by category}

Template type: {template_type from config.json}
If set, use ~/.claude/qualia-templates/projects/{type}.md as the milestone arc starting point.

The final milestone MUST be named 'Handoff' with the fixed 4 phases
(Polish, Content + SEO, Final QA, Handoff). Do not omit it.

After writing, update STATE.md via:
  node ~/.claude/bin/state.js init \\
    --project '{name}' --client '{client}' --type '{type}' \\
    --milestone_name '{Milestone 1 name}' \\
    --phases '<JSON: Milestone 1 phases only>' \\
    --total_phases <count>
</task>
", subagent_type="qualia-roadmapper", description="Create full journey")
```

### Step 11. Present the Journey (single view)

Render the branded journey ladder:

```bash
node ~/.claude/bin/qualia-ui.js journey-tree .planning/JOURNEY.md
```

This shows M1..M{N} as a vertical ladder: shipped milestones get a green dot, current gets a teal diamond with `[CURRENT]` tag, future get dim open circles. Handoff gets `[FINAL]` tag. Why-now + phase sketch render under current and final.

Also narrate the one-glance summary:

```
## Proposed Journey

**{N} milestones to handoff** | **{X} requirements mapped** | All v1 requirements covered ✓

  ┌─ Milestone 1 · {Name}               [CURRENT]
  │  Why now: {one line}
  │  Exit: {outcome 1}, {outcome 2}
  │  Phases: 1. {name} → 2. {name} → 3. {name}
  │  Requirements: {REQ-IDs}
  └─
         ↓
  ┌─ Milestone 2 · {Name}
  │  Why now: {one line}
  │  Exit: {outcome 1}, {outcome 2}
  │  Phases: 1. {name} → 2. {name}
  │  Requirements: {REQ-IDs}
  └─
         ↓
  ...
         ↓
  ┌─ Milestone {N} · Handoff           [FINAL]
  │  Exit: Deployed, docs, credentials, walkthrough
  │  Phases: 1. Polish → 2. Content + SEO → 3. Final QA → 4. Handoff
  └─

Milestone 1 is fully planned. Milestones 2..{N-1} are sketched and will be detailed
when they open. Milestone {N} (Handoff) uses the standard 4-phase template.
```

### Step 12. Approval Gate (single — for the whole journey)

- header: "Journey"
- question: "Does this journey work for you?"
- options:
  - "Approve" — commit the full journey and continue
  - "Adjust" — tell me what to change (milestones, phases, exit criteria, scope)
  - "Review full JOURNEY.md" — show the raw file

**If "Adjust":** capture feedback, re-spawn roadmapper with revision context, re-present. Loop until approved.

**If "Review full JOURNEY.md":** `cat .planning/JOURNEY.md`, then re-ask.

**If "Approve":**

```bash
git add .planning/JOURNEY.md .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/STATE.md
git commit -m "docs: journey + requirements + milestone 1 roadmap ({N} milestones)"
```

### Step 13. Environment Setup

Supabase project? `supabase link` or create. Vercel project? `vercel link`. Env vars? `.env.local` with placeholders from PROJECT.md stack.

Skip if user says "I'll handle env myself."

```bash
git add .gitignore
git commit -m "chore: environment setup" 2>/dev/null
```

### Step 14. Auto-Apply Gate (or stop here)

If invoked with `--auto`, skip straight into building Milestone 1:

```bash
node ~/.claude/bin/qualia-ui.js info "Auto mode — chaining into /qualia-plan 1"
```

Then inline-invoke `/qualia-plan 1`. That skill will chain into `/qualia-build 1 → /qualia-verify 1 → /qualia-plan 2 → ...` until Milestone 1's last phase verifies, at which point the chain pauses at the milestone boundary and asks:

- header: "Milestone 1 shipped"
- question: "Continue to Milestone 2 ({next milestone name})?"
- options: ["Continue", "Pause here"]

**Without `--auto`**, end with a clear pointer:

```bash
node ~/.claude/bin/qualia-ui.js end "JOURNEY READY" "/qualia-plan 1"
```

Show summary:

```
⬢ PROJECT INITIALIZED

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | .planning/PROJECT.md        |
| Journey        | .planning/JOURNEY.md        |
| Requirements   | .planning/REQUIREMENTS.md   |
| Roadmap (M1)   | .planning/ROADMAP.md        |
| Design         | .planning/DESIGN.md         |
| Research       | .planning/research/         |
| State          | .planning/STATE.md          |
| Config         | .planning/config.json       |

{N} milestones | {X} requirements | Ready to build Milestone 1: {name}

▶ Next: /qualia-plan 1
(or rerun with /qualia-new --auto to chain through automatically)
```

## --quick Flag (Fast Path, Unchanged)

`/qualia-new --quick` still runs the 4-phase flat wizard for trivial projects (landing pages with 1-2 sections, throwaway prototypes). Creates PROJECT.md + a simplified ROADMAP.md + DESIGN.md + STATE.md. No JOURNEY.md, no research, no multi-milestone. Routes to `/qualia-plan 1`.

Do NOT use `--quick` for: client projects, anything with compliance stakes, anything longer than one week.

## Rules

1. **Research runs automatically.** No permission ask. Only `--quick` skips it. This is a v4 invariant.
2. **The journey includes Handoff.** Every project's final milestone is literally named "Handoff" with 4 standard phases. The roadmapper enforces this.
3. **Single approval gate.** One gate for the whole journey. Not per-milestone, not per-phase.
4. **Milestone count: 2-5.** Hard floor 2, hard ceiling 5. Bigger projects defer remainder to post-handoff v2.
5. **Milestone 1 is fully detailed.** M2..M{N-1} are sketched. Detail fills in when each milestone opens.
6. **STATE.md through state.js.** Never edit STATE.md or tracking.json by hand.
7. **Inline skill invocation.** When Step 0.5 offers `/qualia-map`, invoke it inline — don't exit.
