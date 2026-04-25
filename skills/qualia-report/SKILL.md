---
name: qualia-report
description: "Generate session report and commit to repo. Mandatory before clock-out."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# /qualia-report — Session Report

Generate a concise report of what was done. Committed to git and uploaded to the ERP for clock-out.

## Flags

- `/qualia-report` — normal flow (generate, commit, push, upload to ERP)
- `/qualia-report --dry-run` — generate + show payload, SKIP upload and SKIP commit. Useful for debugging or previewing before a real clock-out.

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

### 4. Obtain Client Report ID (QS-REPORT-NN)

Each session report gets a stable, sequential client-side identifier that travels with the report all the way to the ERP. The sequence is per-project, persisted in `tracking.json.report_seq`.

```bash
# --dry-run: peek without incrementing
# Wrap the pipe in try/catch so a state.js failure (missing tracking.json,
# corrupt JSON) produces a clear error instead of silently becoming "".
PEEK_FLAG=""
[ "$DRY_RUN" = "true" ] && PEEK_FLAG="--peek"
CLIENT_REPORT_ID=$(node ~/.claude/bin/state.js next-report-id $PEEK_FLAG 2>/dev/null | node -e "
  try {
    const raw = require('fs').readFileSync(0,'utf8');
    if (!raw.trim()) process.exit(2);
    const j = JSON.parse(raw);
    if (!j.report_id) process.exit(3);
    process.stdout.write(j.report_id);
  } catch (e) { process.exit(1); }
")

if [ -z "$CLIENT_REPORT_ID" ]; then
  node ~/.claude/bin/qualia-ui.js fail "Could not obtain report ID from state.js — is .planning/tracking.json valid?"
  exit 1
fi
```

Example: first report on a fresh project → `QS-REPORT-01`. Next → `QS-REPORT-02`. Etc.

### 5. Commit and Push (SKIP on --dry-run)

```bash
if [ "$DRY_RUN" != "true" ]; then
  mkdir -p .planning/reports
  git add .planning/reports/report-{date}.md .planning/tracking.json
  git commit -m "report: {CLIENT_REPORT_ID} session {YYYY-MM-DD}"
  git push
fi
```

### 6. Upload to ERP (SKIP on --dry-run)

Read `~/.claude/.qualia-config.json` and check the `erp` object:
- If `erp.enabled` is `false`, skip this step and print: "ERP upload skipped (disabled in config)."
- If `erp.enabled` is `true` (default) or the `erp` field is missing (backward compatibility), proceed with the upload.

```bash
# Read ERP config
ERP_URL=$(node -e "try{const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/.qualia-config.json','utf8'));console.log(c.erp?.url||'https://portal.qualiasolutions.net')}catch{console.log('https://portal.qualiasolutions.net')}")
ERP_ENABLED=$(node -e "try{const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/.qualia-config.json','utf8'));console.log(c.erp?.enabled!==false)}catch{console.log('true')}")

API_KEY=$(cat ~/.claude/.erp-api-key 2>/dev/null)
REPORT_FILE=".planning/reports/report-{date}.md"
SUBMITTED_BY=$(git config user.name || echo "unknown")
SUBMITTED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Guard: ERP upload requires a non-empty API key. Without this check, curl
# would POST with "Authorization: Bearer " (blank bearer) and the server
# returns a generic 401 that is hard to diagnose.
if [ "$ERP_ENABLED" = "true" ] && [ -z "$API_KEY" ] && [ "$DRY_RUN" != "true" ]; then
  node ~/.claude/bin/qualia-ui.js warn "ERP API key missing (~/.claude/.erp-api-key is empty or unreadable). Skipping upload."
  node ~/.claude/bin/qualia-ui.js info "Ask Fawzi for the ERP key, save to ~/.claude/.erp-api-key, then re-run /qualia-report --upload-only."
  ERP_ENABLED="false"
fi

# Build structured JSON payload from tracking.json (matches ERP contract /api/v1/reports)
# v4: include milestone_name, milestones[], team_id, project_id, git_remote,
# session_started_at, last_pushed_at, build_count, deploy_count — the ERP
# uses these to render the project tree (milestone → phases → unphased) correctly.
# v4.0.4: client_report_id carries the QS-REPORT-NN identifier.
# Build payload. Pass user-controlled values (SUBMITTED_BY, CLIENT_REPORT_ID,
# SUBMITTED_AT, REPORT_FILE) via env vars instead of shell interpolation — a
# single quote or backslash in git user.name would otherwise break the node -e
# script silently. process.env.* is inert to shell metacharacters.
PAYLOAD=$(
  SUBMITTED_BY="$SUBMITTED_BY" \
  SUBMITTED_AT="$SUBMITTED_AT" \
  CLIENT_REPORT_ID="$CLIENT_REPORT_ID" \
  REPORT_FILE="$REPORT_FILE" \
  node -e "
    const fs = require('fs');
    const t = JSON.parse(fs.readFileSync('.planning/tracking.json', 'utf8'));
    const notes = fs.readFileSync(process.env.REPORT_FILE, 'utf8').substring(0, 60000);
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
      client_id: t.client_id || '',
      framework_version: t.framework_version || '',
      client_report_id: process.env.CLIENT_REPORT_ID,
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
      submitted_by: process.env.SUBMITTED_BY || 'unknown',
      submitted_at: process.env.SUBMITTED_AT
    }));
  "
)

# --dry-run: print payload and stop (no POST, no commit, no increment already handled in step 4)
if [ "$DRY_RUN" = "true" ]; then
  echo "--- DRY RUN · payload ---"
  echo "$PAYLOAD" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify(d,null,2))"
  echo "--- DRY RUN · would POST to: $ERP_URL/api/v1/reports ---"
  echo "--- DRY RUN · client_report_id would be: $CLIENT_REPORT_ID ---"
  exit 0
fi

# Real upload — 3 attempts with exponential backoff (1s, 3s, 9s).
# The local report file is already committed, so a failed upload doesn't
# lose data — it just leaves the ERP view stale until the next push or
# manual retry.
if [ "$ERP_ENABLED" = "true" ]; then
  MAX_ATTEMPTS=3
  ATTEMPT=1
  SUCCESS=false
  while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    RESPONSE=$(curl -sS -X POST "$ERP_URL/api/v1/reports" \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      --max-time 10 \
      -w "\n__HTTP__%{http_code}" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | grep -o "__HTTP__[0-9]*" | sed 's/__HTTP__//')
    BODY=$(echo "$RESPONSE" | sed 's/__HTTP__[0-9]*//g')

    if [ "$HTTP_CODE" = "200" ]; then
      SUCCESS=true
      # Parse and display the ERP-returned report_id alongside our local QS-REPORT-NN
      ERP_REPORT_ID=$(echo "$BODY" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.report_id||'')}catch{}")
      node ~/.claude/bin/qualia-ui.js ok "Uploaded as $CLIENT_REPORT_ID (ERP: ${ERP_REPORT_ID:-none})"
      break
    fi

    # 401 / 422 are permanent failures — no retry.
    if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "422" ]; then
      if [ "$HTTP_CODE" = "401" ]; then
        node ~/.claude/bin/qualia-ui.js warn "ERP auth failed (HTTP 401) — API key in ~/.claude/.erp-api-key is invalid or revoked. Ask Fawzi for a fresh key."
      else
        node ~/.claude/bin/qualia-ui.js warn "ERP rejected payload (HTTP 422) — schema validation failed. Response body:"
      fi
      echo "$BODY" | head -3
      break
    fi

    # Transient failure — back off and retry.
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
      SLEEP=$(( 1 * 3 ** (ATTEMPT - 1) ))
      node ~/.claude/bin/qualia-ui.js warn "ERP upload attempt $ATTEMPT failed (HTTP ${HTTP_CODE:-timeout}), retrying in ${SLEEP}s..."
      sleep $SLEEP
    fi
    ATTEMPT=$(( ATTEMPT + 1 ))
  done

  if [ "$SUCCESS" != "true" ]; then
    node ~/.claude/bin/qualia-ui.js warn "ERP upload failed after $MAX_ATTEMPTS attempts. $CLIENT_REPORT_ID is committed locally; it will NOT appear in the ERP until you retry with 'curl' or re-run /qualia-report."
  fi
fi

if [ "$ERP_ENABLED" != "true" ]; then
  node ~/.claude/bin/qualia-ui.js info "ERP upload skipped (disabled in config). Report committed locally as $CLIENT_REPORT_ID."
fi
```

Summary rules:
- **Upload succeeds:** print "Uploaded as QS-REPORT-NN (ERP: {uuid})". Employee can clock out.
- **401/422:** no retry. Print the error, tell the employee to ask Fawzi.
- **Transient (timeout, 5xx, network):** retry 3x with 1s/3s/9s backoff.
- **All retries fail:** tell employee the report is committed locally, ERP will be stale until retry.
- **ERP disabled:** skip silently with a note, local commit still happens.

### 7. Update State (SKIP on --dry-run)

```bash
if [ "$DRY_RUN" != "true" ]; then
  node ~/.claude/bin/state.js transition --to activity --notes "Session report $CLIENT_REPORT_ID generated"
fi
```

Do NOT manually edit STATE.md or tracking.json — state.js handles both.

Employee cannot skip this. Run `/qualia-report` before clock-out.
