---
name: qualia-debug
description: "Structured debugging — symptom gathering, diagnosis confirmation, root cause analysis. Trigger on 'debug', 'find bug', 'fix error', 'something is broken', 'not working', 'weird behavior', 'layout broken', 'CSS issue', 'slow page', 'performance'."
---

# /qualia-debug — Structured Debugging

Systematic debugging. Don't guess — gather symptoms, confirm diagnosis, then fix.

## Usage

- `/qualia-debug` — Interactive (gather symptoms, diagnose, fix)
- `/qualia-debug --frontend` — CSS/layout/visual issues
- `/qualia-debug --perf` — Performance issues

## Interactive Mode (Default)

### 1. Gather Symptoms

Ask:
- What's happening? (exact error or behavior)
- What should happen instead?
- When did it start? (after what change?)
- What have you tried?

### 2. Confirm Diagnosis

Before ANY code changes, present your diagnosis:

> "Based on the symptoms, I think: [diagnosis]. I'll investigate [specific area]. Does that match what you're seeing?"

Wait for confirmation. If user corrects → adjust. Never proceed on a wrong diagnosis.

### 3. Investigate and Fix

1. Reproduce the issue
2. Isolate the cause (binary search: which file, which function, which line)
3. Identify root cause (not symptoms)
4. Implement minimal fix
5. Verify fix works
6. Check for related issues

### 4. Commit

```bash
git add {specific files}
git commit -m "fix: {what was broken and why}"
```

## Frontend Mode (`--frontend`)

For layout breaks, z-index issues, overflow, animation glitches.

**Quick diagnostics:**
- Z-index not working → element needs `position: relative/absolute/fixed`, check parent stacking contexts
- Horizontal scroll → use `width: 100%` not `100vw`, find overflowing element
- Flex overflow → add `min-width: 0`
- Grid blowout → use `minmax(0, 1fr)`
- Janky animations → only animate `transform` and `opacity`
- Safari → `-webkit-backdrop-filter`, `100dvh` not `100vh`

## Performance Mode (`--perf`)

### Investigate
1. Profile the bottleneck (network, render, compute, database)
2. Measure baseline
3. Identify the hot path

### Common fixes
- Slow queries → check indexes, `EXPLAIN ANALYZE`, optimize joins
- Large bundles → code split, lazy load, tree shake
- Slow renders → memoize, virtualize long lists
- API latency → cache, reduce payload, parallelize requests
