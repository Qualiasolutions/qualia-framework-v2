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
  "client": "Client Name",
  "phase": 2,
  "phase_name": "Authentication & Dashboard",
  "total_phases": 4,
  "status": "built",
  "tasks_done": 5,
  "tasks_total": 5,
  "verification": "pass",
  "gap_cycles": 0,
  "deployed_url": "https://client.vercel.app",
  "session_duration_minutes": 45,
  "commits": ["abc1234", "def5678"],
  "notes": "Completed auth flow, dashboard layout, and API routes.",
  "submitted_by": "Fawzi Goussous",
  "submitted_at": "2026-04-12T14:30:00Z"
}
```

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
    "phase": 2,
    "total_phases": 4,
    "status": "built",
    "last_updated": "2026-04-12T14:30:00Z"
  }
}
```

## Behavior

- When `erp.enabled` is `false`, `/qualia-report` skips the upload silently.
- When the API key file is missing or empty, the upload is skipped with a warning.
- Network failures are non-blocking — the report is saved locally regardless.
- The ERP reads `tracking.json` directly from git for real-time status (no API call needed for passive monitoring).
- Reports are append-only — no update or delete endpoints exist.

## Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project | string | yes | Project slug from tracking.json |
| phase | number | yes | Current phase number |
| status | string | yes | Current status (setup, planned, built, verified, etc.) |
| submitted_by | string | yes | Team member name |
| submitted_at | string | yes | ISO 8601 timestamp |

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
