---
name: qualia-design
description: "One-shot design transformation — critiques, fixes, polishes, hardens, makes responsive. No reports, no choices, just makes it professional. Trigger on 'fix the design', 'make it look better', 'redesign', 'design pass', 'make it modern', 'it looks ugly', 'fix the UI'."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
---

# /qualia-design — One-Shot Design Transformation

Read the code, understand what's wrong, fix everything, move on. No reports, no choices.

## Usage

- `/qualia-design` — Full transformation on all frontend files
- `/qualia-design app/page.tsx` — Specific file(s)
- `/qualia-design --scope=dashboard` — Transform a section

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner design
```

### 1. Read Brand Context

```bash
cat .planning/DESIGN.md 2>/dev/null || echo "NO_DESIGN"
```

If DESIGN.md exists → it is law. Use exact values from sections 1-9 (Visual Theme, Color Palette, Typography, Components, Layout, Depth, Do's/Don'ts, Responsive, Agent Prompt Guide). If not → use Qualia defaults from `rules/frontend.md`: distinctive fonts, sharp accents, layered backgrounds, no card grids, no blue-purple gradients, full-width layouts.

### 2. Find Target Files

- If specific files given: use those
- If `--scope`: grep for matching files in `app/` and `components/`
- If none: find all `page.tsx`, `layout.tsx`, and component files

Count them. If ≤ 5, process in main context (step 3a). If > 5, fan out to parallel agents (step 3b).

### 3a. Small File Set (≤ 5 files) — main context

Read EVERY target file before modifying. Critique internally using the structured rubric below, then fix everything (step 4).

**Critique rubric (required — produces the findings you then fix):**

| File | Dimension | Issue | Line | Severity |
|------|-----------|-------|------|----------|
| {path} | Typography/Color/Spacing/States/Responsive/A11y/Motion/Microcopy | {specific problem with quote} | {N} | CRITICAL/HIGH/MEDIUM/LOW |

Apply fixes to every HIGH and CRITICAL item. MEDIUM items fixed if cheap (same file, same category).

### 3b. Large File Set (> 5 files) — parallel fan-out

Split target files into batches of 5. Spawn one Agent per batch IN THE SAME RESPONSE TURN (parallel execution). Each agent receives DESIGN.md inlined + its 5 files + the Design Quality Rubric from `rules/grounding.md`. Agents return their batch's critique table + the actual edits applied. The skill orchestrator fans in the results and runs the final verification (step 5).

**Forked subagents (v4.2.0+):** if the current conversation already contains
design taste discussion (font choices, palette discussion, motion preferences,
or any color/typography critique threaded across multiple turns) AND
`CLAUDE_AGENT_FORK_ENABLED=1` is set in `~/.claude/settings.json` (the v4.2.0
default), prefer **forked subagents** over blank-context fan-out. Forks
inherit the entire conversation history + share the prompt cache, so the
batch agents see the 50k tokens of accumulated taste instead of a 2k-token
compression. Anthropic shipped this in 2026-04 specifically to solve the
"design subagent loses nuance" failure mode (NotebookLM 2026-04-25 source).
Tell Claude explicitly: "spawn forked subagents to handle these batches in
parallel." For variation-generation work (3 alternative homepage designs)
forks are almost always the right call. For mechanical anti-pattern fixes
(rip out `outline:none`, swap font tokens) blank context is fine — no
nuance to inherit. When in doubt, fork — the cost is the same prompt cache.

```
Agent(prompt="
Read your role: builder for design transformation.
Grounding + rubrics: @~/.claude/rules/grounding.md

<design_system>
{inlined DESIGN.md}
</design_system>

<target_files>
{5 file paths + their contents}
</target_files>

Apply the Design Quality Rubric to each file. Fix every dimension scoring below 4. Make the literal edits with the Edit tool. Do NOT change logic — only styling.

Return:
- Critique table (File | Dimension | Issue | Line | Before-score | After-score)
- List of files modified
- Any anti-pattern greps that remain (report, don't fix beyond scope)
", subagent_type="general-purpose", description="Design batch {N}")
```

Do not process files serially in main context — that's what wastes a context window.

### 4. Fix Everything (applies to step 3a OR to each agent in 3b)

Use exact values from DESIGN.md when available. Sections map to fixes:

**Typography (§3):** Apply fonts from hierarchy table. Replace any generic fonts (Inter, Arial) with project fonts. Use exact weights, sizes, letter-spacing from the table. Body line-height 1.5-1.7.

**Color (§2):** Apply palette from CSS variables. Replace scattered hex values with `var(--color-*)`. Verify contrast ratios listed in DESIGN.md.

**Components (§4):** Match button, card, input, badge specs exactly — padding, radius, shadow, hover states.

**Layout (§5):** Full-width with fluid padding `clamp(1rem, 5vw, 4rem)`. Apply spacing scale. NO hardcoded max-width caps. Prose gets `max-width: 65ch`.

**Depth (§6):** Apply shadow levels from elevation table. Use brand-tinted shadows, not neutral gray.

**Motion (§Motion):** CSS transitions 200-300ms on hover/focus. Staggered entrance animations. `prefers-reduced-motion` respected.

**States:** Loading skeleton/spinner on async ops. Error states on data fetches. Empty states on lists. Hover/focus/active/disabled on every interactive element.

**Responsive (§8):** Apply collapsing strategy from table. Mobile-first. Touch targets 44x44px min. No horizontal scroll.

**Anti-Slop (§12):** Run grep patterns from the detection table. Every match = mandatory fix.

**Kill:** Card grids → varied layouts. Generic heroes → distinctive. Blue-purple gradients → brand colors. Static pages → purposeful motion. Fixed widths → fluid.

### 5. Verify

Parallel batch — run these in a single response turn:

```bash
# TypeScript still compiles?
npx tsc --noEmit 2>&1 | head -20

# Reverted anti-patterns (any match = regression)
grep -rn "outline.*none\|outline-none" --include="*.tsx" --include="*.css" app/ components/ src/ 2>/dev/null | grep -v "focus-visible\|focus:"
grep -rn "font-family.*Inter\|font-family.*Arial\|font-family.*system-ui\|Space Grotesk" --include="*.tsx" --include="*.css" app/ components/ src/ 2>/dev/null
grep -rn "max-w-\[1200\|max-w-\[1280\|max-width.*1200\|max-w-7xl" --include="*.tsx" --include="*.css" app/ components/ src/ 2>/dev/null
grep -rn "<img " --include="*.tsx" app/ components/ src/ 2>/dev/null | grep -v "alt="
grep -rn "from-blue.*to-purple\|from-purple.*to-blue" --include="*.tsx" --include="*.css" app/ components/ src/ 2>/dev/null
```

Fix any TypeScript errors before committing. If any anti-pattern grep returned matches, re-fix those files — the transformation is not complete until these greps return empty.

### 6. Commit

```bash
git add {modified files}
git commit -m "style: design transformation"
```

```
⬢ Design Transformation Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Files: {N}
  Changes:
  - {key change 1}
  - {key change 2}
  - {key change 3}

  Next: /qualia-polish (final pass) · /qualia-review (scored audit)
```

## Rules

- Read before write — understand every file before changing it
- Don't ask — just fix
- Respect DESIGN.md decisions
- Don't break functionality — only change styling, never logic
- TypeScript must pass after changes
- All anti-pattern greps in step 5 must return empty before commit
