#!/bin/bash
# Update tracking.json from STATE.md before push

TRACKING=".planning/tracking.json"
STATE=".planning/STATE.md"

if [ -f "$STATE" ] && [ -f "$TRACKING" ]; then
  # Extract current phase from STATE.md
  PHASE=$(grep "^Phase:" "$STATE" | head -1 | sed 's/Phase: *//' | cut -d' ' -f1)
  STATUS=$(grep "^Status:" "$STATE" | head -1 | sed 's/Status: *//')
  LAST_COMMIT=$(git log --oneline -1 --format="%h" 2>/dev/null)
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Update tracking.json with current values
  if command -v python3 &>/dev/null; then
    python3 -c "
import json
with open('$TRACKING', 'r') as f:
    t = json.load(f)
t['phase'] = int('${PHASE:-0}') if '${PHASE:-0}'.isdigit() else t.get('phase', 0)
t['status'] = '${STATUS:-unknown}'.lower().replace(' ', '_')
t['last_commit'] = '${LAST_COMMIT}'
t['last_updated'] = '${NOW}'
with open('$TRACKING', 'w') as f:
    json.dump(t, f, indent=2)
" 2>/dev/null
    git add "$TRACKING" 2>/dev/null
  fi
fi
