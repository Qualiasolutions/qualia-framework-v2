---
name: qualia-optimize
description: "Deep optimization pass — reads .planning/ AND codebase to find performance, design, UI, backend, and frontend issues. Spawns parallel specialist agents. Use this skill whenever the user says 'optimize', 'optimization pass', 'find issues', 'qualia-optimize', 'deep optimize', 'performance audit', 'design alignment check', 'speed up', 'slow', 'bundle size', or wants a comprehensive quality sweep. Supports --perf, --ui, --backend, --alignment, --fix flags."
---

# Qualia Optimize — Deep Codebase + Planning Optimization

Comprehensive optimization that reads BOTH `.planning/` docs AND the actual codebase. Never analyze one without the other.

## Usage

- `/qualia-optimize` — Full optimization (all 6 dimensions)
- `/qualia-optimize --perf` — Performance only (queries, bundle, render, latency)
- `/qualia-optimize --ui` — Frontend/design/UI only
- `/qualia-optimize --backend` — Backend only (RLS, auth, queries, edge functions)
- `/qualia-optimize --alignment` — Planning-code alignment check only
- `/qualia-optimize --fix` — Auto-fix LOW/MEDIUM findings from existing OPTIMIZE.md

## Process

### Step 1: Parse Arguments

Extract mode from $ARGUMENTS. Default to `full`.

Supported modes: `full`, `perf`, `ui`, `backend`, `alignment`, `fix`.

If `--fix`: skip to Step 9 (requires existing `.planning/OPTIMIZE.md`).

### Step 2: Load Planning Context (MANDATORY — never skip)

Read ALL of these (skip silently if file doesn't exist, but always attempt):

```bash
cat .planning/PROJECT.md 2>/dev/null || echo "NO_PROJECT"
```

```bash
cat .planning/REQUIREMENTS.md 2>/dev/null || echo "NO_REQUIREMENTS"
```

```bash
cat .planning/ROADMAP.md 2>/dev/null || echo "NO_ROADMAP"
```

```bash
cat .planning/STATE.md 2>/dev/null || echo "NO_STATE"
```

```bash
cat .planning/DESIGN.md 2>/dev/null || echo "NO_DESIGN"
```

Also read the rules:
```bash
cat ~/.claude/rules/frontend.md 2>/dev/null
cat ~/.claude/rules/security.md 2>/dev/null
```

Store all content — you will inline it into agent prompts.

**If NO planning docs exist at all**: warn the user but proceed. The optimization still works on raw codebase — it just can't check alignment.

### Step 3: Discover Codebase

```bash
pwd && node -e "try{const p=require('./package.json');console.log(JSON.stringify({name:p.name,deps:Object.keys(p.dependencies||{}),devDeps:Object.keys(p.devDependencies||{})}))}catch(e){console.log('{}')}" 2>/dev/null
```

```bash
git log --oneline -15 2>/dev/null
```

```bash
git diff --stat HEAD~10..HEAD 2>/dev/null | tail -5
```

```bash
# Project structure
ls -d app/ src/ pages/ components/ lib/ actions/ hooks/ supabase/ types/ 2>/dev/null
```

Classify project type: `web` | `voice` | `mobile` | `agent` | `edge-functions` | `unknown`

### Step 4: Spawn Wave 1 Agents (parallel)

Based on mode, spawn agents in a **single message** with multiple Agent() calls.

| Mode | Agents |
|------|--------|
| `full` | frontend-agent + backend-agent + performance-oracle (3 parallel) |
| `perf` | performance-oracle only |
| `ui` | frontend-agent only |
| `backend` | backend-agent only |
| `alignment` | general-purpose with alignment prompt |

**CRITICAL**: Inline ALL planning context into each agent prompt. `@` references don't work across Agent() boundaries.

#### Frontend Agent Prompt

```
Agent(
  prompt="You are optimizing a project's frontend. Read the planning docs and codebase rules below, then analyze the actual code.

<planning>
{PROJECT.md content}
{REQUIREMENTS.md content}
{DESIGN.md content}
</planning>

<rules>
{rules/frontend.md content}
</rules>

<task>
Analyze the frontend codebase for issues in these categories:

1. **UI Quality**
   - Loading states: every async operation should show a loading indicator
   - Error states: every data-fetching component should handle errors gracefully
   - Empty states: lists/tables should handle zero items with helpful messaging
   - Responsive: check for fixed pixel widths on containers, missing breakpoint handling
   - Accessibility: alt text on images, ARIA labels on interactive elements, keyboard navigation

2. **Design Alignment**
   - Compare actual components against DESIGN.md decisions (colors, typography, spacing)
   - Check rules/frontend.md compliance: distinctive fonts? sharp accents? transitions? No card grids or blue-purple gradients?
   - Consistency: are the same patterns used throughout? (button styles, spacing, color usage)

3. **Frontend Performance**
   - Bundle: large library imports that could be tree-shaken or dynamically imported
   - Images: using next/image? width/height set? lazy loading below fold?
   - Fonts: using next/font? No render-blocking font loads?
   - CSS: unused Tailwind classes? conflicting styles?
   - Rendering: unnecessary re-renders, missing React.memo on list items, heavy computations in render

For EVERY finding, output in this exact format:
- **What**: [description]
- **Where**: [file:line]
- **Why**: [impact on users/performance]
- **Fix**: [concrete fix suggestion]
- **Severity**: CRITICAL | HIGH | MEDIUM | LOW
</task>",
  subagent_type="frontend-agent",
  description="Frontend optimization analysis"
)
```

#### Backend Agent Prompt

```
Agent(
  prompt="You are optimizing a project's backend. Read the planning docs and security rules below, then analyze the actual code.

<planning>
{PROJECT.md content}
{REQUIREMENTS.md content}
</planning>

<rules>
{rules/security.md content}
</rules>

<task>
Analyze the backend codebase for issues:

1. **Security**
   - RLS: every Supabase table must have ROW LEVEL SECURITY enabled with policies
   - Service role: grep for service_role key usage in client-side code (app/, components/, src/) — should be ZERO
   - Auth: all mutations use server-side auth check (supabase.auth.getUser())
   - Validation: input validated with Zod before database operations
   - No dangerouslySetInnerHTML or eval()

2. **Data Access Patterns**
   - Server actions vs client mutations: data writes should use 'use server' actions, not direct Supabase client calls
   - Proper error handling: try/catch with meaningful error messages
   - Revalidation: revalidatePath/revalidateTag after mutations

3. **Edge Functions** (if supabase/functions/ exists)
   - Cold start optimization: bundle size, dependency count
   - Error handling and logging
   - CORS configuration
   - Timeout protection (maxDuration)

4. **API Quality**
   - Rate limiting on public endpoints
   - Proper HTTP status codes
   - Consistent error response format

For EVERY finding, output:
- **What**: [description]
- **Where**: [file:line]
- **Why**: [impact]
- **Fix**: [concrete suggestion]
- **Severity**: CRITICAL | HIGH | MEDIUM | LOW
</task>",
  subagent_type="backend-agent",
  description="Backend optimization analysis"
)
```

#### Performance Oracle Prompt

```
Agent(
  prompt="You are analyzing cross-cutting performance issues. Read the project context, then analyze the codebase.

<planning>
{PROJECT.md content}
</planning>

<task>
Analyze for performance issues across the full stack:

1. **Database Queries**
   - N+1 queries: Supabase .from() calls inside loops or .map()
   - Missing indexes: .eq()/.filter()/.order() columns without corresponding indexes in migrations
   - Sequential queries that could be parallel (Promise.all)
   - Over-fetching: SELECT * when only specific columns needed

2. **API Latency**
   - Sequential API calls from client that could be batched
   - Missing caching (SWR/React Query stale times, HTTP cache headers)
   - Large payloads without pagination

3. **Bundle Size**
   - Barrel exports (index.ts re-exporting everything) preventing tree-shaking
   - Large libraries imported for single functions (lodash, moment)
   - Missing dynamic imports for heavy components (charts, editors, maps)

4. **Render Performance**
   - Expensive computations in render path without useMemo
   - Event handlers recreated on every render without useCallback
   - Large lists without virtualization
   - Context providers causing unnecessary re-renders

For EVERY finding, output:
- **What**: [description]
- **Where**: [file:line]
- **Why**: [performance impact, quantified if possible]
- **Fix**: [concrete suggestion]
- **Severity**: CRITICAL | HIGH | MEDIUM | LOW
</task>",
  subagent_type="performance-oracle",
  description="Performance optimization analysis"
)
```

### Step 5: Spawn Wave 2 Agent (after Wave 1 completes)

After all Wave 1 agents return, spawn the architecture strategist with their combined findings:

```
Agent(
  prompt="You are synthesizing optimization findings from 3 specialist agents. Look for cross-cutting architectural issues.

<wave1_findings>
{All findings from frontend-agent, backend-agent, performance-oracle}
</wave1_findings>

<planning>
{PROJECT.md content}
{REQUIREMENTS.md content}
</planning>

<task>
1. Identify patterns across findings — recurring issues that point to a structural problem
2. Find coupling issues between frontend and backend
3. Check for inconsistent patterns (e.g., some routes use server actions, others use API routes)
4. Identify missing abstractions (same pattern repeated 3+ times)
5. Check for dead code and unused exports

Output:
- **Structural findings** (architectural issues, not covered by Wave 1)
- **Pattern consolidation** (where Wave 1 findings share a root cause)
- Each finding in the same format: What/Where/Why/Fix/Severity
</task>",
  subagent_type="architecture-strategist",
  description="Architecture synthesis"
)
```

**Skip Wave 2 for single-mode runs** (`--perf`, `--ui`, `--backend`). Only run for `full` mode.

### Step 6: Alignment Check (always runs in `full` and `alignment` modes)

For `alignment` mode, this is the sole analysis. For `full` mode, run alongside Wave 1.

Read REQUIREMENTS.md and ROADMAP.md. For each requirement marked "Complete" or mapped to a completed phase:

```bash
# Find completed requirements
grep -E "Complete|✓" .planning/REQUIREMENTS.md 2>/dev/null
```

For each completed requirement:
- Grep the codebase for evidence it actually exists (routes, components, API endpoints)
- If not found: flag as "Claimed complete but not implemented"

Then scan for orphan features:
```bash
# Find all routes/pages
find app -name "page.tsx" -o -name "route.ts" 2>/dev/null
# Find all API routes
find app/api -name "route.ts" 2>/dev/null
```

Cross-reference with REQUIREMENTS.md — any route/feature NOT in requirements is flagged as "Undocumented feature".

### Step 7: Collect and Score Findings

After all agents return:
1. Deduplicate (same file:line from multiple agents → keep the most detailed one)
2. Sort by severity: CRITICAL first
3. Group by dimension: Performance, Design Alignment, UI Quality, Backend, Frontend, Planning-Code Alignment, Architecture

Count totals per severity.

### Step 8: Write OPTIMIZE.md and Present Results

Write to `.planning/OPTIMIZE.md`:

```markdown
---
date: {YYYY-MM-DD HH:MM}
mode: {full|perf|ui|backend|alignment}
critical: {N}
high: {N}
medium: {N}
low: {N}
status: {clean|needs_attention|critical_issues}
---

# Optimization Report

**Project:** {name} | **Mode:** {mode} | **Date:** {date}

## Summary

{2-3 sentence overview}

{If status is clean: "No critical issues found. Project is in good shape."}

## Critical Issues

| # | Dimension | Finding | Location | Fix |
|---|-----------|---------|----------|-----|
{findings}

## High Priority

| # | Dimension | Finding | Location | Fix |
|---|-----------|---------|----------|-----|
{findings}

## Medium Priority

| # | Dimension | Finding | Location | Fix |
|---|-----------|---------|----------|-----|
{findings}

## Low Priority

| # | Dimension | Finding | Location | Fix |
|---|-----------|---------|----------|-----|
{findings}
```

Commit:
```bash
node ~/.claude/qualia-framework/bin/qualia-tools.js commit "docs: optimization report ({mode} mode, {critical} critical)" --files .planning/OPTIMIZE.md
```

**Present results:**

If CRITICAL findings exist:
```
{critical} critical issues found. Options:

1. Create a fix phase in ROADMAP.md for critical + high findings
2. Auto-fix LOW/MEDIUM findings: /qualia-optimize --fix
3. Review full report: cat .planning/OPTIMIZE.md
```

If no CRITICAL:
```
Optimization complete. {total} findings ({high} high, {medium} medium, {low} low).
Report: .planning/OPTIMIZE.md

Run /qualia-optimize --fix to auto-fix LOW/MEDIUM findings.
```

### Step 9: --fix Mode

When `--fix` is provided:

1. Read existing `.planning/OPTIMIZE.md` — if not found, error: "Run /qualia-optimize first"
2. Filter to LOW and MEDIUM findings only
3. For each finding with a clear, safe fix:
   - Read the target file
   - Apply the fix
   - Verify it doesn't break (npx tsc --noEmit if TypeScript)
4. Update OPTIMIZE.md: mark fixed findings, recount severities
5. Commit changes
6. Report what was fixed and what remains

**Never auto-fix CRITICAL or HIGH** — those require human judgment.

### Step 10: Gap Phase Creation (if user selects option 1 from Step 8)

If user wants a fix phase for critical issues:

1. Read ROADMAP.md, find current phase number
2. Insert a decimal phase: `Phase {N}.1: Optimization Fixes (INSERTED)`
3. Map CRITICAL and HIGH findings as success criteria
4. Update STATE.md
5. Commit
6. Suggest: "Fix phase created. Run `/qualia-plan {N}.1`"
