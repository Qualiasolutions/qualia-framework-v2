#!/bin/bash
# Qualia Framework v2 — state.js behavioral tests
# Run: bash tests/state.test.sh

PASS=0
FAIL=0
# Resolve STATE_JS to an ABSOLUTE path so `cd` inside subshells doesn't break it.
STATE_JS="$(cd "$(dirname "$0")/../bin" && pwd)/state.js"
NODE="${NODE:-node}"

# Track tmp dirs we create so we can clean them up on exit
TMP_DIRS=()
cleanup() {
  for d in "${TMP_DIRS[@]}"; do
    [ -d "$d" ] && rm -rf "$d"
  done
}
trap cleanup EXIT

# Make a fresh temp project with 2 phases, already initialized.
# Prints the absolute path to the new tmp dir (does NOT cd).
make_project() {
  local TMP
  TMP=$(mktemp -d)
  TMP_DIRS+=("$TMP")
  (
    cd "$TMP" || exit 1
    $NODE "$STATE_JS" init \
      --project "TestProject" \
      --phases '[{"name":"Foundation","goal":"Auth"},{"name":"Core","goal":"Features"}]' \
      >/dev/null 2>&1
  )
  echo "$TMP"
}

# pass "name" — record a passing assertion
pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

# fail "name" "detail"
fail_case() {
  echo "  ✗ $1${2:+ — $2}"
  FAIL=$((FAIL + 1))
}

echo "=== state.js Behavioral Tests ==="
echo ""

# Sanity check
if [ ! -f "$STATE_JS" ]; then
  echo "FATAL: state.js not found at $STATE_JS"
  exit 1
fi

# ─── Basic I/O ───────────────────────────────────────────
echo "basic I/O:"

# 1. cmdInit produces valid tracking.json + STATE.md
TMP=$(mktemp -d); TMP_DIRS+=("$TMP")
(
  cd "$TMP" || exit 1
  $NODE "$STATE_JS" init \
    --project "TestProject" \
    --phases '[{"name":"Foundation","goal":"Auth"},{"name":"Core","goal":"Features"}]' \
    >/tmp/qualia-state-test.out 2>&1
)
INIT_EXIT=$?
if [ "$INIT_EXIT" -eq 0 ] \
   && [ -f "$TMP/.planning/tracking.json" ] \
   && [ -f "$TMP/.planning/STATE.md" ] \
   && grep -q '"ok": true' /tmp/qualia-state-test.out \
   && grep -q '"action": "init"' /tmp/qualia-state-test.out; then
  pass "cmdInit creates tracking.json + STATE.md"
else
  fail_case "cmdInit creates tracking.json + STATE.md" "exit=$INIT_EXIT"
fi

# tracking.json content sanity
if grep -q '"project": "TestProject"' "$TMP/.planning/tracking.json" \
   && grep -q '"total_phases": 2' "$TMP/.planning/tracking.json" \
   && grep -q '"phase": 1' "$TMP/.planning/tracking.json" \
   && grep -q '"status": "setup"' "$TMP/.planning/tracking.json"; then
  pass "cmdInit tracking.json has correct fields"
else
  fail_case "cmdInit tracking.json fields"
fi

# STATE.md content sanity
if grep -q 'Phase: 1 of 2 — Foundation' "$TMP/.planning/STATE.md" \
   && grep -q 'Status: setup' "$TMP/.planning/STATE.md"; then
  pass "cmdInit STATE.md has correct header"
else
  fail_case "cmdInit STATE.md header"
fi

# 2. cmdCheck reads back init state
OUT=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
CHECK_EXIT=$?
if [ "$CHECK_EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"phase": 1' \
   && echo "$OUT" | grep -q '"status": "setup"' \
   && echo "$OUT" | grep -q '"total_phases": 2'; then
  pass "cmdCheck returns phase=1 status=setup total_phases=2"
else
  fail_case "cmdCheck returns init state" "exit=$CHECK_EXIT"
fi

# 3. cmdCheck with no project → ok:false NO_PROJECT, exit 1
TMP2=$(mktemp -d); TMP_DIRS+=("$TMP2")
OUT=$(cd "$TMP2" && $NODE "$STATE_JS" check 2>&1)
CHECK_EXIT=$?
if [ "$CHECK_EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"ok": false' \
   && echo "$OUT" | grep -q '"error": "NO_PROJECT"'; then
  pass "cmdCheck without .planning → NO_PROJECT, exit 1"
else
  fail_case "cmdCheck NO_PROJECT" "exit=$CHECK_EXIT"
fi

# ─── Happy path transitions ──────────────────────────────
echo ""
echo "happy path transitions:"

# 4. setup → planned (with plan file)
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"status": "planned"' \
   && echo "$OUT" | grep -q '"previous_status": "setup"'; then
  pass "setup → planned succeeds with plan file"
else
  fail_case "setup → planned" "exit=$EXIT out=$OUT"
fi

# 5. planned → built (records tasks_done/tasks_total)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 5 --tasks-total 5 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"status": "built"' \
   && grep -q '"tasks_done": 5' "$TMP/.planning/tracking.json" \
   && grep -q '"tasks_total": 5' "$TMP/.planning/tracking.json"; then
  pass "planned → built records tasks_done/tasks_total"
else
  fail_case "planned → built" "exit=$EXIT"
fi

# 6. built → verified(pass) auto-advances to phase 2, resets status to setup
touch "$TMP/.planning/phase-1-verification.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification pass 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"phase": 2' \
   && echo "$OUT" | grep -q '"status": "setup"'; then
  pass "built → verified(pass) auto-advances phase and resets to setup"
else
  fail_case "built → verified(pass) auto-advance" "exit=$EXIT out=$OUT"
fi

# 7. built → verified(fail) stays on phase 1, records verification=fail
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 3 --tasks-total 5 >/dev/null 2>&1)
touch "$TMP/.planning/phase-1-verification.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification fail 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"phase": 1' \
   && echo "$OUT" | grep -q '"status": "verified"' \
   && echo "$OUT" | grep -q '"verification": "fail"'; then
  pass "built → verified(fail) stays on phase 1"
else
  fail_case "built → verified(fail)" "exit=$EXIT out=$OUT"
fi

# ─── Precondition failures ───────────────────────────────
echo ""
echo "precondition failures:"

# 8. setup → built fails with PRECONDITION_FAILED
TMP=$(make_project)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to built 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"ok": false' \
   && echo "$OUT" | grep -q '"error": "PRECONDITION_FAILED"' \
   && echo "$OUT" | grep -q "Cannot go from 'setup' to 'built'"; then
  pass "setup → built fails with PRECONDITION_FAILED"
else
  fail_case "setup → built precondition" "exit=$EXIT out=$OUT"
fi

# 9. planned → verified fails (requires status=built)
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
touch "$TMP/.planning/phase-1-verification.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification pass 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "PRECONDITION_FAILED"' \
   && echo "$OUT" | grep -q "Cannot go from 'planned' to 'verified'"; then
  pass "planned → verified fails (requires built)"
else
  fail_case "planned → verified precondition" "exit=$EXIT out=$OUT"
fi

# 10. planned with missing plan file → MISSING_FILE
TMP=$(make_project)
# no phase-1-plan.md created
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "MISSING_FILE"' \
   && echo "$OUT" | grep -q "phase-1-plan.md"; then
  pass "setup → planned fails without plan file (MISSING_FILE)"
else
  fail_case "setup → planned MISSING_FILE" "exit=$EXIT out=$OUT"
fi

# 11. built → verified with missing verification file → MISSING_FILE
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
# NO verification file
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification pass 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "MISSING_FILE"' \
   && echo "$OUT" | grep -q "phase-1-verification.md"; then
  pass "built → verified fails without verification file (MISSING_FILE)"
else
  fail_case "built → verified MISSING_FILE" "exit=$EXIT out=$OUT"
fi

# 12. built → verified without --verification → MISSING_ARG
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
touch "$TMP/.planning/phase-1-verification.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to verified 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "MISSING_ARG"' \
   && echo "$OUT" | grep -q "verification"; then
  pass "built → verified without --verification → MISSING_ARG"
else
  fail_case "built → verified MISSING_ARG" "exit=$EXIT out=$OUT"
fi

# 13. → shipped without --deployed-url → MISSING_ARG
# Must go through polished first, so fabricate state by transitioning through the full path.
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
touch "$TMP/.planning/phase-1-verification.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification pass >/dev/null 2>&1)
# Now on phase 2, status=setup. Run phase 2 to completion.
touch "$TMP/.planning/phase-2-plan.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
touch "$TMP/.planning/phase-2-verification.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification pass >/dev/null 2>&1)
# Status should now be "verified" on last phase (no auto-advance past last phase)
(cd "$TMP" && $NODE "$STATE_JS" transition --to polished >/dev/null 2>&1)
# Now try ship without deployed-url
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to shipped 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "MISSING_ARG"' \
   && echo "$OUT" | grep -q "deployed-url"; then
  pass "→ shipped without --deployed-url → MISSING_ARG"
else
  fail_case "→ shipped MISSING_ARG" "exit=$EXIT out=$OUT"
fi

# 14. Unknown target --to frobnicate → INVALID_STATUS
TMP=$(make_project)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to frobnicate 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "INVALID_STATUS"'; then
  pass "--to frobnicate → INVALID_STATUS"
else
  fail_case "invalid target" "exit=$EXIT out=$OUT"
fi

# ─── Gap cycle circuit breaker ───────────────────────────
echo ""
echo "gap cycle circuit breaker:"

# 15. First gap closure: verified(fail) → planned, gap_cycles[1]=1
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
touch "$TMP/.planning/phase-1-verification.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification fail >/dev/null 2>&1)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"gap_cycles": 1'; then
  pass "first gap closure: verified(fail) → planned, gap_cycles=1"
else
  fail_case "first gap closure" "exit=$EXIT out=$OUT"
fi

# 16. Second gap closure: gap_cycles[1]=2
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification fail >/dev/null 2>&1)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"gap_cycles": 2'; then
  pass "second gap closure: gap_cycles=2"
else
  fail_case "second gap closure" "exit=$EXIT out=$OUT"
fi

# 17. Third gap closure attempt → GAP_CYCLE_LIMIT
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification fail >/dev/null 2>&1)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "GAP_CYCLE_LIMIT"'; then
  pass "third gap closure attempt blocked (GAP_CYCLE_LIMIT)"
else
  fail_case "gap cycle limit" "exit=$EXIT out=$OUT"
fi

# 18. verified(pass) resets gap_cycles[1] to 0
# Set up a fresh project, do ONE failed cycle, then pass on the next attempt.
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
touch "$TMP/.planning/phase-1-verification.md"
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification fail >/dev/null 2>&1)
# gap_cycles[1] is now 0 before the gap closure; becomes 1 after
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to built --tasks-done 1 --tasks-total 1 >/dev/null 2>&1)
(cd "$TMP" && $NODE "$STATE_JS" transition --to verified --verification pass >/dev/null 2>&1)
# After pass, gap_cycles[1] should be reset to 0 in tracking.json
if grep -q '"1": 0' "$TMP/.planning/tracking.json"; then
  pass "verified(pass) resets gap_cycles[1] to 0"
else
  fail_case "gap cycle reset on pass"
fi

# ─── Special transitions ─────────────────────────────────
echo ""
echo "special transitions:"

# 19. --to note --notes "foo" succeeds, records notes
TMP=$(make_project)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to note --notes "hello world" 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"action": "note"' \
   && echo "$OUT" | grep -q '"status": "setup"' \
   && grep -q '"notes": "hello world"' "$TMP/.planning/tracking.json"; then
  pass "--to note records notes, status unchanged"
else
  fail_case "--to note" "exit=$EXIT out=$OUT"
fi

# 20. --to activity succeeds without status change
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to activity 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"action": "activity"' \
   && echo "$OUT" | grep -q '"status": "setup"'; then
  pass "--to activity succeeds without status change"
else
  fail_case "--to activity" "exit=$EXIT out=$OUT"
fi

# ─── Parse schema errors ─────────────────────────────────
echo ""
echo "parse schema errors:"

# 21. Well-formed STATE.md: no schema_errors field in check output
TMP=$(make_project)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && ! echo "$OUT" | grep -q 'schema_errors'; then
  pass "well-formed STATE.md: check has no schema_errors"
else
  fail_case "well-formed no schema_errors" "exit=$EXIT out=$OUT"
fi

# 22. Missing Phase: header → schema_errors with phase_header (error)
TMP=$(make_project)
sed -i.bak '/^Phase:/d' "$TMP/.planning/STATE.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q 'schema_errors' \
   && echo "$OUT" | grep -q 'phase_header'; then
  pass "missing Phase: header → schema_errors contains phase_header"
else
  fail_case "missing phase header" "exit=$EXIT out=$OUT"
fi

# 23. Missing roadmap table header → schema_errors with roadmap_table
TMP=$(make_project)
sed -i.bak '/^| # | Phase | Goal | Status |$/d' "$TMP/.planning/STATE.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q 'schema_errors' \
   && echo "$OUT" | grep -q 'roadmap_table'; then
  pass "missing roadmap table → schema_errors contains roadmap_table"
else
  fail_case "missing roadmap_table" "exit=$EXIT out=$OUT"
fi

# 24. Missing Status: line → schema_errors warning status_field, ok:true
TMP=$(make_project)
sed -i.bak '/^Status:/d' "$TMP/.planning/STATE.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q 'schema_errors' \
   && echo "$OUT" | grep -q 'status_field' \
   && echo "$OUT" | grep -q '"severity": "warning"'; then
  pass "missing Status: → warning status_field, ok:true"
else
  fail_case "missing Status field" "exit=$EXIT out=$OUT"
fi

# 25. Roadmap row count mismatch → schema_errors warning roadmap_rows
# Hand-edit header to claim 3 phases when only 2 rows exist.
TMP=$(make_project)
sed -i.bak 's/^Phase: 1 of 2 — Foundation/Phase: 1 of 3 — Foundation/' "$TMP/.planning/STATE.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q 'schema_errors' \
   && echo "$OUT" | grep -q 'roadmap_rows'; then
  pass "roadmap row count mismatch → warning roadmap_rows"
else
  fail_case "roadmap row count mismatch" "exit=$EXIT out=$OUT"
fi

# 26. Transition refuses on severity=error (missing Phase: header)
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
sed -i.bak '/^Phase:/d' "$TMP/.planning/STATE.md"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 1 ] \
   && echo "$OUT" | grep -q '"error": "STATE_SCHEMA_ERROR"'; then
  pass "transition refused on severity=error (STATE_SCHEMA_ERROR)"
else
  fail_case "transition STATE_SCHEMA_ERROR" "exit=$EXIT out=$OUT"
fi

# 27. fix rewrites malformed STATE.md into canonical form
TMP=$(make_project)
sed -i.bak '/^Phase:/d' "$TMP/.planning/STATE.md"
# Confirm it's broken first
(cd "$TMP" && $NODE "$STATE_JS" check 2>&1 | grep -q schema_errors) || \
  fail_case "fix pretest: check should show errors"
OUT=$(cd "$TMP" && $NODE "$STATE_JS" fix 2>&1)
EXIT=$?
OUT2=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"action": "fix"' \
   && echo "$OUT" | grep -q '"fixed": true' \
   && echo "$OUT" | grep -q '"previous_errors": 1' \
   && ! echo "$OUT2" | grep -q 'schema_errors'; then
  pass "fix repairs malformed STATE.md"
else
  fail_case "fix repair" "exit=$EXIT fix=$OUT check=$OUT2"
fi

# 28. fix on well-formed STATE.md is a no-op (still parses clean)
TMP=$(make_project)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" fix 2>&1)
EXIT=$?
OUT2=$(cd "$TMP" && $NODE "$STATE_JS" check 2>&1)
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"action": "fix"' \
   && echo "$OUT" | grep -q '"previous_errors": 0' \
   && ! echo "$OUT2" | grep -q 'schema_errors' \
   && echo "$OUT2" | grep -q '"phase": 1' \
   && echo "$OUT2" | grep -q '"total_phases": 2'; then
  pass "fix on well-formed STATE.md is idempotent"
else
  fail_case "fix idempotent" "exit=$EXIT fix=$OUT check=$OUT2"
fi

# 29. After fix, transition that was previously blocked now works
TMP=$(make_project)
touch "$TMP/.planning/phase-1-plan.md"
sed -i.bak '/^Phase:/d' "$TMP/.planning/STATE.md"
# Blocked before fix
(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1 | grep -q STATE_SCHEMA_ERROR) || \
  fail_case "fix unblock pretest: should be blocked"
(cd "$TMP" && $NODE "$STATE_JS" fix >/dev/null 2>&1)
OUT=$(cd "$TMP" && $NODE "$STATE_JS" transition --to planned 2>&1)
EXIT=$?
if [ "$EXIT" -eq 0 ] \
   && echo "$OUT" | grep -q '"ok": true' \
   && echo "$OUT" | grep -q '"status": "planned"'; then
  pass "after fix, blocked transition succeeds"
else
  fail_case "after fix transition" "exit=$EXIT out=$OUT"
fi

# ─── Summary ─────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
