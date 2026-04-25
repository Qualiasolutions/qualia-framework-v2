#!/bin/bash
# Qualia Framework v2 — bin/ file behavioral tests (install.js, cli.js, qualia-ui.js)
# Run: bash tests/bin.test.sh

PASS=0
FAIL=0
FRAMEWORK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE="${NODE:-node}"
CLI_JS="$FRAMEWORK_DIR/bin/cli.js"
UI_JS="$FRAMEWORK_DIR/bin/qualia-ui.js"
INSTALL_JS="$FRAMEWORK_DIR/bin/install.js"
PKG_VERSION=$($NODE -e 'console.log(require("'"$FRAMEWORK_DIR"'/package.json").version)')

# Track tmp dirs we create so we can clean them up on exit
TMP_DIRS=()
cleanup() {
  for d in "${TMP_DIRS[@]}"; do
    [ -d "$d" ] && rm -rf "$d"
  done
}
trap cleanup EXIT

mktmp() {
  local t
  t=$(mktemp -d)
  TMP_DIRS+=("$t")
  echo "$t"
}

assert_exit() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name (expected exit $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail_case() {
  echo "  ✗ $1${2:+ — $2}"
  FAIL=$((FAIL + 1))
}

# Strip ANSI escape codes for cleaner matching against expected strings.
strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g'
}

echo "=== bin/ Behavioral Tests ==="
echo ""

# Sanity checks
for f in "$CLI_JS" "$UI_JS" "$INSTALL_JS"; do
  if [ ! -f "$f" ]; then
    echo "FATAL: $f not found"
    exit 1
  fi
done

# ─── cli.js ───────────────────────────────────────────────
echo "cli.js:"

# 1. No args prints help banner
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$CLI_JS" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Qualia Framework" \
   && echo "$CLEAN" | grep -q "Commands:"; then
  pass "no args → help banner, exit 0"
else
  fail_case "no args help" "exit=$EXIT"
fi

# 2. `help` (unknown subcommand) falls through to help
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$CLI_JS" help 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "/qualia-new"; then
  pass "help arg → shows /qualia-new, /qualia-plan list"
else
  fail_case "help arg" "exit=$EXIT"
fi

# 3. Unknown subcommand falls through to help
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$CLI_JS" frobnicate 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Qualia Framework"; then
  pass "unknown command → help banner, exit 0"
else
  fail_case "unknown command" "exit=$EXIT"
fi

# 4. `version` without config — shows version, no User line, offline fallback
TMP=$(mktmp)
OUT=$(HOME="$TMP" npm_config_registry="http://127.0.0.1:1/" $NODE "$CLI_JS" version 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Installed:" \
   && echo "$CLEAN" | grep -q "$PKG_VERSION" \
   && ! echo "$CLEAN" | grep -q "User:"; then
  pass "version without config → shows version, no User line"
else
  fail_case "version without config" "exit=$EXIT"
fi

# 5. `version` exits cleanly regardless of network path
# The update check branches on execSync of `npm view ...`: it prints "Latest:"
# with the version (up-to-date), "Update available:", "(offline — couldn't check)",
# or nothing if npm returns an empty string. All of these are acceptable — the
# only real regression would be a crash or stderr on stdout.
if [ "$EXIT" -eq 0 ] \
   && ! echo "$CLEAN" | grep -qi "error" \
   && ! echo "$CLEAN" | grep -qi "traceback"; then
  pass "version update-check branch → clean exit, no errors"
else
  fail_case "version update-check branch" "exit=$EXIT"
fi

# 6. `version` with saved config — shows User line
TMP=$(mktmp)
mkdir -p "$TMP/.claude"
cat > "$TMP/.claude/.qualia-config.json" <<'EOF'
{
  "code": "QS-FAWZI-01",
  "installed_by": "Fawzi Goussous",
  "role": "OWNER",
  "version": "2.8.1",
  "installed_at": "2026-04-10"
}
EOF
OUT=$(HOME="$TMP" npm_config_registry="http://127.0.0.1:1/" $NODE "$CLI_JS" version 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "User:" \
   && echo "$CLEAN" | grep -q "Fawzi Goussous" \
   && echo "$CLEAN" | grep -q "OWNER" \
   && echo "$CLEAN" | grep -q "2026-04-10"; then
  pass "version with config → shows User, role, date"
else
  fail_case "version with config" "exit=$EXIT"
fi

# 7. `-v` alias works the same as version
TMP=$(mktmp)
OUT=$(HOME="$TMP" npm_config_registry="http://127.0.0.1:1/" $NODE "$CLI_JS" -v 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Installed:" \
   && echo "$CLEAN" | grep -q "$PKG_VERSION"; then
  pass "-v alias → shows version"
else
  fail_case "-v alias" "exit=$EXIT"
fi

# 8. `--version` alias works
TMP=$(mktmp)
OUT=$(HOME="$TMP" npm_config_registry="http://127.0.0.1:1/" $NODE "$CLI_JS" --version 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Installed:" \
   && echo "$CLEAN" | grep -q "$PKG_VERSION"; then
  pass "--version alias → shows version"
else
  fail_case "--version alias" "exit=$EXIT"
fi

# 9. `update` without saved config → exits 1 cleanly with clear message
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$CLI_JS" update 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 1 ] \
   && echo "$CLEAN" | grep -q "No install code saved"; then
  pass "update without config → exit 1, 'No install code saved'"
else
  fail_case "update without config" "exit=$EXIT"
fi

# 10. `upgrade` alias behaves same as update (no config → exit 1)
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$CLI_JS" upgrade 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 1 ] \
   && echo "$CLEAN" | grep -q "No install code saved"; then
  pass "upgrade alias → exit 1, 'No install code saved'"
else
  fail_case "upgrade alias" "exit=$EXIT"
fi

echo ""

# ─── qualia-ui.js ─────────────────────────────────────────
echo "qualia-ui.js:"

# 11. banner router (no state) — exit 0, renders QUALIA + SMART ROUTER
TMP=$(mktmp)
OUT=$(cd "$TMP" && HOME="$TMP" $NODE "$UI_JS" banner router 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "QUALIA" \
   && echo "$CLEAN" | grep -q "SMART ROUTER"; then
  pass "banner router → 'QUALIA' + 'SMART ROUTER'"
else
  fail_case "banner router" "exit=$EXIT"
fi

# 12. banner plan 1 foundation — includes PLANNING + Phase 1 + subtitle
TMP=$(mktmp)
OUT=$(cd "$TMP" && HOME="$TMP" $NODE "$UI_JS" banner plan 1 foundation 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "PLANNING" \
   && echo "$CLEAN" | grep -q "Phase 1"; then
  pass "banner plan 1 foundation → 'PLANNING' + 'Phase 1'"
else
  fail_case "banner plan 1 foundation" "exit=$EXIT"
fi

# 13. banner with unknown action — falls back to uppercased action label
TMP=$(mktmp)
OUT=$(cd "$TMP" && HOME="$TMP" $NODE "$UI_JS" banner frobnicate 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "QUALIA" \
   && echo "$CLEAN" | grep -q "FROBNICATE"; then
  pass "banner unknown action → uppercased fallback label"
else
  fail_case "banner unknown action" "exit=$EXIT"
fi

# 14. context (no project) — exit 0, shows 'Project' and 'No project detected' hint
TMP=$(mktmp)
OUT=$(cd "$TMP" && HOME="$TMP" $NODE "$UI_JS" context 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Project" \
   && echo "$CLEAN" | grep -q "No project detected"; then
  pass "context without project → 'Project' + 'No project detected'"
else
  fail_case "context without project" "exit=$EXIT"
fi

# 15. ok <message>
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" ok "hello world" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "hello world" \
   && echo "$OUT" | grep -q "✓"; then
  pass "ok → '✓' + message"
else
  fail_case "ok message" "exit=$EXIT"
fi

# 16. fail <message>
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" fail "nope nope" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "nope nope" \
   && echo "$OUT" | grep -q "✗"; then
  pass "fail → '✗' + message"
else
  fail_case "fail message" "exit=$EXIT"
fi

# 17. warn <message>
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" warn "careful" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "careful"; then
  pass "warn → message rendered"
else
  fail_case "warn message" "exit=$EXIT"
fi

# 18. info <message>
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" info "just fyi" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "just fyi"; then
  pass "info → message rendered"
else
  fail_case "info message" "exit=$EXIT"
fi

# 19. divider renders a horizontal rule with '━' character
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" divider 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q "━"; then
  pass "divider → '━' rule"
else
  fail_case "divider" "exit=$EXIT"
fi

# 20. spawn agent description
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" spawn builder "task 3" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Spawning" \
   && echo "$CLEAN" | grep -q "builder" \
   && echo "$CLEAN" | grep -q "task 3"; then
  pass "spawn builder → 'Spawning builder — task 3'"
else
  fail_case "spawn" "exit=$EXIT"
fi

# 21. wave 1 3 5 — renders wave header with task count
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" wave 1 3 5 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Wave 1/3" \
   && echo "$CLEAN" | grep -q "5 tasks"; then
  pass "wave 1 3 5 → 'Wave 1/3 (5 tasks)'"
else
  fail_case "wave" "exit=$EXIT"
fi

# 22. task <N> <title>
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" task 2 "Build login form" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Build login form" \
   && echo "$CLEAN" | grep -q "2\."; then
  pass "task 2 title → '2. Build login form'"
else
  fail_case "task" "exit=$EXIT"
fi

# 23. done <N> <title> <commit>
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" done 3 "TaskDone" "abc1234" 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "TaskDone" \
   && echo "$CLEAN" | grep -q "abc1234" \
   && echo "$OUT" | grep -q "✓"; then
  pass "done 3 TaskDone abc1234 → check + title + commit"
else
  fail_case "done" "exit=$EXIT"
fi

# 24. next /qualia-build
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" next /qualia-build 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "Next:" \
   && echo "$CLEAN" | grep -q "/qualia-build"; then
  pass "next /qualia-build → 'Next: /qualia-build'"
else
  fail_case "next" "exit=$EXIT"
fi

# 25. end DONE with next command
TMP=$(mktmp)
OUT=$(HOME="$TMP" $NODE "$UI_JS" end SHIPPED /qualia-handoff 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "SHIPPED" \
   && echo "$CLEAN" | grep -q "/qualia-handoff"; then
  pass "end SHIPPED /qualia-handoff → closes with next"
else
  fail_case "end" "exit=$EXIT"
fi

# 26. unknown command exits 1 with usage line on stderr
TMP=$(mktmp)
STDERR=$(HOME="$TMP" $NODE "$UI_JS" frobnicate 2>&1 >/dev/null)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$STDERR" | grep -q "Usage:"; then
  pass "unknown command → exit 1, 'Usage:' on stderr"
else
  fail_case "unknown command" "exit=$EXIT"
fi

# 27. banner router respects config — shows OWNER + name when config present
TMP=$(mktmp)
mkdir -p "$TMP/.claude"
cat > "$TMP/.claude/.qualia-config.json" <<'EOF'
{
  "code": "QS-FAWZI-01",
  "installed_by": "Fawzi Goussous",
  "role": "OWNER",
  "version": "2.8.1",
  "installed_at": "2026-04-10"
}
EOF
OUT=$(cd "$TMP" && HOME="$TMP" $NODE "$UI_JS" banner router 2>&1)
EXIT=$?
CLEAN=$(echo "$OUT" | strip_ansi)
if [ "$EXIT" -eq 0 ] \
   && echo "$CLEAN" | grep -q "OWNER" \
   && echo "$CLEAN" | grep -q "Fawzi Goussous"; then
  pass "banner router with config → shows OWNER + 'Fawzi Goussous'"
else
  fail_case "banner with config" "exit=$EXIT"
fi

echo ""

# ─── install.js ───────────────────────────────────────────
echo "install.js:"

# 28. Happy path: valid code installs everything
TMP=$(mktmp)
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && [ -f "$TMP/.claude/skills/qualia/SKILL.md" ] \
   && [ -f "$TMP/.claude/hooks/session-start.js" ] \
   && [ -f "$TMP/.claude/bin/state.js" ] \
   && [ -f "$TMP/.claude/bin/qualia-ui.js" ] \
   && [ -f "$TMP/.claude/bin/statusline.js" ] \
   && [ -f "$TMP/.claude/.qualia-config.json" ]; then
  pass "QS-FAWZI-01 → installs skills, hooks, bin/, config"
else
  fail_case "QS-FAWZI-01 happy path" "exit=$EXIT"
fi

# 29. Config JSON has correct fields after happy path
if grep -q '"code": "QS-FAWZI-01"' "$TMP/.claude/.qualia-config.json" \
   && grep -q '"installed_by": "Fawzi Goussous"' "$TMP/.claude/.qualia-config.json" \
   && grep -q '"role": "OWNER"' "$TMP/.claude/.qualia-config.json"; then
  pass "config JSON has code, installed_by, role=OWNER"
else
  fail_case "config JSON fields"
fi

# 30. CLAUDE.md role placeholder replaced
if grep -q "Role: OWNER" "$TMP/.claude/CLAUDE.md" \
   && ! grep -q "{{ROLE}}" "$TMP/.claude/CLAUDE.md"; then
  pass "CLAUDE.md has Role: OWNER, no {{ROLE}} placeholder"
else
  fail_case "CLAUDE.md role substitution"
fi

# 31. All 9 hooks installed (block-env-edit removed in v3.2.0;
# git-guardrails + stop-session-log added in v4.2.0)
HOOK_COUNT=$(ls "$TMP/.claude/hooks/"*.js 2>/dev/null | wc -l)
if [ "$HOOK_COUNT" -eq 9 ]; then
  pass "9 hooks installed in hooks/"
else
  fail_case "hook count" "got $HOOK_COUNT"
fi

# 32. settings.json written with hooks + statusLine
if [ -f "$TMP/.claude/settings.json" ] \
   && grep -q '"SessionStart"' "$TMP/.claude/settings.json" \
   && grep -q '"PreToolUse"' "$TMP/.claude/settings.json" \
   && grep -q '"Stop"' "$TMP/.claude/settings.json" \
   && grep -q '"statusLine"' "$TMP/.claude/settings.json"; then
  pass "settings.json has SessionStart, PreToolUse, Stop, statusLine"
else
  fail_case "settings.json contents"
fi

# 33. settings.json contains all 9 hooks wired correctly
if grep -q 'branch-guard.js' "$TMP/.claude/settings.json" \
   && grep -q 'migration-guard.js' "$TMP/.claude/settings.json" \
   && grep -q 'pre-push.js' "$TMP/.claude/settings.json" \
   && grep -q 'pre-deploy-gate.js' "$TMP/.claude/settings.json" \
   && grep -q 'auto-update.js' "$TMP/.claude/settings.json" \
   && grep -q 'session-start.js' "$TMP/.claude/settings.json" \
   && grep -q 'pre-compact.js' "$TMP/.claude/settings.json" \
   && grep -q 'git-guardrails.js' "$TMP/.claude/settings.json" \
   && grep -q 'stop-session-log.js' "$TMP/.claude/settings.json"; then
  pass "settings.json has all 9 hooks wired"
else
  fail_case "settings.json missing hooks"
fi

# 34. Lowercase code works (resolveTeamCode normalizes)
TMP=$(mktmp)
echo "qs-fawzi-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && [ -f "$TMP/.claude/.qualia-config.json" ] \
   && grep -q '"code": "QS-FAWZI-01"' "$TMP/.claude/.qualia-config.json"; then
  pass "lowercase 'qs-fawzi-01' → canonical 'QS-FAWZI-01'"
else
  fail_case "lowercase normalization" "exit=$EXIT"
fi

# 34. O/0 typo tolerance — letter O in suffix normalized to digit 0
TMP=$(mktmp)
echo "QS-FAWZI-O1" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && [ -f "$TMP/.claude/.qualia-config.json" ] \
   && grep -q '"code": "QS-FAWZI-01"' "$TMP/.claude/.qualia-config.json"; then
  pass "letter 'O' in suffix → normalized to digit '0'"
else
  fail_case "O/0 fuzzy match" "exit=$EXIT"
fi

# 35. MOAYAD real O in name preserved (only suffix is normalized)
TMP=$(mktmp)
echo "QS-MOAYAD-03" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && [ -f "$TMP/.claude/.qualia-config.json" ] \
   && grep -q '"code": "QS-MOAYAD-03"' "$TMP/.claude/.qualia-config.json" \
   && grep -q '"installed_by": "Moayad"' "$TMP/.claude/.qualia-config.json"; then
  pass "QS-MOAYAD-03 → 'O' in name preserved"
else
  fail_case "Moayad real-O" "exit=$EXIT"
fi

# 36. EMPLOYEE role set correctly
if grep -q '"role": "EMPLOYEE"' "$TMP/.claude/.qualia-config.json" \
   && grep -q "Role: EMPLOYEE" "$TMP/.claude/CLAUDE.md"; then
  pass "Moayad role → EMPLOYEE"
else
  fail_case "Moayad EMPLOYEE role"
fi

# 37. Invalid code exits 1 with helpful message
TMP=$(mktmp)
echo "QS-BOGUS-99" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
CLEAN=$(strip_ansi < "$TMP/out.log")
if [ "$EXIT" -eq 1 ] \
   && echo "$CLEAN" | grep -q "Invalid code" \
   && [ ! -f "$TMP/.claude/.qualia-config.json" ]; then
  pass "QS-BOGUS-99 → exit 1, 'Invalid code', no config written"
else
  fail_case "invalid code" "exit=$EXIT"
fi

# 38. Empty code (newline only) → exit 1, invalid code message
TMP=$(mktmp)
printf '\n' | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
CLEAN=$(strip_ansi < "$TMP/out.log")
if [ "$EXIT" -eq 1 ] \
   && echo "$CLEAN" | grep -q "Invalid code" \
   && [ ! -f "$TMP/.claude/.qualia-config.json" ]; then
  pass "empty code → exit 1, 'Invalid code'"
else
  fail_case "empty code" "exit=$EXIT"
fi

# 39. Code with surrounding whitespace is accepted
TMP=$(mktmp)
printf '  QS-FAWZI-01  \n' | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && grep -q '"code": "QS-FAWZI-01"' "$TMP/.claude/.qualia-config.json"; then
  pass "whitespace-padded code → accepted and trimmed"
else
  fail_case "whitespace trim" "exit=$EXIT"
fi

# 40. Settings.json merge preserves custom top-level keys
TMP=$(mktmp)
mkdir -p "$TMP/.claude"
cat > "$TMP/.claude/settings.json" <<'EOF'
{
  "customKey": "preserved",
  "env": {
    "MY_CUSTOM_VAR": "hello"
  }
}
EOF
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
MERGED=$($NODE -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log([s.customKey,s.env&&s.env.MY_CUSTOM_VAR,s.env&&s.env.CLAUDE_CODE_NO_FLICKER,!!s.hooks,!!s.statusLine].join("|"))' "$TMP/.claude/settings.json" 2>/dev/null)
if [ "$EXIT" -eq 0 ] \
   && [ "$MERGED" = "preserved|hello|1|true|true" ]; then
  pass "settings.json merge preserves custom keys + adds new hooks/env"
else
  fail_case "settings.json merge" "got '$MERGED' exit=$EXIT"
fi

# 41. Knowledge files created on first install
TMP=$(mktmp)
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && [ -f "$TMP/.claude/knowledge/learned-patterns.md" ] \
   && [ -f "$TMP/.claude/knowledge/common-fixes.md" ] \
   && [ -f "$TMP/.claude/knowledge/client-prefs.md" ]; then
  pass "knowledge/ files created on first install"
else
  fail_case "knowledge files created" "exit=$EXIT"
fi

# 42. Idempotent re-install preserves user edits to knowledge files
printf '\n## CUSTOM LEARNING — DO NOT OVERWRITE\n' >> "$TMP/.claude/knowledge/learned-patterns.md"
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out2.log" 2>&1
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && grep -q "CUSTOM LEARNING" "$TMP/.claude/knowledge/learned-patterns.md"; then
  pass "re-install preserves user edits in knowledge files"
else
  fail_case "knowledge idempotency" "exit=$EXIT"
fi

# 43. ERP API key file created and not overwritten on re-install
if [ -f "$TMP/.claude/.erp-api-key" ]; then
  echo "custom-erp-key" > "$TMP/.claude/.erp-api-key"
  echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out3.log" 2>&1
  if grep -q "custom-erp-key" "$TMP/.claude/.erp-api-key"; then
    pass ".erp-api-key preserved on re-install"
  else
    fail_case ".erp-api-key preservation"
  fi
else
  fail_case ".erp-api-key missing after install"
fi

# 44. Templates copied to qualia-templates/
TMP=$(mktmp)
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" > "$TMP/out.log" 2>&1
EXIT=$?
TMPL_COUNT=$(ls "$TMP/.claude/qualia-templates/" 2>/dev/null | wc -l)
if [ "$EXIT" -eq 0 ] && [ "$TMPL_COUNT" -gt 0 ]; then
  pass "templates copied to qualia-templates/ ($TMPL_COUNT files)"
else
  fail_case "templates copied" "exit=$EXIT count=$TMPL_COUNT"
fi

# 45. All agents copied
AGENT_COUNT=$(ls "$TMP/.claude/agents/" 2>/dev/null | wc -l)
if [ "$AGENT_COUNT" -gt 0 ]; then
  pass "agents copied ($AGENT_COUNT files)"
else
  fail_case "agents copied" "count=$AGENT_COUNT"
fi

# 46. Rules copied
RULE_COUNT=$(ls "$TMP/.claude/rules/" 2>/dev/null | wc -l)
if [ "$RULE_COUNT" -gt 0 ]; then
  pass "rules copied ($RULE_COUNT files)"
else
  fail_case "rules copied" "count=$RULE_COUNT"
fi

# 47. Config version matches package.json version
if grep -q "\"version\": \"$PKG_VERSION\"" "$TMP/.claude/.qualia-config.json"; then
  pass "config version matches package.json ($PKG_VERSION)"
else
  fail_case "config version mismatch"
fi

echo ""
echo "--- v4.2.0 phase 3 (flush + forks + model matrix) ---"

# 61. qualia-flush skill installs
TMP=$(mktmp)
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" >/dev/null 2>&1
if [ -f "$TMP/.claude/skills/qualia-flush/SKILL.md" ]; then
  pass "qualia-flush skill installs"
else
  fail_case "qualia-flush skill missing after install"
fi

# 62. CLAUDE_AGENT_FORK_ENABLED=1 in settings.json
if grep -q '"CLAUDE_AGENT_FORK_ENABLED": "1"' "$TMP/.claude/settings.json"; then
  pass "settings.env CLAUDE_AGENT_FORK_ENABLED=1 (forked subagents on by default)"
else
  fail_case "CLAUDE_AGENT_FORK_ENABLED not set"
fi

# 63. research-synthesizer agent has model: haiku frontmatter
if grep -q '^model: haiku$' "$TMP/.claude/agents/research-synthesizer.md"; then
  pass "research-synthesizer agent uses haiku (model matrix)"
else
  fail_case "research-synthesizer missing model frontmatter"
fi

# 64. Other agents do NOT have model frontmatter (conservative matrix)
SAFE_AGENTS=("planner.md" "builder.md" "verifier.md" "plan-checker.md")
ALL_OK=1
for a in "${SAFE_AGENTS[@]}"; do
  if grep -q '^model: ' "$TMP/.claude/agents/$a" 2>/dev/null; then
    ALL_OK=0
  fi
done
if [ "$ALL_OK" = "1" ]; then
  pass "high-stakes agents (planner/builder/verifier/plan-checker) keep default model"
else
  fail_case "high-stakes agent has unexpected model frontmatter"
fi

echo ""
echo "--- knowledge.js (memory-layer loader) ---"

KN="$FRAMEWORK_DIR/bin/knowledge.js"

# 48. Help
EXIT=0; OUT=$($NODE "$KN" help 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "knowledge.js"; then
  pass "help prints usage"
else
  fail_case "help" "exit=$EXIT"
fi

# 49. Default (no args) → "no entries" stub on fresh install, exit 0
TMP=$(mktmp)
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "no entries"; then
  pass "default → exits 0 with stub on fresh install"
else
  fail_case "default no init" "exit=$EXIT"
fi

# 50. With initialized index → returns content
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge"
echo "# Test Index" > "$TMP/.claude/knowledge/index.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "Test Index"; then
  pass "default → prints index.md when present"
else
  fail_case "default with index" "exit=$EXIT"
fi

# 51. load <alias> resolves to mapped filename
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge"
echo "# Patterns" > "$TMP/.claude/knowledge/learned-patterns.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" load patterns 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "# Patterns"; then
  pass "load patterns → learned-patterns.md"
else
  fail_case "load alias" "exit=$EXIT"
fi

# 52. load <missing-file> → "no entries" stub, exit 0
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" load fixes 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "no entries"; then
  pass "load missing → exit 0 with stub (skill-pipeable)"
else
  fail_case "load missing" "exit=$EXIT"
fi

# 53. append a pattern → entry lands on disk
TMP=$(mktmp)
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" append --type pattern --title "RLS rule" --body "Add RLS in same migration as table" 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "appended"; then
  pass "append pattern → exit 0 with confirmation"
else
  fail_case "append pattern" "exit=$EXIT"
fi
if [ -f "$TMP/.claude/knowledge/learned-patterns.md" ] \
   && grep -q "### RLS rule" "$TMP/.claude/knowledge/learned-patterns.md" \
   && grep -q "Add RLS in same migration" "$TMP/.claude/knowledge/learned-patterns.md"; then
  pass "appended entry has title + body"
else
  fail_case "append content"
fi

# 54. append without --title → exit 1
EXIT=0; HOME="$TMP" $NODE "$KN" append --type pattern --body "x" >/dev/null 2>&1 || EXIT=$?
if [ "$EXIT" -eq 1 ]; then
  pass "append missing --title → exit 1"
else
  fail_case "append missing title" "exit=$EXIT"
fi

# 55. append with bad type → exit 1
EXIT=0; HOME="$TMP" $NODE "$KN" append --type bogus --title T --body B >/dev/null 2>&1 || EXIT=$?
if [ "$EXIT" -eq 1 ]; then
  pass "append bad --type → exit 1"
else
  fail_case "append bad type" "exit=$EXIT"
fi

# 56. search finds an appended entry
TMP=$(mktmp)
HOME="$TMP" $NODE "$KN" append --type fix --title "Vercel build crash" --body "use node 20.x in package.json engines" >/dev/null 2>&1
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" search "Vercel" 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "Vercel"; then
  pass "search finds appended entries"
else
  fail_case "search appended" "exit=$EXIT"
fi

# 57. search with no matches → "no matches" stub, exit 0
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" search "xyzzy_nonexistent_12345" 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "no matches"; then
  pass "search no matches → exit 0 with stub"
else
  fail_case "search no matches" "exit=$EXIT"
fi

# 58. list shows existing files
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge"
echo "x" > "$TMP/.claude/knowledge/foo.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" list 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "foo.md"; then
  pass "list shows existing files"
else
  fail_case "list" "exit=$EXIT"
fi

# 59. unknown command falls through to load (`knowledge.js patterns` shorthand)
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge"
echo "# Patterns content" > "$TMP/.claude/knowledge/learned-patterns.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" patterns 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "# Patterns content"; then
  pass "unknown command → falls through to load"
else
  fail_case "fallthrough" "exit=$EXIT"
fi

# 60. path command resolves alias to absolute path (no read)
EXIT=0; OUT=$($NODE "$KN" path patterns 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "learned-patterns.md"; then
  pass "path resolves alias to filename"
else
  fail_case "path" "exit=$EXIT"
fi

echo ""
echo "--- v4.3.0 (loader subdirs + self-healing skills) ---"

# 65. Subdirectory-qualified path: knowledge.js load concepts/foo
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge/concepts"
echo "# Stripe checkout" > "$TMP/.claude/knowledge/concepts/stripe.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" load concepts/stripe 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "Stripe checkout"; then
  pass "load concepts/stripe → reads concepts/stripe.md"
else
  fail_case "subdir-qualified load" "exit=$EXIT"
fi

# 66. Bare name auto-discovers in concepts/
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge/concepts"
echo "# Voice agent state" > "$TMP/.claude/knowledge/concepts/voice-agent-call-state.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" load voice-agent-call-state 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "Voice agent state"; then
  pass "load <bare> auto-discovers in concepts/"
else
  fail_case "bare-name subdir discovery" "exit=$EXIT"
fi

# 67. Top-level wins when both top-level and subdir have same filename
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge/concepts"
echo "# Top level" > "$TMP/.claude/knowledge/foo.md"
echo "# Subdir version" > "$TMP/.claude/knowledge/concepts/foo.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" load foo 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "Top level" && ! echo "$OUT" | grep -q "Subdir version"; then
  pass "top-level wins over subdir on bare-name lookup"
else
  fail_case "precedence" "exit=$EXIT"
fi

# 68. Subdir-qualified still works when top-level exists with same name
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" load concepts/foo 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "Subdir version"; then
  pass "qualified path overrides top-level"
else
  fail_case "qualified override" "exit=$EXIT"
fi

# 69. Search recurses into subdirs
TMP=$(mktmp)
mkdir -p "$TMP/.claude/knowledge/concepts"
echo "supabase RLS pattern" > "$TMP/.claude/knowledge/concepts/auth.md"
EXIT=0; OUT=$(HOME="$TMP" $NODE "$KN" search RLS 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "concepts/auth.md"; then
  pass "search recurses into concepts/ subdir"
else
  fail_case "search subdir" "exit=$EXIT"
fi

# 70. qualia-postmortem skill installs
TMP=$(mktmp)
echo "QS-FAWZI-01" | HOME="$TMP" $NODE "$INSTALL_JS" >/dev/null 2>&1
if [ -f "$TMP/.claude/skills/qualia-postmortem/SKILL.md" ]; then
  pass "qualia-postmortem skill installs"
else
  fail_case "qualia-postmortem skill missing"
fi

# 71. /qualia-verify skill documents --adversarial flag
if grep -qF -- '--adversarial' "$TMP/.claude/skills/qualia-verify/SKILL.md"; then
  pass "qualia-verify documents --adversarial flag"
else
  fail_case "qualia-verify missing --adversarial"
fi

# 72. /qualia-verify wires /qualia-postmortem on FAIL
if grep -q 'qualia-postmortem' "$TMP/.claude/skills/qualia-verify/SKILL.md"; then
  pass "qualia-verify wires /qualia-postmortem on FAIL"
else
  fail_case "qualia-verify missing postmortem wiring"
fi

# 73. knowledge-flush.js installs at ~/.claude/bin/
if [ -f "$TMP/.claude/bin/knowledge-flush.js" ]; then
  pass "knowledge-flush.js installs"
else
  fail_case "knowledge-flush.js missing after install"
fi

# 74. knowledge-flush.js is syntactically valid Node
EXIT=0; $NODE -c "$TMP/.claude/bin/knowledge-flush.js" 2>/dev/null || EXIT=$?
if [ "$EXIT" -eq 0 ]; then
  pass "knowledge-flush.js parses as valid Node"
else
  fail_case "knowledge-flush.js parse error"
fi

# 75. knowledge-flush.js exits 0 with no daily-log (cron-friendly: no spam)
TMP_HOME=$(mktmp)
mkdir -p "$TMP_HOME/.claude/knowledge"
EXIT=0; HOME="$TMP_HOME" $NODE "$FRAMEWORK_DIR/bin/knowledge-flush.js" >/dev/null 2>&1 || EXIT=$?
if [ "$EXIT" -eq 0 ]; then
  pass "knowledge-flush exits 0 with no daily-log (no cron spam)"
else
  fail_case "knowledge-flush exited $EXIT with no daily-log"
fi

# 76. knowledge-flush.js writes structured JSONL log even on skip
TMP_HOME=$(mktmp)
HOME="$TMP_HOME" $NODE "$FRAMEWORK_DIR/bin/knowledge-flush.js" >/dev/null 2>&1
if [ -f "$TMP_HOME/.claude/.qualia-flush.log" ] && grep -q '"event":"skipped"' "$TMP_HOME/.claude/.qualia-flush.log"; then
  pass "knowledge-flush writes JSONL audit log"
else
  fail_case "knowledge-flush no audit log"
fi

# 77. CLI `qualia-framework flush` dispatches to the script (errors when not installed)
TMP_HOME=$(mktmp)
EXIT=0; OUT=$(HOME="$TMP_HOME" $NODE "$CLI_JS" flush 2>&1) || EXIT=$?
if [ "$EXIT" -eq 1 ] && echo "$OUT" | grep -q "knowledge-flush.js not installed"; then
  pass "CLI flush command surfaces install error gracefully"
else
  fail_case "CLI flush dispatch" "exit=$EXIT out=$OUT"
fi

# 78. CLI flush command appears in help text
EXIT=0; OUT=$($NODE "$CLI_JS" help 2>&1) || EXIT=$?
if [ "$EXIT" -eq 0 ] && echo "$OUT" | grep -q "flush"; then
  pass "help text documents flush command"
else
  fail_case "help missing flush" "exit=$EXIT"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
