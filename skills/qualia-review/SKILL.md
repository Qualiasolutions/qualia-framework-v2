---
name: qualia-review
description: "Production audit and code review. General review, --web for web app audit, --ai for AI/voice agent audit. Trigger on 'review', 'audit', 'code review', 'security check', 'production check'."
---

# /qualia-review — Production Audit

Deep review with severity-scored findings. Different from `/qualia-verify` (which checks phase goals). This checks production readiness.

## Usage

- `/qualia-review` — General code review
- `/qualia-review --web` — Web app production audit
- `/qualia-review --ai` — AI/voice agent audit

## General Review (default)

Spawn parallel agents analyzing:

1. **Code Quality** — Clean code, TypeScript strictness, naming, readability
2. **Security** — OWASP top 10, auth server-side, RLS policies, secrets scan
3. **Architecture** — Component boundaries, coupling, API contracts
4. **Performance** — N+1 queries, bundle size, caching, render performance
5. **Test Coverage** — Gaps, edge cases, test quality

## --web (Web App Audit)

Full production readiness for Next.js + Supabase + Vercel:

**Security:** No secrets in code, HTTPS, CORS restricted, CSP headers, rate limiting, npm audit clean.

**Performance:** Core Web Vitals (LCP < 2.5s, CLS < 0.1), image optimization, bundle analysis, query performance.

**Reliability:** Error boundaries, API error handling, graceful degradation, health check endpoint.

**Observability:** Error tracking (Sentry), structured logging, uptime monitoring, analytics.

## --ai (AI/Voice Agent Audit)

Auto-detect stack (VAPI, ElevenLabs, Retell, OpenAI, Anthropic, pgvector).

**Prompt Safety:** System prompts not exposed, injection defenses, no eval() on AI output, token limits.

**Conversation Flow:** Off-topic handling, context window management, error recovery, human handoff.

**Voice (if detected):** Latency < 500ms, interruption handling, silence timeout, webhook security.

**RAG (if detected):** Embedding consistency, chunk size, retrieval relevance, index refresh.

**Resilience:** Provider failover, timeout handling, cost monitoring, streaming error recovery.

## Output

Every finding:
- **What** — description
- **Where** — `file:line`
- **Fix** — concrete suggestion
- **Severity** — CRITICAL / HIGH / MEDIUM / LOW

Write to `.planning/REVIEW.md`. CRITICAL or HIGH findings are deploy blockers — `/qualia-ship` checks for them.

```
◆ Review Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Critical:  {N}
  High:      {N}
  Medium:    {N}
  Low:       {N}

  {If blockers: Fix CRITICAL/HIGH before /qualia-ship}
  {If clean: Ready to ship}
```
