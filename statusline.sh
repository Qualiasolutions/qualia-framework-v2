#!/bin/bash
# Qualia status line — teal branded, shows phase + context + git
input=$(cat)

MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo "$input" | jq -r '.workspace.current_dir')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
AGENT=$(echo "$input" | jq -r '.agent.name // empty')
WORKTREE=$(echo "$input" | jq -r '.worktree.name // empty')

# Teal palette
T='\033[38;2;0;206;209m'       # Primary teal
TG='\033[38;2;0;170;175m'      # Teal glow (darker)
TD='\033[38;2;0;130;135m'      # Teal dim
W='\033[38;2;220;225;230m'     # White
DIM='\033[38;2;80;90;100m'     # Dim gray
GREEN='\033[38;2;52;211;153m'  # Success green
YELLOW='\033[38;2;234;179;8m'  # Warning
RED='\033[38;2;239;68;68m'     # Error
RESET='\033[0m'

# Context bar with teal gradient
if [ "$PCT" -ge 80 ]; then BAR_COLOR="$RED"
elif [ "$PCT" -ge 50 ]; then BAR_COLOR="$YELLOW"
else BAR_COLOR="$T"; fi

BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /━}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /╌}"

# Git branch (cached for speed)
CACHE="/tmp/qualia-git-cache"
if [ ! -f "$CACHE" ] || [ $(($(date +%s) - $(stat -c %Y "$CACHE" 2>/dev/null || echo 0))) -gt 3 ]; then
  BRANCH=""
  CHANGES=0
  if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  fi
  echo "$BRANCH|$CHANGES" > "$CACHE"
fi
IFS='|' read -r BRANCH CHANGES < "$CACHE"

# Qualia phase from tracking.json
PHASE_INFO=""
TRACKING=".planning/tracking.json"
if [ -f "$TRACKING" ]; then
  PHASE=$(jq -r '.phase // 0' "$TRACKING" 2>/dev/null)
  TOTAL=$(jq -r '.total_phases // 0' "$TRACKING" 2>/dev/null)
  STATUS=$(jq -r '.status // ""' "$TRACKING" 2>/dev/null)
  if [ "$TOTAL" -gt 0 ]; then
    # Phase progress mini-bar
    PDONE=$((PHASE * 100 / TOTAL))
    PFILL=$((PDONE / 25))
    PEMPT=$((4 - PFILL))
    PBAR=""
    [ "$PFILL" -gt 0 ] && printf -v PF "%${PFILL}s" && PBAR="${PF// /●}"
    [ "$PEMPT" -gt 0 ] && printf -v PE "%${PEMPT}s" && PBAR="${PBAR}${PE// /○}"
    PHASE_INFO="${T}${PBAR}${RESET} ${W}P${PHASE}/${TOTAL}${RESET} ${TG}${STATUS}${RESET}"
  fi
fi

# Duration
MINS=$((DURATION_MS / 60000))
SECS=$(((DURATION_MS % 60000) / 1000))
[ "$MINS" -gt 0 ] && DUR="${MINS}m" || DUR="${SECS}s"

# Cost
COST_FMT=$(printf '$%.2f' "$COST")

# Line 1: Project + Git + Phase
LINE1="${T}◆${RESET} ${W}${DIR##*/}${RESET}"
if [ -n "$BRANCH" ]; then
  if [ "$CHANGES" -gt 0 ]; then
    LINE1="${LINE1} ${DIM}on${RESET} ${TG}${BRANCH}${RESET} ${YELLOW}~${CHANGES}${RESET}"
  else
    LINE1="${LINE1} ${DIM}on${RESET} ${TG}${BRANCH}${RESET}"
  fi
fi
[ -n "$AGENT" ] && LINE1="${LINE1} ${DIM}│${RESET} ${T}⚡${AGENT}${RESET}"
[ -n "$WORKTREE" ] && LINE1="${LINE1} ${DIM}│${RESET} ${TD}⎇ ${WORKTREE}${RESET}"
[ -n "$PHASE_INFO" ] && LINE1="${LINE1} ${DIM}│${RESET} ${PHASE_INFO}"

# Line 2: Context bar + Cost + Duration + Model
LINE2="${BAR_COLOR}${BAR}${RESET} ${DIM}${PCT}%${RESET} ${DIM}│${RESET} ${DIM}${COST_FMT}${RESET} ${DIM}│${RESET} ${DIM}${DUR}${RESET} ${DIM}│${RESET} ${TD}${MODEL}${RESET}"

printf '%b\n' "$LINE1"
printf '%b\n' "$LINE2"
