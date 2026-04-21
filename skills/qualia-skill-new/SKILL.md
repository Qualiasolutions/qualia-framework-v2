---
name: qualia-skill-new
description: "Author a new Qualia skill or agent. Use when the user says 'create a new skill', 'add a skill', 'I want to build a skill', 'make this a reusable command', 'turn this into a skill'. Generates the SKILL.md, registers it in the right location, and optionally ships to the framework repo."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

# /qualia-skill-new — Author a New Skill

You are about to create a reusable slash command. Skills are the leverage of the Qualia framework — if the team does something twice, it probably belongs here.

## Process

```bash
node ~/.claude/bin/qualia-ui.js banner skill-new
```

### 1. Scope Decision

Ask the user with AskUserQuestion:

```
question: "Where should this skill live?"
header: "Scope"
options:
  - label: "Framework skill (ships to the team)"
    description: "Edit qualia-framework repo. Everyone gets it on next update."
  - label: "Local skill (just me)"
    description: "Lives only in ~/.claude/skills/. Not shared."
  - label: "Agent instead of a skill"
    description: "This is a subagent role, not a slash command. Creates agents/{name}.md."
```

### 1a. Resolve framework directory

If the user chose **Framework skill** or a framework-scoped **Agent**, resolve `${FRAMEWORK_DIR}` — the checkout path of this user's qualia-framework repo — BEFORE computing any target paths. Never hardcode `/home/<user>/...`; different teammates and operating systems have different paths.

```bash
# Priority order: env var → git detection → ask user
FRAMEWORK_DIR="${QUALIA_FRAMEWORK_DIR:-}"
if [ -z "$FRAMEWORK_DIR" ] && git -C . rev-parse --show-toplevel >/dev/null 2>&1; then
  ORIGIN=$(git -C . config --get remote.origin.url 2>/dev/null)
  case "$ORIGIN" in
    *qualia-framework*) FRAMEWORK_DIR=$(git -C . rev-parse --show-toplevel) ;;
  esac
fi
echo "${FRAMEWORK_DIR:-UNRESOLVED}"
```

If the command prints `UNRESOLVED`, ask the user: *"Where is your qualia-framework checkout? (absolute path, or type 'local' to save only to ~/.claude/)"*. If they type `local`, downgrade the scope to Local. Otherwise store the answer as `${FRAMEWORK_DIR}` for the rest of the session.

**Framework** → target: `${FRAMEWORK_DIR}/skills/{name}/SKILL.md`
**Local** → target: `~/.claude/skills/{name}/SKILL.md`
**Agent** → target: `${FRAMEWORK_DIR}/agents/{name}.md` (framework) or `~/.claude/agents/{name}.md` (local)

### 2. Gather Requirements

Ask the user — one question at a time, natural conversation:

1. **"What's the name?"** — kebab-case, prefix with `qualia-` for framework skills. E.g., `qualia-seed-db`.
2. **"What does it do?"** — one sentence, used as the description.
3. **"How does the user invoke it?"** — trigger phrases they'd naturally say. E.g., "seed the database", "load test data", "populate dev db".
4. **"Does it need planning / building / verification?"** — if yes, it probably should spawn an agent. If no, it's a direct-action skill.
5. **"What files does it read or write?"** — tells you what tools to restrict to.

### 3. Read Reference Skills

Before writing, read two existing skills that are structurally similar:

```bash
# Short direct-action skill reference:
cat ~/.claude/skills/qualia-learn/SKILL.md

# Skill-that-spawns-an-agent reference:
cat ~/.claude/skills/qualia-plan/SKILL.md

# Interactive wizard reference:
cat ~/.claude/skills/qualia-new/SKILL.md
```

Pick the closest pattern and copy its structure.

### 4. Write the SKILL.md

Every SKILL.md MUST have:

```markdown
---
name: {kebab-case-name}
description: "{one sentence}. {trigger phrases}"
---

# /{name} — {Human Title}

{one-paragraph explanation}

## Usage

`/{name}` — {default behavior}
`/{name} {arg}` — {with argument}

## Process

### 1. {First Step}
{specifics}

### 2. {Second Step}
{specifics}

### N. Update State (only if this skill changes project state)

```bash
node ~/.claude/bin/state.js transition --to {status} ...
```
Do NOT manually edit STATE.md or tracking.json.
```

**Description field rules:**
- MUST include trigger phrases the user would naturally say
- The Claude Code router matches user messages against descriptions — if you don't list triggers, the skill never fires
- Bad: `"Manages database seeding."` (no triggers)
- Good: `"Seed the database with test data. Trigger on 'seed db', 'load test data', 'populate dev'."`

### 5. Test the Skill

Spawn a fresh subagent to simulate running the skill — does it make sense without the context you have right now?

```
Agent(prompt="
Read this skill: @~/.claude/skills/{name}/SKILL.md

Pretend the user just said '{one of the trigger phrases}'. Walk through what you would do, step by step. Flag anything ambiguous or missing.
", subagent_type="general-purpose", description="Test skill {name}")
```

Fix any ambiguity the test agent found.

### 6. Install (if framework skill)

```bash
# Framework skill — copy to local .claude for immediate testing
mkdir -p ~/.claude/skills/{name}
cp "${FRAMEWORK_DIR}/skills/{name}/SKILL.md" ~/.claude/skills/{name}/SKILL.md

# Verify it parses
node -e "const fs=require('fs');const os=require('os');const path=require('path');const c=fs.readFileSync(path.join(os.homedir(),'.claude/skills/{name}/SKILL.md'),'utf8');if(!c.includes('---'))throw new Error('missing frontmatter');if(!c.match(/^name:\s*\S/m))throw new Error('missing name');if(!c.match(/^description:\s*\S/m))throw new Error('missing description');console.log('OK')"
```

### 7. Commit (framework skills only)

Do NOT commit unless the user explicitly says "commit" or "ship it".

When they do:
```bash
cd "${FRAMEWORK_DIR}"
git add skills/{name}/
git commit -m "feat: add /{name} skill"
```

Remind the user to run `npx qualia-framework@latest update` on their other machines (always pin `@latest` — npx caches aggressively), or bump the version and `npm publish`.

## Anti-Patterns

- ❌ **Description without triggers** — the skill won't fire
- ❌ **Multiple commands in one skill** — split into two skills
- ❌ **Direct file writes instead of state.js** — always use state.js for STATE.md/tracking.json
- ❌ **Hardcoded project paths** — use `.planning/` relative or `~/.claude/` absolute, never `/home/specific-user/`
- ❌ **Skills that spawn agents without passing PROJECT.md and STATE.md context** — agents are blind by default
- ❌ **Skills longer than ~150 lines** — split or move logic to an agent
