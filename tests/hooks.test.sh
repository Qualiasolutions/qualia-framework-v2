#!/bin/bash
# Qualia Framework v2 — Hook Tests
# Run: bash tests/hooks.test.sh

PASS=0
FAIL=0
HOOKS_DIR="$(dirname "$0")/../hooks"

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

echo "=== Hook Tests ==="
echo ""

# --- block-env-edit.sh ---
echo "block-env-edit:"

echo '{"tool_input":{"file_path":".env.local"}}' | bash "$HOOKS_DIR/block-env-edit.sh" > /dev/null 2>&1
assert_exit "blocks .env.local" 2 $?

echo '{"tool_input":{"file_path":".env.production"}}' | bash "$HOOKS_DIR/block-env-edit.sh" > /dev/null 2>&1
assert_exit "blocks .env.production" 2 $?

echo '{"tool_input":{"file_path":".env"}}' | bash "$HOOKS_DIR/block-env-edit.sh" > /dev/null 2>&1
assert_exit "blocks .env" 2 $?

echo '{"tool_input":{"file_path":"src/app.tsx"}}' | bash "$HOOKS_DIR/block-env-edit.sh" > /dev/null 2>&1
assert_exit "allows src/app.tsx" 0 $?

echo '{"tool_input":{"file_path":"components/Footer.tsx"}}' | bash "$HOOKS_DIR/block-env-edit.sh" > /dev/null 2>&1
assert_exit "allows components/Footer.tsx" 0 $?

# --- migration-guard.sh ---
echo ""
echo "migration-guard:"

echo '{"tool_input":{"file_path":"migrations/001.sql","content":"DROP TABLE users;"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "blocks DROP TABLE without IF EXISTS" 2 $?

echo '{"tool_input":{"file_path":"migrations/001.sql","content":"DROP TABLE IF EXISTS old_users;"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "allows DROP TABLE IF EXISTS" 0 $?

echo '{"tool_input":{"file_path":"migrations/002.sql","content":"DELETE FROM users;"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "blocks DELETE without WHERE" 2 $?

echo '{"tool_input":{"file_path":"migrations/003.sql","content":"TRUNCATE TABLE sessions;"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "blocks TRUNCATE" 2 $?

echo '{"tool_input":{"file_path":"migrations/004.sql","content":"CREATE TABLE users (id uuid);"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "blocks CREATE TABLE without RLS" 2 $?

echo '{"tool_input":{"file_path":"migrations/005.sql","content":"ALTER TABLE users ADD COLUMN email text;"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "allows safe ALTER TABLE" 0 $?

echo '{"tool_input":{"file_path":"src/app.tsx","content":"DROP TABLE users;"}}' | bash "$HOOKS_DIR/migration-guard.sh" > /dev/null 2>&1
assert_exit "skips non-migration files" 0 $?

# --- branch-guard.sh ---
echo ""
echo "branch-guard:"

if [ -f "$HOOKS_DIR/branch-guard.sh" ]; then
  echo "  ✓ branch-guard.sh exists"
  PASS=$((PASS + 1))
else
  echo "  ✗ branch-guard.sh missing"
  FAIL=$((FAIL + 1))
fi

if grep -q 'ROLE' "$HOOKS_DIR/branch-guard.sh"; then
  echo "  ✓ checks ROLE variable"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing ROLE check"
  FAIL=$((FAIL + 1))
fi

if grep -q 'z "$ROLE"' "$HOOKS_DIR/branch-guard.sh"; then
  echo "  ✓ defaults to deny on missing ROLE"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing empty-ROLE deny"
  FAIL=$((FAIL + 1))
fi

# --- pre-push.sh ---
echo ""
echo "pre-push:"

if grep -q 'command -v python3' "$HOOKS_DIR/pre-push.sh"; then
  echo "  ✓ checks for python3 availability"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing python3 check"
  FAIL=$((FAIL + 1))
fi

if grep -q 'qualia-push-err' "$HOOKS_DIR/pre-push.sh"; then
  echo "  ✓ captures python3 errors"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing python3 error capture"
  FAIL=$((FAIL + 1))
fi

# --- pre-deploy-gate.sh ---
echo ""
echo "pre-deploy-gate:"

if [ -f "$HOOKS_DIR/pre-deploy-gate.sh" ]; then
  echo "  ✓ pre-deploy-gate.sh exists"
  PASS=$((PASS + 1))
else
  echo "  ✗ pre-deploy-gate.sh missing"
  FAIL=$((FAIL + 1))
fi

if grep -q 'tsc --noEmit' "$HOOKS_DIR/pre-deploy-gate.sh"; then
  echo "  ✓ runs TypeScript check"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing TypeScript check"
  FAIL=$((FAIL + 1))
fi

if grep -q 'service_role' "$HOOKS_DIR/pre-deploy-gate.sh"; then
  echo "  ✓ checks for service_role leaks"
  PASS=$((PASS + 1))
else
  echo "  ✗ missing service_role check"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
