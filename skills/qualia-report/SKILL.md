---
name: qualia-report
description: "Generate session report and commit to repo. Mandatory before clock-out."
---

# /qualia-report — Session Report

Generate a concise report of what was done. Committed to git for the ERP to read.

## Process

### 1. Gather Data

```bash
SINCE="8 hours ago"
echo "---COMMITS---"
git log --oneline --since="$SINCE" 2>/dev/null | head -20
echo "---STATS---"
echo "COUNT:$(git log --oneline --since="$SINCE" 2>/dev/null | wc -l)"
echo "---PROJECT---"
echo "DIR:$(basename $(pwd))"
echo "BRANCH:$(git branch --show-current 2>/dev/null)"
echo "---STATE---"
node ~/.claude/bin/state.js check 2>/dev/null
```

### 2. Synthesize

Build a concise summary:
- **What was done:** 3-6 bullet points. Start with verbs (Built, Fixed, Added). Group related commits.
- **Blockers:** Only if something is actually blocked.
- **Next:** 1-3 clear next actions.

### 3. Generate Report

Write to `.planning/reports/report-{YYYY-MM-DD}.md`:

```markdown
# Session Report — {YYYY-MM-DD}

**Project:** {name}
**Employee:** {git user.name}
**Branch:** {branch}
**Phase:** {N} — {name} ({status})
**Date:** {YYYY-MM-DD}

## What Was Done
- {accomplishment 1}
- {accomplishment 2}
- {accomplishment 3}

## Blockers
None. / - {blocker}

## Next Steps
1. {next action}
2. {next action}

## Commits
{list from git log}
```

### 4. Commit and Push

```bash
mkdir -p .planning/reports
git add .planning/reports/report-{date}.md
git commit -m "report: session {YYYY-MM-DD}"
git push
```

### 5. Update State

```bash
node ~/.claude/bin/state.js transition --to activity --notes "Session report generated"
```

Do NOT manually edit STATE.md or tracking.json — state.js handles both.

Employee cannot skip this. Run `/qualia-report` before clock-out.
