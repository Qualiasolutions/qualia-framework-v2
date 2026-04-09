#!/bin/bash
# Qualia session start — show branded context panel on every new session.
# Delegates to qualia-ui.js so formatting matches the rest of the framework.
#
# CRITICAL: this script MUST always exit 0. Claude Code treats any non-zero
# exit as a hook error and shows a red banner to the user. We never want to
# block a session just because we couldn't render a nice banner.

UI="$HOME/.claude/bin/qualia-ui.js"
STATE=".planning/STATE.md"

# Wrap everything in a subshell so internal failures don't propagate.
{
  # Fallback if qualia-ui.js is missing (first install before mirror)
  if [ ! -f "$UI" ]; then
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
  else
    # Branded banner for every session start
    if [ -f "$STATE" ]; then
      node "$UI" banner router 2>/dev/null || true
      # Read next command from state.js and suggest it — all failures suppressed
      NEXT=$(node "$HOME/.claude/bin/state.js" check 2>/dev/null \
        | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.next_command||'')}catch{}})" 2>/dev/null \
        || true)
      if [ -n "$NEXT" ]; then
        node "$UI" info "Run $NEXT to continue" 2>/dev/null || true
      fi
    elif [ -f ".continue-here.md" ]; then
      node "$UI" banner router 2>/dev/null || true
      node "$UI" warn "Handoff found — read .continue-here.md to resume" 2>/dev/null || true
    else
      node "$UI" banner router 2>/dev/null || true
      node "$UI" info "No project detected. Run /qualia-new to start." 2>/dev/null || true
    fi
  fi
} || true

# Always exit clean — the banner is informational, never blocking
exit 0
