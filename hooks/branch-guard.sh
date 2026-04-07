#!/bin/bash
# Block non-OWNER push to main/master

BRANCH=$(git branch --show-current 2>/dev/null)
ROLE=$(grep -m1 "^## Role:" ~/.claude/CLAUDE.md 2>/dev/null | sed 's/^## Role: *//')

if [ -z "$ROLE" ]; then
  echo "BLOCKED: Cannot determine role — ~/.claude/CLAUDE.md missing or malformed. Defaulting to deny."
  exit 1
fi

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  if [[ "$ROLE" != "OWNER" ]]; then
    echo "BLOCKED: Employees cannot push to $BRANCH. Create a feature branch first."
    echo "Run: git checkout -b feature/your-feature-name"
    exit 1
  fi
fi
