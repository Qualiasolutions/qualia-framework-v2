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

# 31. All 8 hooks installed
HOOK_COUNT=$(ls "$TMP/.claude/hooks/"*.js 2>/dev/null | wc -l)
if [ "$HOOK_COUNT" -eq 8 ]; then
  pass "8 hooks installed in hooks/"
else
  fail_case "hook count" "got $HOOK_COUNT"
fi

# 32. settings.json written with hooks + statusLine
if [ -f "$TMP/.claude/settings.json" ] \
   && grep -q '"SessionStart"' "$TMP/.claude/settings.json" \
   && grep -q '"PreToolUse"' "$TMP/.claude/settings.json" \
   && grep -q '"statusLine"' "$TMP/.claude/settings.json"; then
  pass "settings.json has SessionStart, PreToolUse, statusLine"
else
  fail_case "settings.json contents"
fi

# 33. Lowercase code works (resolveTeamCode normalizes)
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
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
