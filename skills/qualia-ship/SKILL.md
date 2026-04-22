---
name: qualia-ship
description: "Deploy to production — state-guard, full security scan, quality gates, commit, push, deploy, verify. Trigger on 'deploy', 'ship it', 'go live', 'push to prod', 'launch', 'release to production'."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# /qualia-ship — Deploy

Full deployment pipeline with quality gates.

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner ship
```

### 0. State Guard — refuse to ship from an invalid state

`/qualia-ship` is a terminal operation — it writes a deployed tag, bumps counters, and produces a verified URL. It must NEVER run on an unpolished, unverified, or malformed project.

```bash
STATE=$(node ~/.claude/bin/state.js check 2>/dev/null)
if [ -z "$STATE" ]; then
  node ~/.claude/bin/qualia-ui.js fail "No project loaded. Run /qualia-new first or cd to a Qualia-managed project."
  exit 1
fi

STATUS=$(echo "$STATE" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.status||'')}catch{}")
VERIFICATION=$(echo "$STATE" | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(d.verification||'')}catch{}")

# Valid ship-from states:
#   polished     — /qualia-polish ran cleanly; ready for deploy
#   verified+pass — final phase verified; skipping polish is allowed for hotfixes
# Anything else (setup, planned, built, shipped, handed_off, verified+fail) is refused.
if [ "$STATUS" != "polished" ] && ! { [ "$STATUS" = "verified" ] && [ "$VERIFICATION" = "pass" ]; }; then
  node ~/.claude/bin/qualia-ui.js fail "Cannot ship from state '$STATUS' (verification: ${VERIFICATION:-none})."
  node ~/.claude/bin/qualia-ui.js info "Run /qualia-polish first, or /qualia-verify {phase} if verification is still pending."
  node ~/.claude/bin/qualia-ui.js info "Override: add --force to the skill invocation (hotfix escape hatch, use with care)."
  # The --force escape hatch exists for production hotfixes where the polished
  # state was never reached. The operator is expected to have read and
  # understood the pending verification findings.
  exit 1
fi
```

### 1. Quality Gates

Run in sequence. Auto-fix failures (up to 2 attempts).

```bash
npx tsc --noEmit          # TypeScript — must pass
npx eslint . --max-warnings 0   # Lint — auto-fix first
npm run build             # Build — must succeed
```

On failure:
1. Summarize what failed in plain language
2. Auto-fix
3. Re-run the gate
4. If still failing after 2 attempts: tell the employee, suggest `/qualia-debug`

### 2. Security Check — full depth

Shallow grep on `service_role` alone was missing hardcoded keys, tracked `.env` files, and dangerous DOM injection. Match the CRITICAL checks from `/qualia-review` exactly so the two skills agree.

```bash
SEC_FAIL=0

# CRITICAL: service_role in client-facing code
HITS=$(grep -rn "service_role" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | grep -v "\.server\.\|[\\/]server[\\/]\|[\\/]app[\\/]api[\\/]\|route\.\|middleware\.")
if [ -n "$HITS" ]; then
  node ~/.claude/bin/qualia-ui.js fail "service_role leaked to client code:"
  echo "$HITS" | head -5
  SEC_FAIL=1
fi

# CRITICAL: hardcoded secrets
HITS=$(grep -rn "sk_live\|sk_test\|SUPABASE_SERVICE_ROLE\|eyJhbGciOi" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | grep -v "\.env")
if [ -n "$HITS" ]; then
  node ~/.claude/bin/qualia-ui.js fail "Hardcoded secret found:"
  echo "$HITS" | head -5
  SEC_FAIL=1
fi

# CRITICAL: dangerouslySetInnerHTML / eval
HITS=$(grep -rn "dangerouslySetInnerHTML\|eval(" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ 2>/dev/null | grep -v node_modules)
if [ -n "$HITS" ]; then
  node ~/.claude/bin/qualia-ui.js fail "Dangerous innerHTML/eval pattern:"
  echo "$HITS" | head -5
  SEC_FAIL=1
fi

# CRITICAL: .env files tracked in git
HITS=$(git ls-files | grep -i "\.env" | grep -v "\.example\|\.template\|\.sample")
if [ -n "$HITS" ]; then
  node ~/.claude/bin/qualia-ui.js fail ".env files tracked in git:"
  echo "$HITS"
  SEC_FAIL=1
fi

if [ $SEC_FAIL -ne 0 ]; then
  node ~/.claude/bin/qualia-ui.js fail "Security check failed. Fix findings above or run /qualia-review for full audit."
  exit 1
fi
```

### 3. Git

```bash
git add {specific changed files}
git commit -m "ship: {project name} production deploy"
git push
```

Employee stays on feature branch. Never push to main.

### 4. Deploy

```bash
vercel --prod              # Website/AI agent
# OR
supabase functions deploy  # Edge functions
# OR
wrangler deploy            # Cloudflare Workers
```

### 5. Post-Deploy Verification

Read the deployed URL from `tracking.json.deployed_url` — set by the deploy tool's output parser, or passed via `--url` to this skill. Do NOT use a `{domain}` placeholder — that expects the LLM to hallucinate the URL, which is exactly the kind of silent fail the state guard above prevents.

```bash
# Read URL from tracking.json (set by /qualia-handoff or previous ship), or
# let the operator pass it as an argument. Never assume a placeholder.
URL=$(node -e "try{const t=JSON.parse(require('fs').readFileSync('.planning/tracking.json','utf8'));process.stdout.write(t.deployed_url||'')}catch{}")
if [ -z "$URL" ]; then
  node ~/.claude/bin/qualia-ui.js warn "No deployed_url in tracking.json — parse it from the deploy command output (vercel/supabase/wrangler all print the URL on success)."
  node ~/.claude/bin/qualia-ui.js info "Re-run with: /qualia-ship --url https://your-site.com"
  exit 1
fi

# HTTP 200 + latency under 500ms (combined)
RESP=$(curl -sS -o /dev/null -w "%{http_code} %{time_total}" --max-time 15 "$URL")
HTTP_CODE=$(echo "$RESP" | awk '{print $1}')
LATENCY=$(echo "$RESP" | awk '{print $2}')

if [ "$HTTP_CODE" != "200" ]; then
  node ~/.claude/bin/qualia-ui.js fail "Post-deploy check failed: HTTP $HTTP_CODE at $URL"
  exit 1
fi

# Auth endpoint (best-effort — not every project has one)
AUTH_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$URL/api/auth/callback" 2>/dev/null)
```

### 6. Report

```bash
node ~/.claude/bin/qualia-ui.js divider
node ~/.claude/bin/qualia-ui.js ok "URL: $URL"
node ~/.claude/bin/qualia-ui.js ok "Status: HTTP $HTTP_CODE"
node ~/.claude/bin/qualia-ui.js ok "Latency: ${LATENCY}s"
[ "$AUTH_CODE" = "200" ] || [ "$AUTH_CODE" = "401" ] && node ~/.claude/bin/qualia-ui.js ok "Auth endpoint responds (HTTP $AUTH_CODE)"
```

```bash
node ~/.claude/bin/state.js transition --to shipped --deployed-url "$URL"
```
Do NOT manually edit STATE.md or tracking.json — state.js handles both.

```bash
node ~/.claude/bin/qualia-ui.js end "SHIPPED" "/qualia-handoff"
```
