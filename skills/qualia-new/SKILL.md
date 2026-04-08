---
name: qualia-new
description: "Set up a new project from scratch — interactive wizard with step-by-step questioning. Use when starting any new client project."
---

# /qualia-new — New Project Wizard

Interactive project setup. Ask one step at a time using AskUserQuestion. Never dump all questions at once.

## Process

### Step 0. Banner

Print this FIRST, before anything else:

```
◆ QUALIA ► NEW PROJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then say: **"Let's build something. Tell me what you're making."**

Wait for the user's free-text answer. Do NOT use AskUserQuestion here — let them talk naturally.

### Step 1. Project Type

After they describe what they want, use AskUserQuestion:

```
question: "What type of project is this?"
header: "Type"
options:
  - label: "Website / Web App"
    description: "Landing page, SaaS, dashboard, marketing site, portal"
  - label: "AI Agent"
    description: "Chatbot, AI assistant, tool-calling agent, RAG system"
  - label: "Voice Agent"
    description: "Phone agent, VAPI, Retell AI, ElevenLabs call bot"
  - label: "Mobile App"
    description: "iOS, Android, React Native, Expo"
```

### Step 2. Core Features

Based on their description, use AskUserQuestion with multiSelect: true:

```
question: "Which features do you need?"
header: "Features"
multiSelect: true
options (pick 4 most relevant from):
  - "Auth & accounts" — Login, signup, user management
  - "Database & CRUD" — Data storage, tables, admin panel
  - "Payments" — Stripe, subscriptions, checkout
  - "AI / LLM" — Chat, completions, embeddings, RAG
  - "Voice calls" — Inbound/outbound calls, IVR, telephony
  - "Email / notifications" — Transactional email, SMS, push
  - "File uploads" — Images, documents, S3/storage
  - "Admin dashboard" — Internal tools, analytics, reporting
  - "API / integrations" — Third-party APIs, webhooks, CRM sync
  - "Real-time" — WebSockets, live updates, presence
```

Pick the 4 options most relevant to what they described. Always offer the most likely ones.

### Step 3. Design Direction

Use AskUserQuestion with previews:

```
question: "What's the design vibe?"
header: "Design"
options:
  - label: "Dark & Bold"
    description: "Dark backgrounds, neon accents, strong contrast"
    preview: |
      ┌──────────────────────────────┐
      │  ██████████████████████████  │
      │  ██  DARK BG + TEAL GLOW ██  │
      │  ██████████████████████████  │
      │                              │
      │  ░░░░░░░░░░░░░░░░░░░░░░░░  │
      │  Sharp cards, glass effects  │
      │  Neon borders, deep shadows  │
      └──────────────────────────────┘

  - label: "Clean & Minimal"
    description: "White space, subtle shadows, refined typography"
    preview: |
      ┌──────────────────────────────┐
      │                              │
      │     Clean & Minimal          │
      │     ─────────────            │
      │                              │
      │  Generous whitespace         │
      │  Subtle borders              │
      │  Light, airy feel            │
      └──────────────────────────────┘

  - label: "Colorful & Playful"
    description: "Gradients, rounded shapes, vibrant palette"
    preview: |
      ┌──────────────────────────────┐
      │  ◆ ● ▲ ■  COLORFUL          │
      │                              │
      │  ╭──────╮  ╭──────╮         │
      │  │ Card │  │ Card │         │
      │  ╰──────╯  ╰──────╯         │
      │  Rounded, gradient fills     │
      │  Fun, approachable           │
      └──────────────────────────────┘

  - label: "Corporate / Professional"
    description: "Structured layouts, trust signals, enterprise feel"
    preview: |
      ┌──────────────────────────────┐
      │  LOGO    Nav  Nav  [CTA]     │
      │  ────────────────────────    │
      │  ┌────┐ ┌────┐ ┌────┐       │
      │  │Feat│ │Feat│ │Feat│       │
      │  └────┘ └────┘ └────┘       │
      │  Structured, trustworthy     │
      │  Clear hierarchy             │
      └──────────────────────────────┘
```

### Step 4. Stack Confirmation

Use AskUserQuestion:

```
question: "Stack — go with the Qualia default?"
header: "Stack"
options:
  - label: "Qualia Stack (Recommended)"
    description: "Next.js 16 + React 19 + TypeScript + Supabase + Vercel"
  - label: "Qualia + extras"
    description: "Default stack plus additional integrations (Stripe, VAPI, etc.)"
  - label: "Custom stack"
    description: "I have specific tech requirements"
```

If "Custom stack" — ask what they need.
If "Qualia + extras" — ask which integrations.

### Step 5. Scope & Client

Use AskUserQuestion:

```
question: "Is this a client project or internal?"
header: "Client"
options:
  - label: "Client project"
    description: "External client — will need handoff and credentials"
  - label: "Internal / Qualia"
    description: "Our own product or tool"
  - label: "Personal / Side project"
    description: "No formal client"
```

If client project, ask: **"What's the client's name?"** (free text, no AskUserQuestion)

### Step 6. Confirm & Scaffold

Present a summary:

```
◆ QUALIA ► PROJECT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Project    {name}
  Type       {type}
  Client     {client}
  Stack      {stack}
  Features   {feature list}
  Design     {design direction}
```

Use AskUserQuestion:

```
question: "Ready to scaffold?"
header: "Confirm"
options:
  - label: "Let's go"
    description: "Create the project now"
  - label: "Change something"
    description: "Go back and adjust"
```

### Step 7. Execute Scaffold

On confirmation, scaffold:

```bash
mkdir -p .planning

# Initialize git if needed
git init 2>/dev/null

# Create Next.js project (if website/ai-agent)
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-git

# Or Expo project (if mobile-app)
# npx create-expo-app . --template blank-typescript
```

Create GitHub repo:
```bash
gh repo create {project-name} --private --source=. --push
```

Link Vercel:
```bash
vercel link
```

Create Supabase project (via MCP or manual).

### Step 8. Create Planning Files

**`.planning/PROJECT.md`** — use template, fill from answers:
- Client, description, requirements (from features), out of scope, stack, design direction, decisions

### Step 8b. Initialize State

```bash
node ~/.claude/bin/state.js init --project "{name}" --client "{client}" --type "{type}" --assigned-to "{employee}" --phases '[{phases JSON array from roadmap}]'
```
This creates both STATE.md and tracking.json with consistent formatting.
Do NOT manually edit these files — state.js handles both.

### Step 9. Create Roadmap

Based on project type and features, create phases in STATE.md:

**Typical website:**
1. Foundation — Auth, database schema, base layout
2. Core — Main features
3. Content — Pages, copy, media
4. Polish — Design, animations, responsive

**Typical AI agent:**
1. Foundation — Auth, database, API routes
2. Agent — AI logic, prompts, tool calling
3. Interface — Chat UI, streaming, history
4. Polish — Error handling, rate limiting, monitoring

**Typical voice agent:**
1. Foundation — Webhook handler, Supabase, auth
2. Voice — VAPI/Retell config, call flow, prompts
3. Integration — CRM sync, logging, analytics
4. Polish — Latency optimization, error handling

Present the roadmap. Use AskUserQuestion:

```
question: "Does this roadmap look right?"
header: "Roadmap"
options:
  - label: "Looks good"
    description: "Lock it in and start planning Phase 1"
  - label: "Adjust phases"
    description: "I want to change the phase breakdown"
```

### Step 10. Commit & Output

```bash
git add .planning/
git commit -m "init: project setup with planning files"
git push -u origin main
```

```
◆ QUALIA ► PROJECT READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {Project Name}
  Type       {type}
  Phases     {N}
  Client     {client}

  → Run: /qualia-plan 1
```
