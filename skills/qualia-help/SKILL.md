---
name: qualia-help
description: "Open the Qualia Framework reference guide in the browser. A beautiful themed HTML page with all commands, rules, services, and the road. Trigger on 'help', 'how does this work', 'show me the commands', 'qualia help', 'reference'."
---

# /qualia-help — Framework Reference

Opens a Qualia-themed HTML reference guide in your default browser.

## Process

### 1. Generate the HTML

```bash
# Read the template and inject the current version
VERSION=$(node -e "console.log(require(require('os').homedir() + '/.claude/.qualia-config.json').version || 'v3')" 2>/dev/null || echo "v3")
TEMPLATE="$HOME/.claude/qualia-templates/help.html"
OUTPUT="/tmp/qualia-help.html"

# If template doesn't exist, check the framework install
if [ ! -f "$TEMPLATE" ]; then
  TEMPLATE="$(dirname "$(dirname "$(which qualia-framework 2>/dev/null || echo '')")")/templates/help.html"
fi
```

### 2. Inject version and open

```bash
# Replace {{VERSION}} placeholder with actual version
sed "s/{{VERSION}}/$VERSION/g" "$TEMPLATE" > "$OUTPUT"

# Open in default browser (cross-platform)
if command -v xdg-open &>/dev/null; then
  xdg-open "$OUTPUT"          # Linux
elif command -v open &>/dev/null; then
  open "$OUTPUT"               # macOS
elif command -v start &>/dev/null; then
  start "$OUTPUT"              # Windows (Git Bash)
else
  echo "Open this file in your browser: $OUTPUT"
fi
```

### 3. Confirm

```bash
node ~/.claude/bin/qualia-ui.js banner router
node ~/.claude/bin/qualia-ui.js ok "Reference guide opened in browser"
node ~/.claude/bin/qualia-ui.js info "File: /tmp/qualia-help.html"
```

If the browser does not open automatically, tell the user the file path so they can open it manually.

## Notes

- The HTML file is self-contained — no external dependencies except Google Fonts
- Works offline after first load (fonts cache)
- Qualia-themed: dark background, teal accents, Outfit + Inter fonts
- Shows: The Road, all commands grouped, verification scoring, rules, stack, GitHub orgs
- Version is injected dynamically from .qualia-config.json
