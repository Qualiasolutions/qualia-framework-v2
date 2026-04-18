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
SUBMITTED_BY=$(git config user.name)
SUBMITTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Only upload if ERP is enabled
if [ "$ERP_ENABLED" = "true" ]; then
  # Build structured JSON payload from tracking.json (matches ERP contract /api/v1/reports)
  # v4: include milestone_name, milestones[], team_id, project_id, git_remote,
  # session_started_at, last_pushed_at, build_count, deploy_count — the ERP
  # uses these to render the project tree (milestone → phases → unphased) correctly.
  PAYLOAD=$(node -e "
    const fs = require('fs');
    const t = JSON.parse(fs.readFileSync('.planning/tracking.json', 'utf8'));
    const notes = fs.readFileSync('$REPORT_FILE', 'utf8').substring(0, 60000);
    const commits = [];
    try {
      const { spawnSync } = require('child_process');
      const r = spawnSync('git', ['log', '--oneline', '--since=8 hours ago', '--format=%h'], { encoding: 'utf8', timeout: 3000 });
      if (r.stdout) commits.push(...r.stdout.trim().split('\n').filter(Boolean));
    } catch {}
    console.log(JSON.stringify({
      project: t.project || require('path').basename(process.cwd()),
      project_id: t.project_id || '',
      team_id: t.team_id || '',
      git_remote: t.git_remote || '',
      client: t.client || '',
      milestone: t.milestone || 1,
      milestone_name: t.milestone_name || '',
      milestones: Array.isArray(t.milestones) ? t.milestones : [],
      phase: t.phase,
      phase_name: t.phase_name,
      total_phases: t.total_phases,
      status: t.status,
      tasks_done: t.tasks_done || 0,
      tasks_total: t.tasks_total || 0,
      verification: t.verification || 'pending',
      gap_cycles: (t.gap_cycles || {})[String(t.phase)] || 0,
      build_count: t.build_count || 0,
      deploy_count: t.deploy_count || 0,
      deployed_url: t.deployed_url || '',
      session_started_at: t.session_started_at || '',
      last_pushed_at: t.last_pushed_at || '',
      lifetime: t.lifetime || {},
      commits: commits,
      notes: notes,
      submitted_by: '$SUBMITTED_BY',
      submitted_at: '$SUBMITTED_AT'
    }));
  ")

  curl -s -X POST "$ERP_URL/api/v1/reports" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"
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
