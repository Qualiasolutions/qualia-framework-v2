---
globs: ["*.tsx", "*.jsx", "*.css", "*.scss", "tailwind.config.*"]
---

# Frontend Design Standards

These are Qualia brand standards — mandatory for every frontend component. Not suggestions.

## Typography

**Never use:** Inter, Roboto, Arial, Helvetica, system-ui, Space Grotesk (overused by AI).

- Pair a distinctive display font with a refined body font
- Type scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60 / 72
- Body: 16px min, line-height 1.5–1.7
- Headings: line-height 1.1–1.3, letter-spacing -0.02em for large sizes
- Weight hierarchy: Regular (400) body, Medium (500) labels, Semibold (600) headings, Bold (700) display
- Prose max-width: 65ch. Everything else: fluid full-width

## Color

- Commit to a cohesive palette — define in CSS variables
- One dominant brand color with sharp accent for CTAs
- Never: blue-purple gradients, rainbow palettes, gray-on-gray
- Dark mode: not just inverted — rethink surfaces, reduce contrast slightly
- Semantic colors: success (green), warning (amber), error (red), info (blue) — always with non-color indicator too
- All text must meet **WCAG AA** contrast: 4.5:1 normal text, 3:1 large text (18px+ bold or 24px+)

## Layout

- Full-width layouts — no hardcoded `max-width: 1200px` or `1280px` caps
- Fluid padding: `clamp(1rem, 5vw, 4rem)` for horizontal, generous vertical
- 8px spacing grid: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96
- Tight spacing within groups, generous between sections
- Asymmetry > symmetry. Overlap, diagonal flow, grid-breaking elements when appropriate
- No card grids — use varied layouts with visual hierarchy
- No generic hero sections — make them distinctive and purposeful

## Motion & Animation

- Hover/focus transitions: 150–200ms ease-out
- Expand/collapse: 200–300ms ease-in-out
- Page transitions: 300–500ms ease-out
- Staggered entrance animations: 50–80ms delay between items
- **Always** respect `prefers-reduced-motion: reduce` — disable non-essential animation
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (standard), `cubic-bezier(0, 0, 0.2, 1)` (decelerate), `cubic-bezier(0.4, 0, 1, 1)` (accelerate)
- One well-orchestrated page load > scattered micro-interactions
- CSS-only for HTML projects, Motion library (`motion/react`) for React

## States (Every Interactive Element)

- **Loading:** Skeleton or spinner on async operations — never a blank void
- **Empty:** Helpful message + action when lists/data are empty — never "No results"
- **Error:** User-friendly message + recovery action — never raw error text
- **Hover:** Visual feedback within 100ms
- **Focus:** Visible focus ring (2px+ offset, high contrast) — never `outline: none` without replacement
- **Active/Pressed:** Scale down slightly or color shift
- **Disabled:** Reduced opacity (0.5) + `cursor: not-allowed` + `aria-disabled`

## Accessibility (WCAG AA Minimum)

- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<header>`, `<footer>` — not divs for everything
- Heading hierarchy: One `<h1>` per page, sequential order (no skipping h2→h4)
- All images: descriptive `alt` text (or `alt=""` + `aria-hidden` if decorative)
- All form inputs: visible `<label>` linked via `htmlFor` — not placeholder-only
- All interactive elements: keyboard accessible (Tab, Enter, Escape, Arrow keys)
- Touch targets: 44x44px minimum
- ARIA: use native HTML elements first. Only add ARIA when HTML semantics aren't enough
- Never rely solely on color to convey information — add icons, text, or patterns
- Skip link: `<a href="#main" class="sr-only focus:not-sr-only">` on every page
- Live regions: `aria-live="polite"` for dynamic content updates (toasts, form validation)

## Responsive Design

- Mobile-first: base styles for mobile, `@media (min-width)` for larger screens
- Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`
- Fluid typography: `clamp(1rem, 0.5rem + 1.5vw, 1.25rem)` for body, scale up for headings
- Stack on mobile, expand on desktop — never force horizontal scroll
- Test: 320px (small phone), 375px (iPhone), 768px (tablet), 1024px (laptop), 1440px (desktop)
- Images: `max-width: 100%`, `height: auto`, use `srcset` for responsive images
- Navigation: hamburger menu on mobile, expanded on desktop

## Component Quality

- `cursor: pointer` on ALL clickable elements
- Smooth transitions (150–300ms) on all state changes
- No emoji as icons — use SVGs or icon libraries
- Buttons: clear visual hierarchy (primary, secondary, ghost, destructive)
- Inputs: visible borders, focus rings, error states with `aria-describedby`
- Links: distinguishable from text (underline or color + another indicator)
- Modals: trap focus, close on Escape, `aria-modal="true"`, restore focus on close
- Toast/notifications: `aria-live`, auto-dismiss with adequate time (5s+), dismissible

## Anti-Patterns (Kill on Sight)

- Card grids where every card looks identical → varied layouts
- Generic hero with stock photo → distinctive, purposeful hero
- Blue-purple gradients → brand colors
- Static pages with no motion → purposeful animation
- Fixed widths → fluid responsive
- Gray text on white (#999 on #fff fails WCAG) → proper contrast
- Placeholder text shipped to production → real content or proper empty states
- `outline: none` without focus replacement → visible focus indicators
- `div` soup → semantic HTML
- Hardcoded colors scattered in JSX → CSS variables or Tailwind config

## Design System Integration

If `.planning/DESIGN.md` exists in the project, it takes precedence over these defaults.
Read it before any frontend work. It contains project-specific: palette, typography, spacing, component patterns.

## Impeccable Design Skills (global)
- `/polish` — Final detail pass before shipping
- `/bolder` — Amplify safe/boring designs
- `/design-quieter` — Tone down overly aggressive designs
- `/animate` — Add purposeful micro-interactions
- `/colorize` — Inject strategic color into monochrome UIs
- `/clarify` — Fix unclear UX copy, labels, error messages
- `/critique` — Design director-level review
- `/distill` — Strip unnecessary complexity
- `/delight` — Add memorable touches and personality
- `/harden` — Edge cases, overflow, i18n robustness
- `/responsive` — Cross-device responsive adaptation

### Recommended workflow
1. Build feature → 2. `/critique` → 3. `/polish` → 4. `/harden` → ship
