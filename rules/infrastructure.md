---
globs: ["*.env*", "vercel.json", "next.config.*", "supabase/**", "railway.*"]
---

# Infrastructure & Services

Standard services across all Qualia projects. Use these unless the project explicitly specifies otherwise.

## Database: Supabase (every project)
- Every project uses Supabase for auth, database, and storage
- **CLI:** `npx supabase` — migrations, type generation, local dev
- **MCP:** Supabase MCP server is available in Claude Code for direct database operations
- Always enable RLS on every table (see `rules/security.md`)
- Use `lib/supabase/server.ts` for server-side, `lib/supabase/client.ts` for client-side
- Run `npx supabase gen types` after schema changes
- Migrations go in `supabase/migrations/` — never edit production directly

## AI Models: OpenRouter (every project)
- Use OpenRouter API for all LLM calls — it routes to the best-suited model per task
- API key env var: `OPENROUTER_API_KEY`
- Don't have a key? Ask Fawzi for one
- Never hardcode a specific model provider (OpenAI, Anthropic, etc.) directly — always go through OpenRouter
- Exception: if a client specifically requires a direct provider integration

## Voice AI: Retell AI + ElevenLabs
- **Retell AI** — primary voice agent platform. API key: `RETELL_API_KEY`
- **ElevenLabs** — voice synthesis, cloning, streaming. API key: `ELEVENLABS_API_KEY`
- **Telnyx** — telephony/SIP for voice agent phone numbers. API key: `TELNYX_API_KEY`
- For new voice projects, default to Retell AI + ElevenLabs unless client specifies otherwise

## Compute: Vercel + Railway
- **Vercel** — primary hosting for all Next.js projects. Deploy via CLI only (see below)
- **Railway** — secondary compute for long-running agents, background jobs, and agentic workloads that exceed Vercel's function timeout
- **Railway CLI:** `railway` — deploy, logs, env management
- **Railway MCP:** Railway MCP server is available in Claude Code for project management
- Railway projects use Nixpacks (auto-detected) — check for `railway.json` or `railway.toml`

## MCP Servers (available in Claude Code)
- **Supabase MCP** — database queries, table management, migrations from within Claude Code
- **Railway MCP** — project deployment, logs, environment variables from within Claude Code
- **next-devtools MCP** — runtime error visibility for Next.js 16+ dev servers (optional, added by framework install)

## CLIs (must be installed)
- `npx supabase` — Supabase CLI (database, migrations, types)
- `railway` — Railway CLI (deploy, logs, env)
- `vercel` — Vercel CLI (deploy, env, link)
- `gh` — GitHub CLI (PRs, issues, repos)

## GitHub Organizations
- **QualiasolutionsCY** — primary org for all Qualia Solutions projects
- **SakaniQualia** — org for Sakani-related projects (real estate platform)
- All repos are private by default
- Branch protection: main/master require PR reviews (enforced by framework guards)

## Vercel Teams (admin knowledge)
- Qualia operates across **3 Vercel teams** — projects are distributed across them
- Check which team a project belongs to before deploying: `vercel whoami` and `vercel link`
- If a project isn't linked, link it first: `vercel link`

## Deployment Rules
- **NO auto-deploys from GitHub pushes** — all Vercel projects have GitHub integration auto-deploy DISABLED
- Deploys happen ONLY via `vercel --prod` through the CLI (or `/qualia-ship`)
- This is intentional — we control when things go live, not git push triggers
- If you find a project with auto-deploy enabled, disable it: Vercel Dashboard → Project Settings → Git → Disable "Automatic Deployments"

## Required Environment Variables (typical project)

```bash
# Supabase (every project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # NEVER in client code

# AI (if applicable)
OPENROUTER_API_KEY=                 # ask Fawzi if you don't have one

# Voice (if applicable)
RETELL_API_KEY=
ELEVENLABS_API_KEY=
TELNYX_API_KEY=

# Deployment
VERCEL_ORG_ID=                      # from vercel link
VERCEL_PROJECT_ID=                  # from vercel link
```

Always use `vercel env pull` to sync env vars locally. Never create `.env` manually from scratch.
