---
name: qualia-ship
description: "Deploy to production — quality gates, commit, push, deploy, verify. Use when ready to go live."
---

# /qualia-ship — Deploy

Full deployment pipeline with quality gates.

## Process

```
◆ QUALIA ► SHIPPING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

### 2. Security Check

```bash
# service_role in client code?
grep -r "service_role" app/ components/ src/ 2>/dev/null | grep -v node_modules | grep -v ".server."
# Should be ZERO matches
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

```bash
# HTTP 200
curl -s -o /dev/null -w "%{http_code}" {domain}

# Latency under 500ms
curl -s -o /dev/null -w "%{time_total}" {domain}

# Auth endpoint responds
curl -s -o /dev/null -w "%{http_code}" {domain}/api/auth/callback
```

### 6. Report

```
◆ QUALIA ► SHIPPED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  URL      {production url}
  Status   HTTP 200 ✓
  Latency  {time}ms ✓
  Auth     ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Update STATE.md: "shipped"
Update tracking.json: status → "shipped", deployed_url

```
  → Run: /qualia-handoff
```
