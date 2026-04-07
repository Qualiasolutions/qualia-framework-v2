#!/bin/bash
# Catch dangerous SQL patterns in migration files
# Runs as PreToolUse hook on Write/Edit of migration files

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null)
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // ""' 2>/dev/null)

# Only check migration/SQL files
case "$FILE" in
  *migration*|*migrate*|*.sql) ;;
  *) exit 0 ;;
esac

ERRORS=""

# DROP TABLE without safeguards
if echo "$CONTENT" | grep -qi "DROP TABLE" && ! echo "$CONTENT" | grep -qi "IF EXISTS"; then
  ERRORS="${ERRORS}\n  ✗ DROP TABLE without IF EXISTS"
fi

# DELETE without WHERE
if echo "$CONTENT" | grep -qi "DELETE FROM" && ! echo "$CONTENT" | grep -qi "WHERE"; then
  ERRORS="${ERRORS}\n  ✗ DELETE FROM without WHERE clause"
fi

# TRUNCATE (almost always wrong in migrations)
if echo "$CONTENT" | grep -qi "TRUNCATE"; then
  ERRORS="${ERRORS}\n  ✗ TRUNCATE detected — are you sure?"
fi

# CREATE TABLE without RLS
if echo "$CONTENT" | grep -qi "CREATE TABLE" && ! echo "$CONTENT" | grep -qi "ENABLE ROW LEVEL SECURITY"; then
  ERRORS="${ERRORS}\n  ✗ CREATE TABLE without ENABLE ROW LEVEL SECURITY"
fi

if [ -n "$ERRORS" ]; then
  echo "◆ Migration guard — dangerous patterns found:"
  echo -e "$ERRORS"
  echo ""
  echo "Fix these before proceeding. If intentional, ask Fawzi to approve."
  exit 2
fi
