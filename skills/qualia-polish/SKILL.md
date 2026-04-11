---
name: qualia-polish
description: "Design and UX pass — anti-AI-slop, genuine craft, responsive, accessible. Run after all phases are verified."
---

# /qualia-polish — Design Pass

Makes it look like a human designer built it. Kills AI slop. Run after all feature phases are verified.

## The Standard

Every site Qualia ships must feel **designed, not generated.** AI-generated sites have tells:
- Identical card grids with rounded corners and soft shadows
- Blue-purple gradients on everything
- Inter/system-ui font with no hierarchy
- Generic hero with centered text and a stock gradient background
- Fixed-width containers leaving dead space on wide screens
- No motion, no personality, no opinion
- Perfect symmetry everywhere (real design has tension)

**Kill all of these.** A Qualia site should make someone ask "who designed this?" — not "which template is this?"

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner polish
```

### 0. Load Design Context

```bash
cat .planning/DESIGN.md 2>/dev/null || echo "NO_DESIGN"
```

If DESIGN.md exists → it's the standard. If not → use `rules/frontend.md` defaults.

Read EVERY frontend file before modifying. No blind edits.

### 1. AI Slop Detector

Run these checks first. Any hits = mandatory fixes.

```bash
# Generic fonts (the #1 AI tell)
grep -rn "Inter\|Roboto\|Arial\|Helvetica\|system-ui\|Space.Grotesk" --include="*.tsx" --include="*.css" --include="*.scss" --include="tailwind*" app/ components/ src/ 2>/dev/null | grep -v node_modules

# Hardcoded max-width containers (screams template)
grep -rn "max-w-7xl\|max-w-\[1200\|max-w-\[1280\|max-width.*1200\|max-width.*1280" --include="*.tsx" --include="*.css" app/ components/ src/ 2>/dev/null

# Blue-purple gradients
grep -rn "from-blue.*to-purple\|from-purple.*to-blue\|linear-gradient.*blue.*purple\|linear-gradient.*purple.*blue\|from-indigo.*to-violet" --include="*.tsx" --include="*.css" app/ components/ src/ 2>/dev/null

# Card grid monotony (same card component repeated in a grid)
grep -rn "grid-cols-3\|grid-cols-4" --include="*.tsx" app/ components/ src/ 2>/dev/null | head -5

# Generic hero patterns
grep -rn "text-center.*mx-auto\|Hero\|hero" --include="*.tsx" app/ components/ src/ 2>/dev/null | head -5

# Scattered hardcoded colors (no design system)
grep -rn "text-\[#\|bg-\[#\|border-\[#\|color:.*#\|background:.*#" --include="*.tsx" app/ components/ src/ 2>/dev/null | wc -l
```

**Every hit gets fixed.** Not flagged — fixed.

### 2. Typography Pass

**Goal:** A reader should feel the type was chosen, not defaulted.

- Pick a distinctive display font. Not Inter, not Roboto, not system. Something with character: Clash Display, Cabinet Grotesk, General Sans, Satoshi, Plus Jakarta Sans, Outfit, Sora, Manrope. Pair with a clean body font.
- Establish clear hierarchy: display (hero text) → h1 → h2 → h3 → body → caption
- Body: 16px minimum, line-height 1.5-1.7
- Headings: tighter line-height (1.1-1.3), negative letter-spacing (-0.02em) for display sizes
- Weight hierarchy: Regular (400) for body, Medium (500) for labels, Semibold (600) for headings, Bold (700) for display
- Prose content: `max-width: 65ch`. Everything else: fluid full-width.
- Use `clamp()` for fluid sizing: `clamp(2rem, 1rem + 3vw, 3.75rem)` for h1

### 3. Color & Surfaces

**Goal:** A palette that looks intentional, not random.

- Define all colors as CSS variables or Tailwind config — zero scattered hex values
- One dominant brand color. One sharp accent for CTAs that pops against the page.
- Surfaces: layer them. Background → card → elevated card. Use subtle shade differences, not just white-on-white.
- Dark mode (if present): rethink surfaces, don't just invert. Slightly reduce contrast. Use darker brand colors, not just white→black swap.
- Semantic colors with non-color indicators: success (green + checkmark), error (red + icon), warning (amber + triangle)
- Verify WCAG AA: 4.5:1 for normal text, 3:1 for large text (18px+ bold or 24px+)

### 4. Layout & Spacing

**Goal:** Full-width, fluid, generous. No dead space gutters.

- Full-width layouts with fluid padding: `clamp(1rem, 5vw, 4rem)` horizontal
- 8px spacing grid: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Tight spacing within groups (related items). Generous spacing between sections.
- Break symmetry where it serves the design — offset grids, overlapping elements, diagonal flow
- Varied layouts: not every section should be a centered-text-with-cards-below. Use side-by-side, staggered, asymmetric, full-bleed.
- Section spacing: `clamp(2rem, 8vw, 6rem)` vertical padding

### 5. Interactive States

**Goal:** Every clickable thing responds. Every async operation shows progress.

- **Hover:** color shift or underline within 150ms ease-out. `cursor: pointer` on ALL clickables.
- **Focus:** visible ring (2px+ offset, contrasting color). Never `outline: none` without replacement.
- **Active/pressed:** subtle scale down (`transform: scale(0.98)`) or color shift.
- **Disabled:** opacity 0.5 + `cursor: not-allowed` + `aria-disabled="true"`
- **Loading:** skeleton shimmer or spinner on every async operation. Never a blank void.
- **Empty:** helpful message + CTA on empty lists/tables. Not just "No results."
- **Error:** user-friendly message + recovery action. Not raw error text. Use `aria-live="assertive"`.

### 6. Motion & Personality

**Goal:** The site feels alive, not static. But tasteful — not a circus.

- Page load: stagger children entrance (50-80ms delay between items, `fadeUp` animation, 300ms)
- Hover transitions: 150-200ms ease-out
- Section transitions: 300-500ms with `cubic-bezier(0.4, 0, 0.2, 1)`
- One signature motion that gives the site personality (parallax, scroll-triggered reveal, magnetic buttons, morphing shapes)
- **Always** `prefers-reduced-motion: reduce` — disable non-essential animation
- CSS-only for static sites, `motion/react` (formerly Framer Motion) for React

### 7. Accessibility (Non-Negotiable)

- Semantic HTML: `nav`, `main`, `section`, `article`, `header`, `footer` — not div soup
- One `h1` per page, sequential heading order (no h1 → h3 skip)
- All images: descriptive `alt` (or `alt=""` + `aria-hidden` if decorative)
- All form inputs: visible `<label>` with `htmlFor` — not placeholder-only
- All interactive elements: keyboard accessible (Tab, Enter, Escape, Arrow keys)
- Touch targets: 44x44px minimum
- Skip link: `<a href="#main" class="sr-only focus:not-sr-only">` as first focusable element
- `<html lang="en">` set
- Color never the sole information carrier — icons, text, patterns as supplements
- `aria-live="polite"` for toast notifications and dynamic content updates

### 8. Responsive (Mobile-First)

- Base styles for mobile (320px), scale up with `min-width` breakpoints
- Test at: 320px (small phone), 375px (iPhone), 768px (iPad), 1024px (laptop), 1440px (desktop)
- No horizontal scroll at any viewport
- Navigation: hamburger/drawer on mobile, full horizontal on desktop
- Stack on mobile, expand on desktop
- Fluid typography with `clamp()`
- Images: `max-width: 100%`, responsive `srcset`, `next/image` with width/height
- Tables: card layout or horizontal scroll on mobile

### 9. Harden (Edge Cases)

After all visual work, stress-test:
- Long text: does a 200-character username break the layout?
- Empty everywhere: all lists empty, all data missing — does it still make sense?
- Error everywhere: every fetch fails — are error states visible and helpful?
- 320px viewport: nothing overflows, nothing clips, nothing overlaps
- Keyboard only: Tab through the entire app — can you reach everything? Is focus visible?
- Slow network: are loading states visible? Does content stream in or flash?

### 10. Verify & Ship

```bash
npx tsc --noEmit 2>&1 | head -20
```

Fix any TypeScript errors.

```bash
git add {changed files}
git commit -m "polish: design pass — typography, color, states, motion, responsive, a11y"
```

```bash
node ~/.claude/bin/state.js transition --to polished
```

```bash
node ~/.claude/bin/qualia-ui.js divider
node ~/.claude/bin/qualia-ui.js ok "AI slop: killed"
node ~/.claude/bin/qualia-ui.js ok "Typography: {brief}"
node ~/.claude/bin/qualia-ui.js ok "Color: {brief}"
node ~/.claude/bin/qualia-ui.js ok "Layout: {brief}"
node ~/.claude/bin/qualia-ui.js ok "States: {brief}"
node ~/.claude/bin/qualia-ui.js ok "Motion: {brief}"
node ~/.claude/bin/qualia-ui.js ok "Accessibility: {brief}"
node ~/.claude/bin/qualia-ui.js ok "Responsive: {brief}"
node ~/.claude/bin/qualia-ui.js ok "Hardened: {brief}"
node ~/.claude/bin/qualia-ui.js end "POLISHED" "/qualia-ship"
```

## Rules

1. **Read before write.** Understand every file before changing it.
2. **DESIGN.md is law.** If it exists, follow it. Don't override client decisions.
3. **Don't break functionality.** Only change styling, never logic.
4. **AI slop is a bug.** Generic fonts, card grids, blue-purple gradients, centered-everything — treat these as defects, not preferences.
5. **TypeScript must pass** after every change.
6. **One commit** at the end — not per category.
