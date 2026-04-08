---
name: qualia-design
description: "One-shot design transformation — critiques, fixes, polishes, hardens, makes responsive. No reports, no choices, just makes it professional. Trigger on 'fix the design', 'make it look better', 'redesign', 'design pass', 'make it modern', 'it looks ugly', 'fix the UI'."
---

# /qualia-design — One-Shot Design Transformation

Read the code, understand what's wrong, fix everything, move on. No reports, no choices.

## Usage

- `/qualia-design` — Full transformation on all frontend files
- `/qualia-design app/page.tsx` — Specific file(s)
- `/qualia-design --scope=dashboard` — Transform a section

## Process

### 1. Read Brand Context

```bash
cat .planning/DESIGN.md 2>/dev/null || echo "NO_DESIGN"
```

If DESIGN.md exists → use it. If not → use Qualia defaults: distinctive fonts, sharp accents, layered backgrounds, no card grids, no blue-purple gradients, full-width layouts.

### 2. Find Target Files

- If specific files given: use those
- If `--scope`: grep for matching files in `app/` and `components/`
- If none: find all `page.tsx`, `layout.tsx`, and component files

Read EVERY target file before modifying.

### 3. Critique (internal — don't output)

Evaluate each file on: AI slop detection, visual hierarchy, typography, color, states (loading/error/empty), motion, spacing, responsiveness, microcopy.

### 4. Fix Everything

**Typography:** Replace generic fonts (Inter, Arial) with distinctive ones. Proper type scale, line-height 1.5-1.7 body.

**Color:** Cohesive palette from DESIGN.md or brand. Sharp accent for CTAs. WCAG AA contrast.

**Layout:** Full-width with fluid padding `clamp(1rem, 5vw, 4rem)`. NO hardcoded max-width caps. Prose gets `max-width: 65ch`.

**Spacing:** Consistent scale (8px grid). Generous whitespace between sections, tight within groups.

**Motion:** CSS transitions 200-300ms on hover/focus. Staggered entrance animations. `prefers-reduced-motion` respected.

**States:** Loading skeleton/spinner on async ops. Error states on data fetches. Empty states on lists. Hover/focus/active/disabled on interactive elements.

**Responsive:** Mobile-first. Touch targets 44x44px min. Stack on mobile, expand on desktop. No horizontal scroll.

**Kill:** Card grids → varied layouts. Generic heroes → distinctive. Blue-purple gradients → brand colors. Static pages → purposeful motion. Fixed widths → fluid.

### 5. Verify

```bash
npx tsc --noEmit 2>&1 | head -20
```

Fix any TypeScript errors before committing.

### 6. Commit

```bash
git add {modified files}
git commit -m "style: design transformation"
```

```
◆ Design Transformation Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Files: {N}
  Changes:
  - {key change 1}
  - {key change 2}
  - {key change 3}

  Fine-tune: /bolder, /design-quieter, /colorize, /animate
```

## Rules

- Read before write — understand every file before changing it
- Don't ask — just fix
- Respect DESIGN.md decisions
- Don't break functionality — only change styling, never logic
- TypeScript must pass after changes
