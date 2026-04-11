---
phase: {N}
goal: "{phase goal}"
tasks: {count}
waves: {count}
---

# Phase {N}: {Name}

Goal: {what must be true when done}

## Task 1 — {title}
**Wave:** 1
**Files:** {files to create or modify}
**Action:** {exactly what to build}
**Context:** Read @{file references}
**Done when:** {observable, testable criterion}

## Task 2 — {title}
**Wave:** 1
**Files:** {files}
**Action:** {what to build}
**Done when:** {criterion}

## Success Criteria
- [ ] {truth 1 — what the user can do}
- [ ] {truth 2}
- [ ] {truth 3}

## Verification Contract

### Contract for Task 1 — {title}
**Check type:** {file-exists | grep-match | command-exit | behavioral}
**Command:** `{exact command the verifier will run}`
**Expected:** {what the output should be}
**Fail if:** {what constitutes failure}

### Contract for Task 2 — {title}
**Check type:** {file-exists | grep-match | command-exit | behavioral}
**Command:** `{exact command}`
**Expected:** {expected output}
**Fail if:** {failure condition}
