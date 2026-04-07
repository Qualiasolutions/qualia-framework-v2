---
globs: ["vercel.json", "next.config.*", "wrangler.*", "Dockerfile"]
---

# Deployment (MANDATORY - Every Project)

When work on a project is **done**, ALWAYS execute these steps in order:

## 1. Push to GitHub
Commit and push all changes to the remote repository.

## 2. Redeploy to Vercel
Deploy through the Vercel CLI (`vercel --prod`) or project-appropriate method (e.g., `wrangler deploy` for Cloudflare Workers).

## 3. Verify Supabase
Confirm Supabase is configured correctly via CLI or Management API (check tables, RLS, migrations are applied).

## 4. Post-Deploy Verification Checklist

After deployment, verify all 5 checks pass:

- [ ] **HTTP 200** — Homepage loads successfully (`curl -s -o /dev/null -w "%{http_code}" <url>` returns 200)
- [ ] **Auth flow** — Login/signup endpoint responds correctly (test auth callback URL)
- [ ] **Console errors** — No critical JS errors in browser console on homepage load
- [ ] **API latency** — Key API endpoints respond under 500ms (`curl -w "%{time_total}" <api-url>`)
- [ ] **UptimeRobot** — Verify monitor shows UP on https://stats.uptimerobot.com/bKudHy1pLs

If any check fails, investigate and fix before considering deployment complete.

This applies to **every project, every time**. No exceptions. Don't ask — just do it.
