---
name: qualia-report
description: "Generate session report and commit to repo. Mandatory before clock-out."
---

# /qualia-report — Session Report

Generate a concise report of what was done. Committed to git and uploaded to the ERP for clock-out.

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner report
```

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

### 5. Upload to ERP (if enabled)

Read `~/.claude/.qualia-config.json` and check the `erp` object:
- If `erp.enabled` is `false`, skip this step and print: "ERP upload skipped (disabled in config)."
- If `erp.enabled` is `true` (default) or the `erp` field is missing (backward compatibility), proceed with the upload.

```bash
# Read ERP config
ERP_URL=$(node -e "try{const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/.qualia-config.json','utf8'));console.log(c.erp?.url||'https://portal.qualiasolutions.net')}catch{console.log('https://portal.qualiasolutions.net')}")
ERP_ENABLED=$(node -e "try{const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/.qualia-config.json','utf8'));console.log(c.erp?.enabled!==false)}catch{console.log('true')}")

API_KEY=$(cat ~/.claude/.erp-api-key 2>/dev/null)
REPORT_FILE=".planning/reports/report-{date}.md"
EMAIL=$(git config user.email)
PROJECT=$(basename $(pwd))

# Only upload if ERP is enabled
if [ "$ERP_ENABLED" = "true" ]; then
  curl -s -X POST "$ERP_URL/api/claude/report-upload" \
    -H "X-API-Key: $API_KEY" \
    -F "file=@$REPORT_FILE" \
    -F "employee_email=$EMAIL" \
    -F "project_name=$PROJECT"
fi
```

If the upload succeeds, print: "Report uploaded to ERP. You can now clock out."
If it fails (no API key, network error), print the error and tell the employee to ask Fawzi.
If ERP is disabled, print: "ERP upload skipped (disabled in config)."

### 6. Update State

```bash
node ~/.claude/bin/state.js transition --to activity --notes "Session report generated"
```

Do NOT manually edit STATE.md or tracking.json — state.js handles both.

Employee cannot skip this. Run `/qualia-report` before clock-out.
