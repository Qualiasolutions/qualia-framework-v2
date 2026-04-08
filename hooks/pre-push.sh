#!/bin/bash
# Update tracking.json timestamps before push
# State.js handles phase/status sync — this just updates commit hash and timestamp

TRACKING=".planning/tracking.json"

if [ -f "$TRACKING" ]; then
  if ! command -v node &>/dev/null; then
    echo "WARNING: node not found, skipping tracking sync" >&2
    exit 0
  fi

  LAST_COMMIT=$(git log --oneline -1 --format="%h" 2>/dev/null)
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  node -e "
    const fs = require('fs');
    try {
      const t = JSON.parse(fs.readFileSync('$TRACKING', 'utf8'));
      t.last_commit = '${LAST_COMMIT}';
      t.last_updated = '${NOW}';
      fs.writeFileSync('$TRACKING', JSON.stringify(t, null, 2) + '\n');
    } catch (e) {
      process.stderr.write('WARNING: tracking sync failed: ' + e.message + '\n');
    }
  "
  git add "$TRACKING" 2>/dev/null
fi
