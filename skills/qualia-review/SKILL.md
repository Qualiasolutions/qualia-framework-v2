---
name: qualia-review
description: "Production audit with scored diagnostics. Runs real commands, scores findings by severity. Trigger on 'review', 'audit', 'code review', 'security check', 'production check'."
---

# /qualia-review — Production Audit

Runs real diagnostic commands and scores every finding. Not a checklist — an executable audit.

## Usage

- `/qualia-review` — Full audit (security + quality + performance)
- `/qualia-review --web` — Adds web-specific checks (headers, CORS, vitals)
- `/qualia-review --ai` — Adds AI/voice agent checks (prompt safety, latency)

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner review
```

### 0. Load Context

```bash
cat ~/.claude/knowledge/common-fixes.md 2>/dev/null
cat ~/.claude/knowledge/learned-patterns.md 2>/dev/null
```

Detect project shape:
```bash
ls package.json next.config.* tsconfig.json supabase/ app/ src/ 2>/dev/null
```

### 1. Security Scan

Run every command. Record each finding with severity.

```bash
# CRITICAL: service_role in client code
grep -rn "service_role" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | grep -v "\.server\.\|[\\/]server[\\/]\|[\\/]app[\\/]api[\\/]\|route\.\|middleware\."

# CRITICAL: hardcoded secrets
grep -rn "sk_live\|sk_test\|SUPABASE_SERVICE_ROLE\|eyJhbGciOi" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | grep -v "\.env"

# CRITICAL: dangerous patterns
grep -rn "dangerouslySetInnerHTML\|eval(" --include="*.ts" --include="*.tsx" --include="*.js" app/ components/ src/ 2>/dev/null | grep -v node_modules

# CRITICAL: .env files tracked in git
git ls-files | grep -i "\.env" | grep -v "\.example\|\.template\|\.sample"

# HIGH: API routes without auth
for f in $(find app/api -name "route.ts" -o -name "route.js" 2>/dev/null); do
  grep -qL "getUser\|getSession\|auth()\|createClient" "$f" && echo "UNPROTECTED: $f"
done

# HIGH: API routes without input validation
for f in $(find app/api -name "route.ts" -o -name "route.js" 2>/dev/null); do
  grep -L "z\.\|zod\|Zod\|parse\|safeParse" "$f" 2>/dev/null
done

# HIGH: client-side database mutations
grep -rn "\.insert\|\.update\|\.delete\|\.upsert" --include="*.tsx" --include="*.jsx" app/ components/ 2>/dev/null | grep -v "use server" | grep -v "\.server\."

# MEDIUM: npm vulnerabilities
npm audit --json 2>/dev/null | node -e "try{const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=d.metadata?.vulnerabilities||{};console.log('critical:',v.critical||0,'high:',v.high||0,'moderate:',v.moderate||0)}catch{console.log('audit unavailable')}"
```

### 2. Code Quality Scan

```bash
# TypeScript errors (HIGH if >0)
npx tsc --noEmit 2>&1 | grep -c "error TS"

# 'any' type usage (MEDIUM — count)
grep -rn ": any\| as any" --include="*.ts" --include="*.tsx" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | wc -l

# Empty catch blocks (HIGH)
grep -rn "catch\s*{}\|catch\s*(.*)\s*{\s*}" --include="*.ts" --include="*.tsx" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | head -10

# TODO/FIXME left in code (LOW — count)
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" app/ components/ src/ lib/ 2>/dev/null | grep -v node_modules | wc -l

# console.log in production code (LOW — count)
grep -rn "console\.log" --include="*.ts" --include="*.tsx" app/ components/ src/ 2>/dev/null | grep -v node_modules | wc -l
```

### 3. Performance Scan

```bash
# Build output — route sizes and first load JS
npx next build 2>&1 | grep -E "Route|First Load|shared by all|○|●|ƒ|λ" | tail -25

# Heavy files (>300 lines often means split needed)
find app/ components/ src/ -name "*.tsx" -o -name "*.ts" 2>/dev/null | xargs wc -l 2>/dev/null | sort -rn | head -10

# Missing next/image (MEDIUM)
grep -rn "<img " --include="*.tsx" --include="*.jsx" app/ components/ src/ 2>/dev/null | grep -v "next/image" | wc -l

# Client component ratio
echo "use client: $(grep -rl "'use client'" --include="*.tsx" app/ components/ src/ 2>/dev/null | wc -l)"
echo "total tsx: $(find app/ components/ src/ -name '*.tsx' 2>/dev/null | wc -l)"

# Sequential data fetching (HIGH)
grep -rn "const.*=.*await" --include="*.tsx" --include="*.ts" app/ src/ 2>/dev/null | grep -v "Promise.all\|Promise.allSettled" | head -10
```

### 4. Score and Report

Write to `.planning/REVIEW.md`:

```markdown
# Production Review — {YYYY-MM-DD}

## Summary
| Category | Critical | High | Medium | Low | Score |
|----------|----------|------|--------|-----|-------|
| Security | {n} | {n} | {n} | {n} | {1-5} |
| Quality  | {n} | {n} | {n} | {n} | {1-5} |
| Perf     | {n} | {n} | {n} | {n} | {1-5} |
| **Total** | {n} | {n} | {n} | {n} | **{avg}/5** |

## Findings

### CRITICAL
- **{title}** — `{file}:{line}` — {what's wrong} — Fix: {how}

### HIGH
- ...

### MEDIUM
- ...

### LOW
- ...

## Verdict
{PASS: no critical/high | FAIL: N blockers — fix before /qualia-ship}
```

**Scoring:**
- 5 = zero high/critical, fewer than 3 medium
- 4 = zero critical, 1 high or fewer than 5 medium
- 3 = zero critical, 2-3 high
- 2 = 1 critical or 4+ high
- 1 = multiple critical

```bash
node ~/.claude/bin/qualia-ui.js divider
node ~/.claude/bin/qualia-ui.js info "Security: {score}/5 ({n} findings)"
node ~/.claude/bin/qualia-ui.js info "Quality:  {score}/5 ({n} findings)"
node ~/.claude/bin/qualia-ui.js info "Perf:     {score}/5 ({n} findings)"
node ~/.claude/bin/qualia-ui.js end "REVIEW: {PASS|FAIL}" "{next command}"
```

## Rules

1. **Run every command.** Don't skip scans because "the code looks clean."
2. **Every finding gets a severity.** No prose — CRITICAL/HIGH/MEDIUM/LOW.
3. **Every finding gets a fix suggestion.** Not just "this is bad" — say what to do.
4. **Review detects. It does NOT fix.** This is an audit, not a refactor. Tell the user what to fix.
5. **CRITICAL or HIGH = deploy blocker.** `/qualia-ship` checks for these.
