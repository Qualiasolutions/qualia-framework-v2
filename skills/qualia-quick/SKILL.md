---
name: qualia-quick
description: "Fast path for small tasks — bug fixes, tweaks, hot fixes. Skips full phase planning."
---

# /qualia-quick — Quick Task

For tasks under 1 hour that don't need full phase planning. Single file changes, bug fixes, config tweaks, typo fixes.

## Process

1. **Understand:** Ask what needs to be done (or read the instruction)
2. **Build:** Do it directly — read before write, MVP only
3. **Verify:** Run `npx tsc --noEmit`, test locally
4. **Commit:** Atomic commit with clear message
5. **Update:** Update tracking.json notes field

```bash
git add {specific files}
git commit -m "fix: {description}"
```

No plan file. No subagents. Just build and ship.

Update STATE.md last activity. Update tracking.json notes.
