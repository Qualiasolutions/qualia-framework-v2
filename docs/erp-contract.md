# ERP API Contract

The Qualia Framework optionally uploads session reports to the company ERP at `https://portal.qualiasolutions.net`. This document specifies the API shape.

## Configuration

Stored in `~/.claude/.qualia-config.json`:

```json
{
  "erp": {
    "enabled": true,
    "url": "https://portal.qualiasolutions.net",
    "api_key_file": ".erp-api-key"
  }
}
```

The API key is read from `~/.claude/.erp-api-key` (file mode 0600).

## Endpoints

### POST /api/v1/reports

Upload a session report.

**Headers:**
```
Authorization: Bearer <api-key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "project": "client-project-name",
  "project_id": "qs-acme-portal",
  "team_id": "qualia-solutions",
  "git_remote": "github.com/QualiasolutionsCY/acme-portal",
  "client": "Client Name",
  "milestone": 2,
  "milestone_name": "Core Product",
  "milestones": [
    {
      "num": 1,
      "name": "Foundation",
      "closed_at": "2026-04-10T18:00:00Z",
      "phases_completed": 3,
      "tasks_completed": 12
    }
  ],
  "phase": 2,
  "phase_name": "Authentication & Dashboard",
  "total_phases": 4,
  "status": "built",
  "tasks_done": 5,
  "tasks_total": 5,
  "verification": "pass",
  "gap_cycles": 0,
  "build_count": 12,
  "deploy_count": 3,
  "deployed_url": "https://client.vercel.app",
  "lifetime": {
    "tasks_completed": 23,
    "phases_completed": 8,
    "milestones_completed": 1,
    "total_phases": 8,
    "last_closed_milestone": 1
  },
  "session_started_at": "2026-04-12T13:45:00Z",
  "session_duration_minutes": 45,
  "last_pushed_at": "2026-04-12T14:25:00Z",
  "commits": ["abc1234", "def5678"],
  "notes": "Completed auth flow, dashboard layout, and API routes.",
  "submitted_by": "Fawzi Goussous",
  "submitted_at": "2026-04-12T14:30:00Z"
}
```

**`gap_cycles` polymorphism (v3.5+):** in `tracking.json` (the file the ERP
reads from git for passive monitoring) `gap_cycles` is an OBJECT keyed by
phase number — `{"1": 0, "2": 1}`. In the POST `/api/v1/reports` body,
`/qualia-report` flattens to a NUMBER for the current phase. Receivers must
accept both shapes: if object, use `gap_cycles[String(phase)] || 0`.

**Response (200 OK):**
```json
{
  "ok": true,
  "report_id": "rpt_abc123def456",
  "message": "Report received"
}
```

**Response (401 Unauthorized):**
```json
{
  "ok": false,
  "error": "INVALID_API_KEY",
  "message": "API key is invalid or expired"
}
```

**Response (422 Unprocessable Entity):**
```json
{
  "ok": false,
  "error": "VALIDATION_FAILED",
  "message": "Missing required field: project"
}
```

### GET /api/v1/reports/:project

Retrieve reports for a project.

**Headers:**
```
Authorization: Bearer <api-key>
```

**Response (200 OK):**
```json
{
  "ok": true,
  "reports": [
    {
      "report_id": "rpt_abc123def456",
      "phase": 2,
      "status": "built",
      "submitted_at": "2026-04-12T14:30:00Z",
      "submitted_by": "Fawzi Goussous"
    }
  ]
}
```

### GET /api/v1/tracking/:project

Retrieve current tracking state (same shape as tracking.json).

**Headers:**
```
Authorization: Bearer <api-key>
```

**Response (200 OK):**
```json
{
  "ok": true,
  "tracking": {
    "project": "client-project-name",
    "milestone": 2,
    "phase": 2,
    "total_phases": 4,
    "status": "built",
    "last_updated": "2026-04-12T14:30:00Z",
    "lifetime": {
      "tasks_completed": 23,
      "phases_completed": 8,
      "milestones_completed": 1,
      "total_phases": 8
    }
  }
}
```

## Behavior

- When `erp.enabled` is `false`, `/qualia-report` skips the upload silently.
- When the API key file is missing or empty, the upload is skipped with a warning.
- Network failures are non-blocking — the report is saved locally regardless.
- The ERP reads `tracking.json` directly from git for real-time status (no API call needed for passive monitoring).
- Reports are append-only — no update or delete endpoints exist.
- `tracking.json` includes `milestone` and `lifetime` fields (added in v3.4). These survive across milestone resets and `state.js init` calls. For aggregate reporting, use `lifetime.total_phases` + current `total_phases` for the grand total across all milestones.
- Backward compatibility: if `lifetime` is absent in tracking.json, treat all counters as 0 and `milestone` as 1.

## Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project | string | yes | Project slug from tracking.json |
| phase | number | yes | Current phase number |
| status | string | yes | Current status (setup, planned, built, verified, etc.) |
| submitted_by | string | yes | Team member name |
| submitted_at | string | yes | ISO 8601 timestamp |
| milestone | number | recommended | Current milestone number (1-indexed) |
| milestone_name | string | recommended (v4+) | Human name of the current milestone — from JOURNEY.md / tracking.json |
| milestones | array | recommended (v4+) | Array of closed milestone summaries: `{num, name, closed_at, phases_completed, tasks_completed}`. Renders the journey tree on the ERP. |
| lifetime | object | recommended | Cumulative counters — tasks_completed, phases_completed, milestones_completed, total_phases, last_closed_milestone |
| project_id | string | recommended (v3.6+) | Stable per-project identifier — preferred dedupe key over `project` slug. Survives directory renames. |
| team_id | string | recommended (v3.6+) | Installation's team identifier. Composite `(team_id, project_id)` is the canonical project key. |
| git_remote | string | optional (v3.6+) | e.g. `github.com/QualiasolutionsCY/foo`. Lets the ERP correlate tracking with the source repo. |
| session_started_at | string | optional (v3.6+) | ISO 8601 — when the current Claude Code session began. |
| last_pushed_at | string | optional (v3.6+) | ISO 8601 — distinct from `last_updated` (which fires on local writes too). |
| build_count | number | optional (v3.6+) | Lifetime build counter. |
| deploy_count | number | optional (v3.6+) | Lifetime deploy counter. |

All other fields are optional but recommended for complete reporting.

## Rate Limits

- 60 requests per minute per API key
- Report body max size: 64KB
- No batch endpoint — one report per request

## Security

- API keys are per-user, not per-project
- Keys expire after 90 days (re-issue via Fawzi)
- All traffic is HTTPS-only
- No PII beyond team member names is transmitted
