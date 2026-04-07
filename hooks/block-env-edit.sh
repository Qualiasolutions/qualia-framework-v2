#!/bin/bash
# Prevent Claude from editing .env files
# Claude Code hooks receive JSON on stdin with tool_input.file_path

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.command // ""' 2>/dev/null)

if [[ "$FILE" == *.env* ]] || [[ "$FILE" == *".env.local"* ]] || [[ "$FILE" == *".env.production"* ]]; then
  echo "BLOCKED: Cannot edit environment files. Ask Fawzi to update secrets."
  exit 2
fi
