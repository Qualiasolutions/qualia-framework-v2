---
name: qualia-polish
description: "Design and UX pass — critique, polish, harden. Run after all phases are verified."
---

# /qualia-polish — Design Pass

Run after all feature phases are verified. Makes it look production-ready.

## Process

```
◆ QUALIA ► POLISHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 0. Load Design Context

```bash
cat .planning/DESIGN.md 2>/dev/null || echo "NO_DESIGN"
```

If DESIGN.md exists → use it as the standard. If not → use Qualia defaults from `rules/frontend.md`.

Read EVERY frontend file before modifying. No blind edits.

### 1. Critique (Structured Audit)

Review the entire UI against this checklist. Check each item, note violations with file:line.

**Typography:**
- [ ] No generic fonts (Inter, Roboto, Arial, system-ui, Space Grotesk)
- [ ] Proper type scale with clear hierarchy (display → heading → body → caption)
- [ ] Body text: 16px+, line-height 1.5–1.7
- [ ] Headings: tighter line-height (1.1–1.3), negative letter-spacing for large sizes
- [ ] Prose max-width: 65ch
- [ ] Font weights used for hierarchy (Regular, Medium, Semibold, Bold)

**Color & Contrast:**
- [ ] Cohesive palette via CSS variables (not scattered hex values)
- [ ] All text passes WCAG AA contrast (4.5:1 normal, 3:1 large)
- [ ] CTA buttons use accent color — stand out from the page
- [ ] No blue-purple gradients, no rainbow palettes
- [ ] Dark mode: rethought surfaces (not just inverted)
- [ ] Semantic colors used consistently (success=green, error=red, warning=amber)

**Layout & Spacing:**
- [ ] Full-width fluid layouts — no hardcoded max-width caps
- [ ] 8px spacing grid followed consistently
- [ ] Tight spacing within groups, generous between sections
- [ ] Fluid padding: `clamp(1rem, 5vw, 4rem)` horizontal
- [ ] No identical card grids — varied visual hierarchy
- [ ] No generic heroes — purposeful, distinctive

**Interactive States:**
- [ ] Every button/link: hover (color shift, 150ms), focus (visible ring), active (press feedback), disabled
- [ ] Loading: skeleton or spinner on all async operations
- [ ] Empty: helpful message + action on empty lists/data
- [ ] Error: user-friendly message + recovery action on failed fetches
- [ ] Form validation: inline errors with `aria-describedby`

**Motion:**
- [ ] Hover/focus: 150–200ms transitions
- [ ] Page load: staggered entrance animations (50–80ms delay)
- [ ] Expand/collapse: 250ms ease-in-out
- [ ] `prefers-reduced-motion` respected (no animation for users who opt out)
- [ ] No jank: transforms and opacity only for animated properties

**Accessibility:**
- [ ] Semantic HTML: `nav`, `main`, `section`, `article`, `header`, `footer`
- [ ] One `h1` per page, sequential heading hierarchy
- [ ] All images: descriptive `alt` (or `alt=""` + `aria-hidden` if decorative)
- [ ] All form inputs: visible `<label>` with `htmlFor` — not placeholder-only
- [ ] All interactive elements: keyboard accessible (Tab/Enter/Escape)
- [ ] Touch targets: 44px minimum
- [ ] Skip link: `<a href="#main">` as first focusable element
- [ ] No `outline: none` without focus replacement
- [ ] `<html lang="en">` set
- [ ] Color not sole information carrier — icons/text as supplements

**Responsive:**
- [ ] Mobile-first approach (base styles for mobile, min-width breakpoints for larger)
- [ ] No horizontal scroll at 320px
- [ ] Navigation: hamburger on mobile, expanded on desktop
- [ ] Touch targets adequate on mobile (44px min)
- [ ] Fluid typography with `clamp()`
- [ ] Images: `max-width: 100%`, responsive srcset where needed
- [ ] Tables: card view or horizontal scroll on mobile

**Performance:**
- [ ] Server Components by default — `'use client'` only when needed
- [ ] Images via `next/image` with width/height
- [ ] No barrel file imports — direct imports from source
- [ ] Heavy components lazy-loaded with `next/dynamic`
- [ ] Data fetched in parallel, not sequentially

### 2. Fix Everything

Work through violations from the critique. Fix each category:

1. Typography first (sets the visual foundation)
2. Color & contrast (palette coherence)
3. Layout & spacing (structural fixes)
4. Interactive states (loading, empty, error, hover, focus)
5. Motion (transitions, entrance animations, reduced-motion)
6. Accessibility (semantic HTML, ARIA, keyboard, labels)
7. Responsive (mobile breakpoints, fluid sizing)
8. Performance (quick wins — image optimization, dynamic imports)

### 3. Harden

After polish, stress-test edge cases:
- Long text content (overflow, truncation, word-break)
- Extremely long usernames or email addresses
- Empty data everywhere simultaneously
- Error state on every fetch simultaneously
- 320px viewport width
- Keyboard-only navigation through entire flow
- Screen reader landmarks check (semantic HTML)
- Right-to-left text (if i18n is planned)
- Slow network (loading states visible, no flash of empty content)

### 4. Verify

```bash
npx tsc --noEmit 2>&1 | head -20
```

Fix any TypeScript errors before committing.

### 5. Commit & Transition

```bash
git add {changed files}
git commit -m "polish: design and UX pass — typography, accessibility, responsive, states"
```

```bash
node ~/.claude/bin/state.js transition --to polished
```
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

### 6. Report

```
◆ QUALIA ► POLISHED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Files modified: {N}

  Typography    ✓ {brief}
  Color         ✓ {brief}
  Layout        ✓ {brief}
  States        ✓ {brief}
  Motion        ✓ {brief}
  Accessibility ✓ {brief}
  Responsive    ✓ {brief}
  Performance   ✓ {brief}
  Hardening     ✓ {brief}

  → Run: /qualia-ship
```
