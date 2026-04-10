#!/bin/bash
# Qualia Framework v2 — statusline.js behavioral tests
# Run: bash tests/statusline.test.sh
#
# Strategy: statusline.js reads a single JSON blob from stdin and prints two
# ANSI-formatted lines to stdout. We pipe JSON, capture stdout, and assert on
# exit code + presence of expected substrings (including raw ANSI escape codes
# for color assertions).
#
# Workspace dirs point at /tmp/qualia-sl-nonexistent so git subprocesses fail
# fast (statusline swallows the error) — no real git repo required.

PASS=0
FAIL=0
# Resolve SL_JS to an ABSOLUTE path so `cd` inside subshells doesn't break it.
SL_JS="$(cd "$(dirname "$0")/../bin" && pwd)/statusline.js"
NODE="${NODE:-node}"

# statusline.js caches git state per-user in $TMPDIR/qualia-git-cache-$USER
# (3-second TTL). Wipe before every test so cached results from a previous
# run don't leak branch/changes values into the current assertion.
CACHE_GLOB_DIR="${TMPDIR:-/tmp}"
clean_cache() {
  rm -f "$CACHE_GLOB_DIR"/qualia-git-cache-* 2>/dev/null || true
}
trap clean_cache EXIT
clean_cache

# Colors used by statusline.js — hardcoded from bin/statusline.js
# These are raw ANSI escape sequences (printf %b interpolates \x1b -> ESC).
TEAL_ESC=$(printf '\x1b[38;2;0;206;209m')
YELLOW_ESC=$(printf '\x1b[38;2;234;179;8m')
RED_ESC=$(printf '\x1b[38;2;239;68;68m')

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail_case() {
  echo "  ✗ $1${2:+ — $2}"
  FAIL=$((FAIL + 1))
}

# run_sl <json> → populates OUT (stdout) and RC (exit code).
# Uses a nonexistent workspace dir so git commands fail gracefully.
# We write stdout to a tmp file (not $()) so we can capture exit code
# without losing it to a subshell on the left side of the pipeline.
SL_OUTFILE=$(mktemp)
run_sl() {
  local json="$1"
  clean_cache
  # printf %s (not echo) to avoid trailing newlines affecting JSON.parse.
  printf '%s' "$json" | $NODE "$SL_JS" > "$SL_OUTFILE" 2>/dev/null
  RC=$?
  OUT=$(cat "$SL_OUTFILE")
}
# Extend the cleanup trap to also remove the tmp output file.
cleanup_sl() {
  clean_cache
  [ -f "$SL_OUTFILE" ] && rm -f "$SL_OUTFILE"
}
trap cleanup_sl EXIT

echo "=== statusline.js Behavioral Tests ==="
echo ""

# Sanity check
if [ ! -f "$SL_JS" ]; then
  echo "FATAL: statusline.js not found at $SL_JS"
  exit 1
fi

# ─── Basic rendering ─────────────────────────────────────
echo "basic rendering:"

# 1. Minimal input renders without crash — two lines, contains dir basename + model
NONEXIST="/tmp/qualia-sl-nonexist-$$"
JSON='{"model":{"display_name":"Claude Opus 4.6"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":0},"cost":{"total_cost_usd":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
LINES=$(wc -l < "$SL_OUTFILE")
if [ "$RC" -eq 0 ] \
   && [ "$LINES" -eq 2 ] \
   && grep -qF "qualia-sl-nonexist" "$SL_OUTFILE" \
   && grep -qF "Claude Opus 4.6" "$SL_OUTFILE"; then
  pass "minimal input → exit 0, 2 lines, contains dir basename + model name"
else
  fail_case "minimal input" "exit=$RC lines=$LINES"
fi

# 2. Two lines always produced (check trailing newline count)
# process.stdout.write twice with '\n' → exactly 2 newlines in output
if [ "$LINES" -eq 2 ]; then
  pass "always prints exactly 2 lines"
else
  fail_case "two lines" "got $LINES newlines"
fi

# ─── Context bar color thresholds ────────────────────────
echo ""
echo "context bar color:"

# 3. Teal at low % (<50)
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":30},"cost":{"total_cost_usd":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "$TEAL_ESC" "$SL_OUTFILE"; then
  pass "30% → teal color on bar"
else
  fail_case "30% → teal" "exit=$RC"
fi

# 4. Yellow at medium % (50–79)
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":60},"cost":{"total_cost_usd":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "$YELLOW_ESC" "$SL_OUTFILE"; then
  pass "60% → yellow color on bar"
else
  fail_case "60% → yellow" "exit=$RC"
fi

# 5. Red at high % (>=80)
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":85},"cost":{"total_cost_usd":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "$RED_ESC" "$SL_OUTFILE"; then
  pass "85% → red color on bar"
else
  fail_case "85% → red" "exit=$RC"
fi

# ─── Cost and duration formatting ────────────────────────
echo ""
echo "cost and duration:"

# 6. Cost formatting: $X.XX
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":2.47,"total_duration_ms":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF '$2.47' "$SL_OUTFILE"; then
  pass "cost 2.47 → \$2.47"
else
  fail_case "cost formatting" "exit=$RC"
fi

# 7. Duration under 60s shown as seconds
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":0,"total_duration_ms":45000},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "45s" "$SL_OUTFILE"; then
  pass "duration 45000ms → 45s"
else
  fail_case "duration seconds" "exit=$RC"
fi

# 8. Duration >=60s shown as minutes
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":0,"total_duration_ms":125000},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "2m" "$SL_OUTFILE"; then
  pass "duration 125000ms → 2m"
else
  fail_case "duration minutes" "exit=$RC"
fi

# ─── Optional segments: agent + worktree ─────────────────
echo ""
echo "optional segments:"

# 9. Agent name segment appears
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":0},"agent":{"name":"qualia-planner"},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "qualia-planner" "$SL_OUTFILE"; then
  pass "agent.name rendered on line 1"
else
  fail_case "agent segment" "exit=$RC"
fi

# 10. Worktree name segment appears
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$NONEXIST"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":0},"agent":{},"worktree":{"name":"feature-x"}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] && grep -qF "feature-x" "$SL_OUTFILE"; then
  pass "worktree.name rendered on line 1"
else
  fail_case "worktree segment" "exit=$RC"
fi

# ─── Degraded input ──────────────────────────────────────
echo ""
echo "degraded input:"

# 11. Empty stdin → still exit 0, still produces two lines
run_sl ""
LINES=$(wc -l < "$SL_OUTFILE")
if [ "$RC" -eq 0 ] && [ "$LINES" -eq 2 ]; then
  pass "empty stdin → exit 0, 2 lines (degraded, no crash)"
else
  fail_case "empty stdin" "exit=$RC lines=$LINES"
fi

# 12. Invalid JSON → still exit 0, no crash
run_sl "not json{"
LINES=$(wc -l < "$SL_OUTFILE")
if [ "$RC" -eq 0 ] && [ "$LINES" -eq 2 ]; then
  pass "invalid JSON → exit 0, 2 lines (degraded, no crash)"
else
  fail_case "invalid JSON" "exit=$RC lines=$LINES"
fi

# ─── Phase info from tracking.json ───────────────────────
echo ""
echo "phase info:"

# 13. tracking.json with phase=2/4 status=built → "P2/4" and "built" appear
TMP=$(mktemp -d)
mkdir -p "$TMP/.planning"
cat > "$TMP/.planning/tracking.json" <<'EOF'
{"phase": 2, "total_phases": 4, "status": "built"}
EOF
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$TMP"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
if [ "$RC" -eq 0 ] \
   && grep -qF "P2/4" "$SL_OUTFILE" \
   && grep -qF "built" "$SL_OUTFILE"; then
  pass "tracking.json phase=2/4 status=built → P2/4 + built rendered"
else
  fail_case "phase info from tracking.json" "exit=$RC"
fi
rm -rf "$TMP"

# 14. Malformed tracking.json does not crash → still exits 0
TMP=$(mktemp -d)
mkdir -p "$TMP/.planning"
echo 'not json' > "$TMP/.planning/tracking.json"
JSON='{"model":{"display_name":"M"},"workspace":{"current_dir":"'"$TMP"'"},"context_window":{"used_percentage":10},"cost":{"total_cost_usd":0},"agent":{},"worktree":{}}'
run_sl "$JSON"
LINES=$(wc -l < "$SL_OUTFILE")
if [ "$RC" -eq 0 ] && [ "$LINES" -eq 2 ]; then
  pass "malformed tracking.json → exit 0, no crash"
else
  fail_case "malformed tracking.json" "exit=$RC lines=$LINES"
fi
rm -rf "$TMP"

# ─── Summary ─────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
