---
globs: ["*.tsx", "*.jsx", "*.css", "*.scss"]
---

# Design Reference — Deep Specs

Detailed values for motion, accessibility, and responsive design. Loaded alongside `frontend.md` for frontend work.

## Motion Specification

### Duration Table

| Action | Duration | Easing | Example |
|--------|----------|--------|---------|
| Micro-feedback | 100ms | ease-out | Button press, checkbox toggle |
| Hover/focus | 150ms | ease-out | Color change, underline appear |
| Small reveal | 200ms | ease-out | Tooltip show, dropdown open |
| Expand/collapse | 250ms | ease-in-out | Accordion, panel slide |
| Page element enter | 300ms | cubic-bezier(0, 0, 0.2, 1) | Card fade-in, section reveal |
| Page transition | 400ms | cubic-bezier(0.4, 0, 0.2, 1) | Route change, modal open |
| Complex orchestration | 500–800ms | staggered | Page load sequence |

### Easing Curves (CSS)

```css
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* General movement */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);     /* Enter screen */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);     /* Exit screen */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Playful bounce */
--ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);   /* Subtle shift */
```

### Stagger Pattern

```css
/* Stagger children on page load */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.stagger > * {
  animation: fadeUp 300ms var(--ease-decelerate) both;
}
.stagger > *:nth-child(1) { animation-delay: 0ms; }
.stagger > *:nth-child(2) { animation-delay: 60ms; }
.stagger > *:nth-child(3) { animation-delay: 120ms; }
.stagger > *:nth-child(4) { animation-delay: 180ms; }
.stagger > *:nth-child(5) { animation-delay: 240ms; }
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## WCAG AA Checklist

### Perceivable
- [ ] All images have descriptive alt text (decorative: `alt=""` + `aria-hidden="true"`)
- [ ] Color contrast: 4.5:1 normal text, 3:1 large text (18px+ bold / 24px+)
- [ ] Color contrast: 3:1 for UI components and graphical objects
- [ ] Information not conveyed by color alone — icons, text, patterns as supplements
- [ ] Video/audio: captions or transcripts where applicable
- [ ] Text resizable to 200% without loss of content
- [ ] Content reflows at 320px viewport width (no horizontal scroll)

### Operable
- [ ] All functionality available via keyboard (Tab, Enter, Space, Escape, Arrows)
- [ ] No keyboard traps (except intentional focus traps in modals)
- [ ] Visible focus indicator: 2px+ ring, contrasting color, no `outline: none` without replacement
- [ ] Skip navigation link as first focusable element
- [ ] Touch targets: 44x44px minimum (48x48px recommended)
- [ ] No content that flashes more than 3 times per second
- [ ] Page titles are descriptive and unique

### Understandable
- [ ] Form inputs have visible labels (not placeholder-only)
- [ ] Error messages identify the field and describe the error
- [ ] Error suggestions explain how to fix the problem
- [ ] Required fields marked with `aria-required="true"` and visual indicator
- [ ] Language set: `<html lang="en">`
- [ ] Consistent navigation across pages
- [ ] No unexpected context changes on input

### Robust
- [ ] Valid HTML (no duplicate IDs, proper nesting)
- [ ] ARIA used correctly: `role`, `aria-label`, `aria-describedby`, `aria-expanded`, `aria-hidden`
- [ ] Dynamic content: `aria-live="polite"` for updates, `aria-live="assertive"` for errors
- [ ] Custom components have proper roles and keyboard interaction patterns

## Responsive Breakpoints

### Strategy: Mobile-First with Fluid Scaling

```css
/* Base: mobile (320px–639px) */
/* sm: 640px+ — large phone / small tablet */
/* md: 768px+ — tablet */
/* lg: 1024px+ — laptop */
/* xl: 1280px+ — desktop */
/* 2xl: 1536px+ — large desktop */
```

### Common Patterns

| Pattern | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Navigation | Hamburger + drawer | Hamburger or condensed | Full horizontal |
| Grid | 1 column | 2 columns | 3–4 columns |
| Sidebar | Hidden, overlay | Collapsible | Always visible |
| Hero | Stacked, full-width | Stacked, padded | Side-by-side |
| Table | Card view or scroll | Scroll with sticky col | Full table |
| Modal | Full screen | Centered, 80% width | Centered, max-width |
| Form | Single column | Single column | Two column for long forms |

### Fluid Typography

```css
/* Body */
font-size: clamp(1rem, 0.5rem + 1.5vw, 1.125rem);

/* H1 */
font-size: clamp(2rem, 1rem + 3vw, 3.75rem);

/* H2 */
font-size: clamp(1.5rem, 0.75rem + 2.25vw, 2.5rem);

/* H3 */
font-size: clamp(1.25rem, 0.75rem + 1.5vw, 1.875rem);
```

### Fluid Spacing

```css
/* Section padding */
padding-inline: clamp(1rem, 5vw, 4rem);
padding-block: clamp(2rem, 8vw, 6rem);

/* Component gap */
gap: clamp(1rem, 3vw, 2rem);
```

## React/Next.js Performance (Critical)

### Priority 1: Eliminate Waterfalls
- Fetch data in parallel (`Promise.all`), not sequentially
- Use Suspense boundaries to stream content progressively
- Prefetch data on hover/focus for anticipated navigation
- Colocate data fetching with the component that needs it

### Priority 2: Bundle Size
- Import specific functions, not entire libraries (`import { format } from 'date-fns'`)
- Avoid barrel files (index.ts re-exports) — import directly from source
- Use `next/dynamic` for heavy components not needed on initial load
- Lazy-load below-fold content and non-critical features

### Priority 3: Rendering
- Server Components by default — only add `'use client'` when needed (state, effects, browser APIs)
- Avoid unnecessary `useEffect` — derive values during render when possible
- Use CSS `content-visibility: auto` for long scrollable lists
- Images: `next/image` with proper `width`/`height` to prevent layout shift

## Compound Component Patterns

When building reusable components:
- **No boolean prop proliferation** (`isCompact`, `showHeader`, `isRounded`) — use composition instead
- Compound components: `<Select>`, `<Select.Trigger>`, `<Select.Content>` with shared context
- Explicit variants: `<Alert.Destructive>` instead of `<Alert isDestructive>`
- Children over render props: `children` for composition, not `renderHeader`/`renderFooter`
- React 19: use `use()` instead of `useContext()`, skip `forwardRef` (ref is a regular prop)
