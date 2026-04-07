---
name: qualia-report
description: "Generate session report as DOCX and auto-upload to ERP. Mandatory before clock-out."
---

# /qualia-report — Session Report

Generate a concise DOCX report of what was done. Auto-uploads to the ERP.

## Process

### 1. Gather Data

```bash
echo "---COMMITS---"
SINCE="8 hours ago"
git log --oneline --since="$SINCE" 2>/dev/null | head -20
echo "---STATS---"
echo "COUNT:$(git log --oneline --since="$SINCE" 2>/dev/null | wc -l)"
echo "---PROJECT---"
echo "DIR:$(basename $(pwd))"
echo "BRANCH:$(git branch --show-current 2>/dev/null)"
echo "---STATE---"
head -20 .planning/STATE.md 2>/dev/null || echo "no-state"
```

### 2. Synthesize

Build a concise summary:
- **What was done:** 3-6 bullet points. Start with verbs (Built, Fixed, Added). Group related commits.
- **Blockers:** Only if something is actually blocked.
- **Next:** 1-3 clear next actions.

### 3. Generate DOCX

```bash
mkdir -p .planning/reports

cat <<'REPORT_JSON' | python3 ~/.claude/qualia-framework/bin/generate-report-docx.py ".planning/reports/report-$(date +%Y-%m-%d-%H%M).docx"
{
    "project": "{project-name}",
    "user": "{git user.name}",
    "date": "{YYYY-MM-DD}",
    "time": "{HH:MM}",
    "branch": "{branch}",
    "phase": "{Phase N — name}",
    "done": ["{accomplishment 1}", "{accomplishment 2}"],
    "blockers": [],
    "next": ["{next action 1}"]
}
REPORT_JSON
```

### 4. Commit & Upload

```bash
REPORT_FILE=$(ls -t .planning/reports/report-*.docx 2>/dev/null | head -1)
git add "$REPORT_FILE"
git commit -m "report: session $(date +%Y-%m-%d)"
git push
```

Auto-upload to ERP:
```bash
curl -s -X POST "https://portal.qualiasolutions.net/api/claude/report-upload" \
  -H "x-api-key: $CLAUDE_API_KEY" \
  -F "file=@$REPORT_FILE" \
  -F "employee_email=$(git config user.email)" \
  -F "project_name=$(basename $(pwd))"
```

Employee cannot skip this. Report goes directly to the ERP.

Update STATE.md last activity.
