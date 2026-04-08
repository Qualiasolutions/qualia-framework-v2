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

### 1. Critique
Review the entire UI. Check:
- Visual hierarchy and information architecture
- Color consistency, contrast, readability
- Spacing and alignment
- Component consistency across pages

### 2. Polish
Fix what critique found:
- Alignment and spacing issues
- Font consistency
- Color palette adherence (Qualia teal brand)
- Transition and hover state consistency

### 3. Harden
Edge cases and robustness:
- Empty states (no data, loading, error)
- Text overflow, long content
- Mobile responsive (check all breakpoints)
- Error messages (user-friendly, not technical)

### 4. Qualia Frontend Rules
- Distinctive fonts (not Inter/Arial)
- Cohesive color palette with sharp accents
- CSS transitions, staggered animations
- Full-width layouts, no hardcoded max-width caps
- No card grids, no generic heroes, no blue-purple gradients

### 5. Commit & Update

```bash
git add {changed files}
git commit -m "polish: design and UX pass"
```

```bash
node ~/.claude/bin/state.js transition --to polished
```
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

```
  → Run: /qualia-ship
```
