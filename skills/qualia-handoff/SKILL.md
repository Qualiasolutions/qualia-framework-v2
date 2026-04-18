---
name: qualia-handoff
description: "Client delivery — produces the 4 mandatory Handoff deliverables (production URL, documentation, client assets archive, ERP finalization). Triggered at the end of the Handoff milestone."
---

# /qualia-handoff — Client Delivery

Finishes a project by producing the 4 mandatory Handoff deliverables defined in `JOURNEY.md`'s Handoff milestone. Every Qualia client project ends with this skill.

## When to Use

- After `/qualia-ship` on the final phase of the Handoff milestone
- Invoked automatically at the end of `/qualia-new --auto` chain
- Can also be run manually if the project deviated from auto mode

## The 4 Deliverables

Every Handoff milestone must produce these. They are checked against in `REQUIREMENTS.md` as `HAND-10..HAND-15`.

1. **Production URL verified** — HTTP 200, auth flow, latency under 500ms
2. **Documentation** — README with architecture, setup, API docs
3. **Client Assets** — `.planning/archive/` contains every milestone's verification reports + credentials doc + recorded walkthrough
4. **ERP Finalization** — final `/qualia-report` with `lifetime.milestones_completed` incremented

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner handoff
```

### 1. Verify Production URL (Deliverable 1)

```bash
URL=$(node -e "const t=JSON.parse(require('fs').readFileSync('.planning/tracking.json','utf8'));console.log(t.deployed_url||'')")
if [ -z "$URL" ]; then
  node ~/.claude/bin/qualia-ui.js fail "No deployed_url — run /qualia-ship first"
  exit 1
fi
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
LATENCY=$(curl -s -o /dev/null -w "%{time_total}" "$URL")
AUTH=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/auth/callback" 2>/dev/null || echo "N/A")
node ~/.claude/bin/qualia-ui.js ok "URL: $URL (HTTP $HTTP, ${LATENCY}s, auth:$AUTH)"
```

If HTTP is not 2xx or latency > 1.0s → halt; deliverable fails.

### 2. Update Documentation (Deliverable 2)

Ensure the repo's `README.md` has:
- **Overview** — what the project does
- **Architecture** — stack summary, key services (Supabase / Vercel / third-party)
- **Setup** — how to run locally (clone, env, `npm install`, `npm run dev`)
- **Env vars** — list from `.env.local.example` (mask values)
- **Deploy** — "Production deploys via `vercel --prod`. GitHub auto-deploy is DISABLED."
- **Support** — contact: Fawzi Goussous, fawzi@qualiasolutions.net

If README is stale or missing sections, update it and commit.

### 3. Generate Handover Doc + Archive (Deliverable 3)

Create `.planning/HANDOFF.md`:

```markdown
# {Project Name} — Handover

## What Was Built
{3-5 bullet summary of delivered features, pulled from JOURNEY.md milestone exit criteria}

## Access
- **URL:** {production URL}
- **Admin login:** {credentials doc location — typically `.planning/credentials.md` (git-ignored)}
- **Supabase:** {project ref}
- **GitHub:** {repo URL}
- **Vercel:** {project URL}
- **Walkthrough:** {Loom or video link — recorded demo of primary flows}

## How to Use
{Brief walkthrough of the main user flows}

## Known Limitations
{Anything not in scope or deferred, copied from REQUIREMENTS.md Out of Scope + Post-Handoff v2}

## Maintenance
- Hosting: Vercel (MANUAL deploys via `vercel --prod`)
- Database: Supabase ({region})
- Domain: {domain provider if applicable}
- Monitoring: UptimeRobot status page https://stats.uptimerobot.com/bKudHy1pLs

## Milestones Shipped
{Summary pulled from tracking.json milestones[] — one line per closed milestone with date and phase count}

## Support
Contact: Fawzi Goussous — fawzi@qualiasolutions.net
Standard support window: 30 days post-handoff.
```

Also ensure `.planning/archive/` contains every milestone's phase verification reports (qualia-milestone moves them there on close — verify they're present).

```bash
ls -la .planning/archive/ 2>/dev/null
```

If `.planning/archive/` is empty, something went wrong — milestones should have been archived on close. Investigate and recover from git history if needed.

### 4. Commit + Push

```bash
git add .planning/HANDOFF.md README.md
git commit -m "docs: client handoff — {project name}"
git push
```

### 5. Update State

```bash
node ~/.claude/bin/state.js transition --to handed_off
```

Do NOT manually edit STATE.md or tracking.json — state.js handles both.

### 6. ERP Finalization (Deliverable 4)

Trigger the final `/qualia-report`. This uploads the closing state to the ERP with `lifetime.milestones_completed` incremented by the Handoff close that just happened.

In `--auto` mode, inline-invoke `/qualia-report` now. In guided mode, show the next step:

```bash
node ~/.claude/bin/qualia-ui.js ok "Production URL verified"
node ~/.claude/bin/qualia-ui.js ok "Documentation updated"
node ~/.claude/bin/qualia-ui.js ok "Client assets archived + handoff doc written"
node ~/.claude/bin/qualia-ui.js ok "Ready for final ERP report"
node ~/.claude/bin/qualia-ui.js end "DELIVERED" "/qualia-report"
```

## Rules

1. **No handoff without verified production URL.** Step 1 halts if URL is down or latency > 1s.
2. **Archive is mandatory.** `.planning/archive/` must contain every closed milestone's phase artifacts. If empty, the project was handled outside the framework — recover from git history.
3. **README is the public face.** If it's stale, fix it before handoff. Client reads it first.
4. **Credentials never in the repo.** `.planning/credentials.md` is git-ignored. Deliver credentials via secure channel (1Password shared vault, encrypted email).
5. **Support clause is 30 days by default.** If the client contract says otherwise, override it in HANDOFF.md.
