---
name: qualia-handoff
description: "Client delivery — credentials, handover doc, final update. Use after shipping."
---

# /qualia-handoff — Client Delivery

Prepare and deliver the finished project to the client.

## Process

```
◆ QUALIA ► HANDOFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 1. Generate Handover Doc

Create `.planning/HANDOFF.md`:

```markdown
# {Project Name} — Handover

## What Was Built
{3-5 bullet summary of delivered features}

## Access
- **URL:** {production URL}
- **Admin login:** {credentials or where to find them}
- **Supabase:** {project ref}
- **GitHub:** {repo URL}
- **Vercel:** {project URL}

## How to Use
{Brief walkthrough of the main user flows}

## Known Limitations
{Anything not in scope or deferred}

## Maintenance
- Hosting: Vercel (auto-deploys from main branch)
- Database: Supabase ({region})
- Domain: {domain provider if applicable}

## Support
Contact: Fawzi Goussous — fawzi@qualiasolutions.net
```

### 2. Commit

```bash
git add .planning/HANDOFF.md
git commit -m "docs: client handoff document"
git push
```

### 3. Update State

Update STATE.md: "handed off"
Update tracking.json: status → "handed_off"

```
◆ QUALIA ► DELIVERED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {Project Name} handed off to {client}.
  Don't forget: /qualia-report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
