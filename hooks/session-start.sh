#!/bin/bash
# Qualia session start — load project context
# Triggered on Claude Code session start

STATE=".planning/STATE.md"
TRACKING=".planning/tracking.json"

if [ -f "$STATE" ]; then
  PHASE=$(grep "^Phase:" "$STATE" 2>/dev/null | head -1)
  STATUS=$(grep "^Status:" "$STATE" 2>/dev/null | head -1)
  echo "QUALIA: Project loaded. $PHASE | $STATUS"
  echo "QUALIA: Run /qualia for next step."
elif [ -f ".continue-here.md" ]; then
  echo "QUALIA: Handoff file found. Read .continue-here.md to resume."
else
  echo "QUALIA: No project detected. Run /qualia-new to start."
fi
