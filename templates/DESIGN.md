# Design System — {Project Name}

> Generated during project setup. This is the source of truth for all frontend work.
> Builder agents read this before writing any component. Update it as design evolves.

## Brand

- **Tone:** {dark-bold | clean-minimal | colorful-playful | corporate-professional}
- **Personality:** {1-2 sentences describing the feel — e.g., "Confident and technical, like a Bloomberg terminal meets a luxury brand"}
- **Industry:** {e.g., fintech, healthcare, SaaS, e-commerce}

## Color System

```css
:root {
  /* Primary — brand identity */
  --color-primary: {value};
  --color-primary-hover: {value};
  --color-primary-subtle: {value};  /* backgrounds, badges */

  /* Accent — CTAs, highlights */
  --color-accent: {value};
  --color-accent-hover: {value};

  /* Neutral — text, borders, backgrounds */
  --color-bg: {value};
  --color-bg-subtle: {value};       /* cards, raised surfaces */
  --color-bg-muted: {value};        /* disabled, secondary surfaces */
  --color-text: {value};
  --color-text-muted: {value};      /* secondary text */
  --color-text-subtle: {value};     /* placeholders, hints */
  --color-border: {value};
  --color-border-subtle: {value};

  /* Semantic */
  --color-success: {value};
  --color-warning: {value};
  --color-error: {value};
  --color-info: {value};
}

/* Dark mode overrides */
[data-theme="dark"] {
  --color-bg: {value};
  --color-bg-subtle: {value};
  --color-text: {value};
  /* ... override all tokens ... */
}
```

## Typography

```css
:root {
  /* Font families */
  --font-display: '{Display Font}', {fallback};    /* Hero text, page titles */
  --font-heading: '{Heading Font}', {fallback};     /* Section headings */
  --font-body: '{Body Font}', {fallback};           /* Paragraphs, UI text */
  --font-mono: '{Mono Font}', monospace;            /* Code, data */

  /* Scale */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.8rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.4vw, 0.9rem);
  --text-base: clamp(1rem, 0.5rem + 1.5vw, 1.125rem);
  --text-lg: clamp(1.125rem, 0.75rem + 1.2vw, 1.25rem);
  --text-xl: clamp(1.25rem, 0.75rem + 1.5vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 0.75rem + 2.25vw, 2rem);
  --text-3xl: clamp(1.875rem, 1rem + 2.5vw, 2.5rem);
  --text-4xl: clamp(2.25rem, 1rem + 3vw, 3rem);
  --text-5xl: clamp(3rem, 1rem + 4vw, 4rem);
}
```

**Google Fonts import:** `{URL}`

## Spacing Scale

Based on 8px grid: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128`

- **Within components:** 8–16px
- **Between related elements:** 16–24px
- **Between sections:** 48–96px
- **Page padding:** `clamp(1rem, 5vw, 4rem)` horizontal

## Motion

- **Approach:** {minimal | subtle | expressive}
- **Page load:** staggered fade-up, 60ms delay between elements
- **Hover/focus:** 150ms ease-out
- **Expand/collapse:** 250ms ease-in-out
- **Page transitions:** 400ms ease-out
- **Reduced motion:** all non-essential animations disabled

## Component Patterns

### Buttons
- **Primary:** solid {accent} background, white text, rounded-{radius}
- **Secondary:** bordered, transparent background
- **Ghost:** text-only, hover background
- **Destructive:** red variant for dangerous actions
- **Sizes:** sm (32px), md (40px), lg (48px)

### Inputs
- Border: 1px solid var(--color-border)
- Focus: 2px ring var(--color-primary)
- Error: red border + error text below with `aria-describedby`
- Height: 40px (md), 48px (lg)

### Cards/Surfaces
- Background: var(--color-bg-subtle)
- Border: 1px solid var(--color-border-subtle) or shadow
- Border-radius: {value}
- No identical card grids — vary layout and emphasis

## Responsive Approach

- **Strategy:** mobile-first
- **Primary breakpoints:** 768px (tablet), 1024px (desktop)
- **Navigation:** hamburger on mobile, expanded on desktop
- **Layout:** single column mobile → multi-column desktop
- **Touch targets:** 44px minimum on mobile

## Visual Effects

- {e.g., "Noise texture overlay at 3% opacity on hero sections"}
- {e.g., "Glass-morphism on floating elements: backdrop-blur-xl bg-white/80"}
- {e.g., "Gradient mesh on hero: radial-gradient from primary to transparent"}
- {e.g., "Decorative geometric shapes as background accents"}

## Anti-Patterns (Don't Do This)

- No Inter, Roboto, Arial, system-ui fonts
- No blue-purple gradients
- No identical card grids
- No generic stock-photo heroes
- No hardcoded max-width containers (use fluid layouts)
- No gray-on-gray low-contrast text
