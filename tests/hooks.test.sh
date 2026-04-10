#!/bin/bash
# Qualia Framework v2 — Hook Tests (cross-platform Node.js hooks)
# Run: bash tests/hooks.test.sh

PASS=0
FAIL=0
# Resolve HOOKS_DIR to an ABSOLUTE path so `cd` inside subshells doesn't break it.
HOOKS_DIR="$(cd "$(dirname "$0")/../hooks" && pwd)"
NODE="${NODE:-node}"

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

echo "=== Hook Tests (Node.js) ==="
echo ""

# --- All hooks are syntactically valid Node.js ---
echo "syntax:"
for f in "$HOOKS_DIR"/*.js; do
  if $NODE -c "$f" 2>/dev/null; then
    echo "  ✓ $(basename "$f")"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $(basename "$f")"
    FAIL=$((FAIL + 1))
  fi
done

# --- block-env-edit.js ---
echo ""
echo "block-env-edit:"

echo '{"tool_input":{"file_path":".env.local"}}' | $NODE "$HOOKS_DIR/block-env-edit.js" > /dev/null 2>&1
assert_exit "blocks .env.local" 2 $?

echo '{"tool_input":{"file_path":".env.production"}}' | $NODE "$HOOKS_DIR/block-env-edit.js" > /dev/null 2>&1
assert_exit "blocks .env.production" 2 $?

echo '{"tool_input":{"file_path":".env"}}' | $NODE "$HOOKS_DIR/block-env-edit.js" > /dev/null 2>&1
assert_exit "blocks .env" 2 $?

# Windows-style path with backslashes (normalized by the hook)
echo '{"tool_input":{"file_path":"C:\\project\\.env.local"}}' | $NODE "$HOOKS_DIR/block-env-edit.js" > /dev/null 2>&1
assert_exit "blocks windows .env.local" 2 $?

echo '{"tool_input":{"file_path":"src/app.tsx"}}' | $NODE "$HOOKS_DIR/block-env-edit.js" > /dev/null 2>&1
assert_exit "allows src/app.tsx" 0 $?

echo '{"tool_input":{"file_path":"components/Footer.tsx"}}' | $NODE "$HOOKS_DIR/block-env-edit.js" > /dev/null 2>&1
assert_exit "allows components/Footer.tsx" 0 $?

# --- migration-guard.js ---
echo ""
echo "migration-guard:"

echo '{"tool_input":{"file_path":"migrations/001.sql","content":"DROP TABLE users;"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "blocks DROP TABLE without IF EXISTS" 2 $?

echo '{"tool_input":{"file_path":"migrations/001.sql","content":"DROP TABLE IF EXISTS old_users;"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "allows DROP TABLE IF EXISTS" 0 $?

echo '{"tool_input":{"file_path":"migrations/002.sql","content":"DELETE FROM users;"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "blocks DELETE without WHERE" 2 $?

echo '{"tool_input":{"file_path":"migrations/003.sql","content":"TRUNCATE TABLE sessions;"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "blocks TRUNCATE" 2 $?

echo '{"tool_input":{"file_path":"migrations/004.sql","content":"CREATE TABLE users (id uuid);"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "blocks CREATE TABLE without RLS" 2 $?

echo '{"tool_input":{"file_path":"migrations/005.sql","content":"ALTER TABLE users ADD COLUMN email text;"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "allows safe ALTER TABLE" 0 $?

echo '{"tool_input":{"file_path":"src/app.tsx","content":"DROP TABLE users;"}}' | $NODE "$HOOKS_DIR/migration-guard.js" > /dev/null 2>&1
assert_exit "skips non-migration files" 0 $?

# --- branch-guard.js (behavioral — real git repo + real config file) ---
echo ""
echo "branch-guard:"

# setup_guard_repo <branch> <role> → prints absolute path to a fresh tmp dir
# containing a git repo (checked out to <branch>) and a
# .claude/.qualia-config.json with {"role":"<role>"}. Caller must `rm -rf`.
setup_guard_repo() {
  local branch="$1" role="$2"
  local tmp
  tmp=$(mktemp -d)
  mkdir -p "$tmp/proj" "$tmp/.claude"
  (cd "$tmp/proj" \
    && git init -q \
    && git checkout -b "$branch" -q 2>/dev/null)
  printf '{"role":"%s"}\n' "$role" > "$tmp/.claude/.qualia-config.json"
  echo "$tmp"
}

# OWNER on main → allowed (exit 0)
TMP=$(setup_guard_repo main OWNER)
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "OWNER on main → allowed" 0 $?
rm -rf "$TMP"

# EMPLOYEE on main → blocked (exit 1)
TMP=$(setup_guard_repo main EMPLOYEE)
OUT=$(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" 2>&1)
RC=$?
if [ "$RC" -eq 1 ] && echo "$OUT" | grep -q "BLOCKED" && echo "$OUT" | grep -q "main"; then
  echo "  ✓ EMPLOYEE on main → blocked (BLOCKED in stdout)"
  PASS=$((PASS + 1))
else
  echo "  ✗ EMPLOYEE on main → blocked (exit=$RC)"
  FAIL=$((FAIL + 1))
fi
rm -rf "$TMP"

# EMPLOYEE on master → blocked
TMP=$(setup_guard_repo master EMPLOYEE)
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "EMPLOYEE on master → blocked" 1 $?
rm -rf "$TMP"

# EMPLOYEE on feature branch → allowed
TMP=$(setup_guard_repo feature/xyz EMPLOYEE)
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "EMPLOYEE on feature/xyz → allowed" 0 $?
rm -rf "$TMP"

# OWNER on feature branch → allowed
TMP=$(setup_guard_repo feature/xyz OWNER)
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "OWNER on feature/xyz → allowed" 0 $?
rm -rf "$TMP"

# Missing config → fails closed (block, exit 1)
TMP=$(mktemp -d)
mkdir -p "$TMP/proj"
(cd "$TMP/proj" && git init -q && git checkout -b feature/x -q 2>/dev/null)
# NO .claude/.qualia-config.json
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "missing config → blocked (fails closed)" 1 $?
rm -rf "$TMP"

# Malformed config JSON → fails closed
TMP=$(mktemp -d)
mkdir -p "$TMP/proj" "$TMP/.claude"
(cd "$TMP/proj" && git init -q && git checkout -b feature/x -q 2>/dev/null)
echo 'not json{' > "$TMP/.claude/.qualia-config.json"
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "malformed config JSON → blocked" 1 $?
rm -rf "$TMP"

# Empty role field → fails closed
TMP=$(mktemp -d)
mkdir -p "$TMP/proj" "$TMP/.claude"
(cd "$TMP/proj" && git init -q && git checkout -b feature/x -q 2>/dev/null)
echo '{"role":""}' > "$TMP/.claude/.qualia-config.json"
(cd "$TMP/proj" && HOME="$TMP" $NODE "$HOOKS_DIR/branch-guard.js" >/dev/null 2>&1)
assert_exit "empty role field → blocked" 1 $?
rm -rf "$TMP"

# --- pre-push.js ---
echo ""
echo "pre-push:"

if grep -q 'tracking.json' "$HOOKS_DIR/pre-push.js"; then
  echo "  ✓ updates tracking.json"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing tracking.json update"
  FAIL=$((FAIL + 1))
fi

if grep -q 'last_commit' "$HOOKS_DIR/pre-push.js"; then
  echo "  ✓ stamps last_commit"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing last_commit stamp"
  FAIL=$((FAIL + 1))
fi

# Run pre-push.js in a dir with no tracking.json — must exit 0 cleanly
TMP=$(mktemp -d)
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-push.js" >/dev/null 2>&1)
assert_exit "exits 0 with no tracking.json" 0 $?
rm -rf "$TMP"

# --- pre-deploy-gate.js (behavioral — real project trees) ---
echo ""
echo "pre-deploy-gate:"

# Empty project (no package.json, no tsconfig) → nothing to gate → exit 0
TMP=$(mktemp -d)
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" >/dev/null 2>&1)
assert_exit "empty project → exit 0 (no gates to run)" 0 $?
rm -rf "$TMP"

# No tsconfig → TypeScript gate skipped → exit 0 (only security scan runs)
TMP=$(mktemp -d)
mkdir -p "$TMP/src"
echo 'export const x = 1;' > "$TMP/src/app.ts"
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" >/dev/null 2>&1)
assert_exit "no tsconfig → TS gate skipped → exit 0" 0 $?
rm -rf "$TMP"

# service_role literal in app/ → BLOCKED with diagnostic
TMP=$(mktemp -d)
mkdir -p "$TMP/app"
cat > "$TMP/app/page.tsx" <<'EOF'
const key = "service_role_literal_leak";
export default function P(){return null}
EOF
OUT=$(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" 2>&1)
RC=$?
if [ "$RC" -eq 1 ] \
   && echo "$OUT" | grep -q "BLOCKED" \
   && echo "$OUT" | grep -q "service_role"; then
  echo "  ✓ service_role leak in app/ → blocked with diagnostic"
  PASS=$((PASS + 1))
else
  echo "  ✗ service_role leak in app/ → blocked (exit=$RC)"
  FAIL=$((FAIL + 1))
fi
rm -rf "$TMP"

# service_role leak in components/ → BLOCKED
TMP=$(mktemp -d)
mkdir -p "$TMP/components"
cat > "$TMP/components/Widget.tsx" <<'EOF'
const key = "service_role_literal_leak";
EOF
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" >/dev/null 2>&1)
assert_exit "service_role in components/ → blocked" 1 $?
rm -rf "$TMP"

# service_role in a *.server.ts file → allowed (skip convention)
TMP=$(mktemp -d)
mkdir -p "$TMP/app/api"
cat > "$TMP/app/api/route.server.ts" <<'EOF'
const key = "service_role_legit_server_key";
EOF
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" >/dev/null 2>&1)
assert_exit ".server.ts is exempt from service_role scan" 0 $?
rm -rf "$TMP"

# service_role inside a server/ directory → allowed
TMP=$(mktemp -d)
mkdir -p "$TMP/app/server"
cat > "$TMP/app/server/admin.ts" <<'EOF'
const key = "service_role_legit_server_dir";
EOF
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" >/dev/null 2>&1)
assert_exit "files under server/ are exempt from service_role scan" 0 $?
rm -rf "$TMP"

# node_modules and dotdirs are NOT walked — a leak inside them must not block
TMP=$(mktemp -d)
mkdir -p "$TMP/app/node_modules/evil"
cat > "$TMP/app/node_modules/evil/index.ts" <<'EOF'
const key = "service_role_in_node_modules";
EOF
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" >/dev/null 2>&1)
assert_exit "node_modules not walked (leak ignored)" 0 $?
rm -rf "$TMP"

# Clean project (no leaks anywhere) → passes security gate → exit 0
TMP=$(mktemp -d)
mkdir -p "$TMP/app" "$TMP/components" "$TMP/lib"
echo 'export const a = 1;' > "$TMP/app/page.tsx"
echo 'export const b = 2;' > "$TMP/components/Widget.tsx"
echo 'export const c = 3;' > "$TMP/lib/util.ts"
OUT=$(cd "$TMP" && $NODE "$HOOKS_DIR/pre-deploy-gate.js" 2>&1)
RC=$?
if [ "$RC" -eq 0 ] && echo "$OUT" | grep -q "All gates passed"; then
  echo "  ✓ clean project → all gates pass → exit 0"
  PASS=$((PASS + 1))
else
  echo "  ✗ clean project → all gates pass (exit=$RC)"
  FAIL=$((FAIL + 1))
fi
rm -rf "$TMP"

# --- session-start.js — must exit 0 always ---
echo ""
echo "session-start:"

TMP=$(mktemp -d)
(cd "$TMP" && $NODE "$HOOKS_DIR/session-start.js" >/dev/null 2>&1)
assert_exit "exits 0 with no project" 0 $?

# Simulate a project with STATE.md
mkdir -p "$TMP/.planning"
cat > "$TMP/.planning/STATE.md" <<'EOF'
# Project State
Phase: 1 of 3 — Foundation
Status: setup
EOF
(cd "$TMP" && $NODE "$HOOKS_DIR/session-start.js" >/dev/null 2>&1)
assert_exit "exits 0 with STATE.md" 0 $?
rm -rf "$TMP"

# --- pre-compact.js ---
echo ""
echo "pre-compact:"

TMP=$(mktemp -d)
(cd "$TMP" && $NODE "$HOOKS_DIR/pre-compact.js" >/dev/null 2>&1)
assert_exit "exits 0 with no STATE.md" 0 $?
rm -rf "$TMP"

# --- auto-update.js ---
echo ""
echo "auto-update:"

TMP=$(mktemp -d)
mkdir -p "$TMP/.claude"
echo '{"code":"QS-FAWZI-01","version":"99.99.99"}' > "$TMP/.claude/.qualia-config.json"
HOME="$TMP" $NODE "$HOOKS_DIR/auto-update.js" >/dev/null 2>&1
assert_exit "exits 0 (fast path)" 0 $?
# Should now have cache file
if [ -f "$TMP/.claude/.qualia-last-update-check" ]; then
  echo "  ✓ writes cache timestamp"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing cache timestamp"
  FAIL=$((FAIL + 1))
fi
rm -rf "$TMP"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
