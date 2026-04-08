---
name: qualia-learn
description: "Save a learning, pattern, fix, or client preference to the knowledge base. Persists across projects and sessions. Trigger on 'remember this', 'save this pattern', 'learned something', 'note for future', 'client prefers', 'qualia-learn'."
---

# /qualia-learn — Save Knowledge

Persist learnings across projects and sessions. Saved to `~/.claude/knowledge/`.

## Usage

- `/qualia-learn` — Interactively save a learning
- `/qualia-learn {description}` — Save directly

## Knowledge Types

### Patterns (`learned-patterns.md`)
Recurring approaches that work (or don't). Architecture decisions, library choices, prompt patterns.

**Example:** "Supabase RLS policies need to be added in the same migration as the table — adding them later causes a window where data is unprotected."

### Fixes (`common-fixes.md`)
Problems you've solved before. Error messages and their solutions.

**Example:** "`next/font` crash on Vercel: caused by importing font in a client component that's also used server-side. Fix: move font import to layout.tsx."

### Client Prefs (`client-prefs.md`)
Client-specific preferences, design choices, requirements.

**Example:** "Acme Corp: prefers dark mode, hates rounded corners, logo must be SVG not PNG, primary color #FF6B00."

## Process

### 1. Classify

If description given, classify automatically. Otherwise ask:

```
What did you learn?
1. Pattern — approach that works (or doesn't)
2. Fix — problem and its solution
3. Client preference — client-specific requirement
```

### 2. Format Entry

```markdown
### {Title} ({date})
**Project:** {current project name or "general"}
**Context:** {brief context — what you were building when you learned this}

{The learning — be specific enough that future-you understands without context}
```

### 3. Append to Knowledge File

```bash
# Append to the right file
echo "{formatted entry}" >> ~/.claude/knowledge/{type}.md
```

- Pattern → `~/.claude/knowledge/learned-patterns.md`
- Fix → `~/.claude/knowledge/common-fixes.md`
- Client pref → `~/.claude/knowledge/client-prefs.md`

### 4. Confirm

```
◆ Saved to {file}
  "{title}"
```

## Reading Knowledge

Skills can read knowledge files for context:
```bash
cat ~/.claude/knowledge/learned-patterns.md 2>/dev/null
cat ~/.claude/knowledge/common-fixes.md 2>/dev/null
cat ~/.claude/knowledge/client-prefs.md 2>/dev/null
```

The `/qualia-debug` skill should check `common-fixes.md` before investigating.
The `/qualia-new` skill should check `client-prefs.md` when setting up client projects.
The `/qualia-plan` skill should check `learned-patterns.md` when planning phases.
