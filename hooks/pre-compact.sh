#!/bin/bash
# Save state before context compression

if [ -f ".planning/STATE.md" ]; then
  echo "QUALIA: Saving state before compaction..."
  # State is in git — just ensure it's committed
  if git diff --name-only .planning/STATE.md 2>/dev/null | grep -q STATE; then
    git add .planning/STATE.md
    git commit -m "state: pre-compaction save" 2>/dev/null
  fi
fi
