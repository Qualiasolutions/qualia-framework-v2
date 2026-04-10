#!/usr/bin/env node

const { createInterface } = require("readline");
const path = require("path");
const fs = require("fs");

// ─── Colors ──────────────────────────────────────────────
const TEAL = "\x1b[38;2;0;206;209m";
const DIM = "\x1b[38;2;80;90;100m";
const GREEN = "\x1b[38;2;52;211;153m";
const WHITE = "\x1b[38;2;220;225;230m";
const YELLOW = "\x1b[38;2;234;179;8m";
const RED = "\x1b[38;2;239;68;68m";
const RESET = "\x1b[0m";

// ─── Team codes ──────────────────────────────────────────
const TEAM = {
  "QS-FAWZI-01": {
    name: "Fawzi Goussous",
    role: "OWNER",
    description: "Company owner. Full access. Can push to main, approve deploys, edit secrets.",
  },
  "QS-HASAN-02": {
    name: "Hasan",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
  "QS-MOAYAD-03": {
    name: "Moayad",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
  "QS-RAMA-04": {
    name: "Rama",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
  "QS-SALLY-05": {
    name: "Sally",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
};

const CLAUDE_DIR = path.join(require("os").homedir(), ".claude");
const FRAMEWORK_DIR = path.resolve(__dirname, "..");

let installed = 0;
let errors = 0;

function log(msg) {
  console.log(`  ${msg}`);
}
function ok(label) {
  installed++;
  log(`${GREEN}✓${RESET} ${label}`);
}
function warn(label) {
  errors++;
  log(`${YELLOW}✗${RESET} ${label}`);
}
function copy(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

// ─── Prompt for code ─────────────────────────────────────
function askCode() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("");
    console.log(`${TEAL}  ◆ Qualia Framework v2${RESET}`);
    console.log(`${DIM}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log("");
    rl.question(`  ${WHITE}Enter install code:${RESET} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Resolve team code (tolerates case + O/0 typo in suffix) ─
// Accepts "qs-fawzi-01", "QS-FAWZI-01", "QS-FAWZI-O1" (letter O in the
// numeric suffix), and returns the canonical key if found, else null.
// Only normalizes O→0 in the segment AFTER the last dash — "QS-MOAYAD-03"
// contains a real "O" in the name and must not be mangled.
function resolveTeamCode(input) {
  const normalized = String(input || "").trim().toUpperCase();
  if (TEAM[normalized]) return normalized;
  const fuzzy = normalized.replace(
    /-([^-]*)$/,
    (_, suffix) => `-${suffix.replace(/O/g, "0")}`
  );
  if (TEAM[fuzzy]) return fuzzy;
  return null;
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  const rawCode = await askCode();
  const code = resolveTeamCode(rawCode);
  const member = code ? TEAM[code] : null;

  if (!member) {
    console.log("");
    log(`${RED}✗${RESET} Invalid code: "${rawCode}". Get your install code from Fawzi.`);
    log(`${DIM}  Tip: codes use digit zero, not letter O. Format: QS-NAME-01${RESET}`);
    console.log("");
    process.exit(1);
  }

  console.log("");
  log(`${GREEN}✓${RESET} ${WHITE}${member.name}${RESET} ${DIM}(${member.role})${RESET}`);
  console.log("");
  log(`Installing to ${WHITE}${CLAUDE_DIR}${RESET}`);
  console.log("");

  // ─── Skills ──────────────────────────────────────────
  const skillsDir = path.join(FRAMEWORK_DIR, "skills");
  const skills = fs
    .readdirSync(skillsDir)
    .filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory());

  log(`${WHITE}Skills${RESET}`);
  for (const skill of skills) {
    try {
      copy(
        path.join(skillsDir, skill, "SKILL.md"),
        path.join(CLAUDE_DIR, "skills", skill, "SKILL.md")
      );
      ok(skill);
    } catch (e) {
      warn(`${skill} — ${e.message}`);
    }
  }

  // ─── Agents ────────────────────────────────────────────
  log(`${WHITE}Agents${RESET}`);
  const agentsDir = path.join(FRAMEWORK_DIR, "agents");
  for (const file of fs.readdirSync(agentsDir)) {
    try {
      copy(path.join(agentsDir, file), path.join(CLAUDE_DIR, "agents", file));
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── Rules ─────────────────────────────────────────────
  log(`${WHITE}Rules${RESET}`);
  const rulesDir = path.join(FRAMEWORK_DIR, "rules");
  for (const file of fs.readdirSync(rulesDir)) {
    try {
      copy(path.join(rulesDir, file), path.join(CLAUDE_DIR, "rules", file));
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── Hooks ─────────────────────────────────────────────
  log(`${WHITE}Hooks${RESET}`);
  const hooksSource = path.join(FRAMEWORK_DIR, "hooks");
  const hooksDest = path.join(CLAUDE_DIR, "hooks");
  if (!fs.existsSync(hooksDest)) fs.mkdirSync(hooksDest, { recursive: true });
  // Clean up legacy .sh hooks from previous v2.5/v2.6 installs so no orphans
  // remain on disk after upgrading to the pure-Node v2.7+ hooks.
  try {
    for (const f of fs.readdirSync(hooksDest)) {
      if (f.endsWith(".sh")) {
        try { fs.unlinkSync(path.join(hooksDest, f)); } catch {}
      }
    }
  } catch {}
  for (const file of fs.readdirSync(hooksSource)) {
    try {
      const dest = path.join(hooksDest, file);
      copy(path.join(hooksSource, file), dest);
      // chmod is a no-op on Windows but harmless
      fs.chmodSync(dest, 0o755);
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── Status line ───────────────────────────────────────
  log(`${WHITE}Status line${RESET}`);
  try {
    const slDest = path.join(CLAUDE_DIR, "bin", "statusline.js");
    copy(path.join(FRAMEWORK_DIR, "bin", "statusline.js"), slDest);
    ok("statusline.js");
  } catch (e) {
    warn(`statusline.js — ${e.message}`);
  }

  // ─── Templates ─────────────────────────────────────────
  log(`${WHITE}Templates${RESET}`);
  const tmplDir = path.join(FRAMEWORK_DIR, "templates");
  const tmplDest = path.join(CLAUDE_DIR, "qualia-templates");
  if (!fs.existsSync(tmplDest)) fs.mkdirSync(tmplDest, { recursive: true });
  for (const file of fs.readdirSync(tmplDir)) {
    try {
      copy(path.join(tmplDir, file), path.join(tmplDest, file));
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── CLAUDE.md with role ───────────────────────────────
  log(`${WHITE}CLAUDE.md${RESET}`);
  try {
    let claudeMd = fs.readFileSync(
      path.join(FRAMEWORK_DIR, "CLAUDE.md"),
      "utf8"
    );
    claudeMd = claudeMd.replace("{{ROLE}}", member.role);
    claudeMd = claudeMd.replace("{{ROLE_DESCRIPTION}}", member.description);
    const claudeDest = path.join(CLAUDE_DIR, "CLAUDE.md");
    fs.writeFileSync(claudeDest, claudeMd, "utf8");
    ok(`Configured as ${member.role}`);
  } catch (e) {
    warn(`CLAUDE.md — ${e.message}`);
  }

  // ─── Scripts ─────────────────────────────────────────────
  log(`${WHITE}Scripts${RESET}`);
  try {
    const binDest = path.join(CLAUDE_DIR, "bin");
    if (!fs.existsSync(binDest)) fs.mkdirSync(binDest, { recursive: true });
    copy(
      path.join(FRAMEWORK_DIR, "bin", "state.js"),
      path.join(binDest, "state.js")
    );
    ok("state.js (state machine)");
    copy(
      path.join(FRAMEWORK_DIR, "bin", "qualia-ui.js"),
      path.join(binDest, "qualia-ui.js")
    );
    fs.chmodSync(path.join(binDest, "qualia-ui.js"), 0o755);
    ok("qualia-ui.js (cosmetics library)");
    copy(
      path.join(FRAMEWORK_DIR, "bin", "statusline.js"),
      path.join(binDest, "statusline.js")
    );
    ok("statusline.js (status bar renderer)");
  } catch (e) {
    warn(`scripts — ${e.message}`);
  }

  // ─── Guide ─────────────────────────────────────────────
  try {
    copy(
      path.join(FRAMEWORK_DIR, "guide.md"),
      path.join(CLAUDE_DIR, "qualia-guide.md")
    );
    ok("guide.md");
  } catch (e) {
    warn(`guide.md — ${e.message}`);
  }

  // ─── Knowledge directory ─────────────────────────────────
  log(`${WHITE}Knowledge${RESET}`);
  const knowledgeDir = path.join(CLAUDE_DIR, "knowledge");
  if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });
  const knowledgeFiles = {
    "learned-patterns.md": `# Learned Patterns

Patterns discovered across projects. Updated by \`/qualia-learn\` and manual notes.

---

## Cross-platform Node: always spawnSync with argv, never execSync with shell strings
**Why:** \`execSync(\\\`node \${path}/state.js check 2>/dev/null\\\`)\` breaks on Windows when the path contains spaces (common: \`C:\\\\Users\\\\John Doe\`) and the \`2>/dev/null\` redirect is bash-only. Windows cmd.exe tries to create \`\\\\dev\\\\null\` at drive root.
**How:** Use \`spawnSync(process.execPath, [path, "check"], { stdio: ["ignore","pipe","ignore"] })\`. Argv array is immune to path splitting; \`stdio: "ignore"\` silences stderr without shell redirection.

---

## Cross-platform stdin piping: spawnSync with input:, not bash <<< here-strings
**Why:** The \`<<<\` bash here-string works on bash + zsh but fails silently on Windows cmd.exe AND on Debian/Ubuntu where \`/bin/sh\` is dash (no \`<<<\` support).
**How:** \`spawnSync("npx", ["cmd"], { input: "data\\\\n", stdio: ["pipe","inherit","inherit"], shell: process.platform === "win32" })\`. The \`input:\` option pipes stdin directly. \`shell: process.platform === "win32"\` is required because npm/npx are \`.cmd\` shims on Windows that only resolve through a shell.

---

## Fresh-context isolation beats shared-context compression
**Why:** Claude's output quality degrades as context fills. A single massive context doing plan + build + verify hits the degradation curve on the later tasks.
**How:** Spawn separate subagents for planner / builder (per task) / verifier. Each gets fresh context. Task 50 gets the same quality as task 1. Cost: PROJECT.md + STATE.md get re-loaded into each subagent context, but the quality win dominates.

---

## Goal-backward verification beats task-completion tracking
**Why:** A task "create chat component" can be marked complete with a placeholder file. The task ran; the goal didn't.
**How:** For each phase success criterion, do a 3-level check: (1) what must be TRUE, (2) what files/functions must EXIST and be substantive (not stubs), (3) what must be CONNECTED (imported and called). Grep the codebase. Never trust summaries.
`,
    "common-fixes.md": `# Common Fixes

Recurring issues and their solutions.

---

## Install code "Invalid" — user typed letter O instead of digit 0
**Symptom:** \`npx qualia-framework-v2 install\` rejects \`QS-NAME-O1\` (letter O in suffix).
**Cause:** Team codes use digit zero (\`-01\`, \`-02\`, etc.), not letter O.
**Fix:** Since v2.8.1, install.js auto-normalizes: \`QS-FAWZI-O1\` → \`QS-FAWZI-01\`. The normalization only touches the segment after the last dash, so \`QS-MOAYAD-03\` (real O in name) is preserved.
**Framework version:** Fixed in v2.8.1.

---

## Windows banner shows "No project detected" inside a real project
**Symptom:** The session-start banner from qualia-ui.js displays the router panel but without phase/status, even in a project with \`.planning/\`.
**Cause:** Before v2.8.0, \`qualia-ui.js\` called state.js via \`execSync(\\\`node \${path} check 2>/dev/null\\\`)\`. Windows cmd.exe couldn't parse the \`2>/dev/null\` redirect and/or split the path on spaces in the username.
**Fix:** v2.8.0 switched to \`spawnSync(process.execPath, [statePath, "check"], { stdio: ["ignore","pipe","ignore"] })\`. Argv array + silent stdio = cross-platform safe.
**Framework version:** Fixed in v2.8.0.

---

## \`npx qualia-framework-v2 update\` fails on Windows or Ubuntu
**Symptom:** Manual update command fails silently or with a shell parse error on Windows and Debian/Ubuntu.
**Cause:** Before v2.8.0, cli.js cmdUpdate used \`execSync(\\\`npx ... install <<< "\${code}"\\\`, { shell: true })\`. The \`<<<\` here-string is bash-only; cmd.exe doesn't understand it, and \`/bin/sh\` on Debian/Ubuntu is \`dash\` which also lacks it.
**Fix:** v2.8.0 replaced with \`spawnSync("npx", [...], { input: code + "\\\\n", shell: process.platform === "win32" })\`. Uses stdin pipe instead of here-string.
**Framework version:** Fixed in v2.8.0.

---

## Pre-deploy gate false-positive on Next.js Server Components using service_role
**Symptom:** \`/qualia-ship\` is blocked with "service_role found in client code" for a file that's actually a Server Component (runs server-side only).
**Cause:** pre-deploy-gate.js skips files matching \`.server.\` filename pattern OR \`server/\` directory path. If the Server Component is at \`app/admin/page.tsx\` (no .server. marker, not in a server/ dir), the scan flags it.
**Workaround:** Rename to \`.server.tsx\` OR move to a \`server/\` subdirectory OR extract the service_role usage into a helper in \`lib/server/\`.
**Framework version:** Known issue as of v2.8.1; better heuristic planned for v3.0.
`,
    "client-prefs.md": `# Client Preferences

Client-specific preferences, design choices, and requirements. Loaded by \`/qualia-new\` when starting a project for a known client.

---

## Example Client (template)
**Industry:** {e.g., fintech, healthcare, SaaS}
**Contact:** {email}
**Design:** {dark-bold | clean-minimal | colorful-playful | corporate-professional}
**Stack preferences:** {anything non-default}
**Hard constraints:** {things they've explicitly said no to}
**Source of notes:** {date or conversation reference}
`,
  };
  for (const [name, defaultContent] of Object.entries(knowledgeFiles)) {
    const dest = path.join(knowledgeDir, name);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, defaultContent);
      ok(`${name} (created)`);
    } else {
      ok(`${name} (exists)`);
    }
  }

  // ─── Save config (for update command) ──────────────────
  const configFile = path.join(CLAUDE_DIR, ".qualia-config.json");
  const config = {
    code,
    installed_by: member.name,
    role: member.role,
    version: require("../package.json").version,
    installed_at: new Date().toISOString().split("T")[0],
  };
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");

  // ─── ERP API key (for report uploads) ──────────────────
  log(`${WHITE}ERP integration${RESET}`);
  const erpKeyFile = path.join(CLAUDE_DIR, ".erp-api-key");
  if (!fs.existsSync(erpKeyFile)) {
    fs.writeFileSync(erpKeyFile, "qualia-claude-2026", { mode: 0o600 });
    ok(".erp-api-key (created)");
  } else {
    ok(".erp-api-key (exists)");
  }

  // ─── Configure settings.json ───────────────────────────
  console.log("");
  log(`${WHITE}Configuring settings.json...${RESET}`);

  const settingsPath = path.join(CLAUDE_DIR, "settings.json");
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {}
  }

  // Env
  if (!settings.env) settings.env = {};
  Object.assign(settings.env, {
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0",
    MAX_MCP_OUTPUT_TOKENS: "25000",
    CLAUDE_CODE_NO_FLICKER: "1",
  });

  // Status line
  settings.statusLine = {
    type: "command",
    command: `node "${path.join(CLAUDE_DIR, "bin", "statusline.js")}"`,
  };

  // Spinner
  settings.spinnerVerbs = {
    mode: "replace",
    verbs: [
      "Qualia-fying",
      "Solution-ing",
      "Teal-crafting",
      "Vibe-forging",
      "Shipping",
      "Wiring",
      "Polishing",
      "Verifying",
      "Orchestrating",
      "Architecting",
      "Deploying",
      "Hardening",
    ],
  };

  settings.spinnerTipsOverride = {
    excludeDefault: true,
    tips: [
      "◆ Lost? Type /qualia for the next step",
      "◆ Small fix? Use /qualia-quick to skip planning",
      "◆ End of day? /qualia-report before you clock out",
      "◆ Context isolation: every task gets a fresh AI brain",
      "◆ The verifier doesn't trust claims — it greps the code",
      "◆ Plans are prompts — the plan IS what the builder reads",
      "◆ Feature branches only — never push to main",
      "◆ Read before write — no exceptions",
      "◆ MVP first — build what's asked, nothing extra",
      "◆ tracking.json syncs to ERP on every push",
    ],
  };

  // Hooks — pure Node.js, cross-platform (Windows/macOS/Linux).
  // Every hook command is `node <absolute-path-to-hook.js>` which avoids the
  // bash/Git Bash requirement on Windows.
  const hd = path.join(CLAUDE_DIR, "hooks");
  const nodeCmd = (hookFile) => `node "${path.join(hd, hookFile)}"`;
  settings.hooks = {
    SessionStart: [
      {
        matcher: ".*",
        hooks: [
          {
            type: "command",
            command: nodeCmd("session-start.js"),
            timeout: 5,
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: nodeCmd("auto-update.js"),
            timeout: 5,
          },
          {
            type: "command",
            if: "Bash(git push*)",
            command: nodeCmd("branch-guard.js"),
            timeout: 10,
            statusMessage: "◆ Checking branch permissions...",
          },
          {
            type: "command",
            if: "Bash(git push*)",
            command: nodeCmd("pre-push.js"),
            timeout: 15,
            statusMessage: "◆ Syncing tracking...",
          },
          {
            type: "command",
            if: "Bash(vercel --prod*)",
            command: nodeCmd("pre-deploy-gate.js"),
            timeout: 180,
            statusMessage: "◆ Running quality gates...",
          },
        ],
      },
      {
        matcher: "Edit|Write",
        hooks: [
          {
            type: "command",
            if: "Edit(*.env*)|Write(*.env*)",
            command: nodeCmd("block-env-edit.js"),
            timeout: 5,
            statusMessage: "◆ Checking file permissions...",
          },
          {
            type: "command",
            if: "Edit(*migration*)|Write(*migration*)|Edit(*.sql)|Write(*.sql)",
            command: nodeCmd("migration-guard.js"),
            timeout: 10,
            statusMessage: "◆ Checking migration safety...",
          },
        ],
      },
    ],
    PreCompact: [
      {
        matcher: "compact",
        hooks: [
          {
            type: "command",
            command: nodeCmd("pre-compact.js"),
            timeout: 15,
            statusMessage: "◆ Saving state...",
          },
        ],
      },
    ],
  };

  // Permissions
  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];
  if (!settings.permissions.deny) {
    settings.permissions.deny = [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
    ];
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  ok("Hooks: session-start, auto-update, branch-guard, pre-push, env-block, migration-guard, deploy-gate, pre-compact");
  ok("Status line + spinner configured");
  ok("Environment variables + permissions");

  // ─── Summary ───────────────────────────────────────────
  console.log("");
  console.log(`${TEAL}  ◆ Installed ✓${RESET}`);
  console.log(`${DIM}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`  ${WHITE}${member.name}${RESET} ${DIM}(${member.role})${RESET}`);
  console.log(`  Skills:       ${WHITE}${skills.length}${RESET}`);
  const agentCount = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length;
  console.log(`  Agents:       ${WHITE}${agentCount}${RESET} ${DIM}(planner, builder, verifier, qa-browser)${RESET}`);
  console.log(`  Hooks:        ${WHITE}8${RESET} ${DIM}(session-start, auto-update, branch-guard, pre-push, env-block, migration-guard, deploy-gate, pre-compact)${RESET}`);
  console.log(`  Rules:        ${WHITE}${fs.readdirSync(rulesDir).length}${RESET} ${DIM}(security, frontend, design-reference, deployment)${RESET}`);
  console.log(`  Scripts:      ${WHITE}3${RESET} ${DIM}(state.js, qualia-ui.js, statusline.js)${RESET}`);
  console.log(`  Knowledge:    ${WHITE}3${RESET} ${DIM}(patterns, fixes, client prefs)${RESET}`);
  console.log(`  Templates:    ${WHITE}${fs.readdirSync(tmplDir).length}${RESET}`);
  console.log(`  Status line:  ${GREEN}✓${RESET}`);
  console.log(`  CLAUDE.md:    ${GREEN}✓${RESET} ${DIM}(${member.role})${RESET}`);

  if (errors > 0) {
    console.log("");
    console.log(`  ${YELLOW}${errors} warning(s)${RESET} — check output above`);
  }

  console.log("");
  console.log(`  Restart Claude Code, then type ${TEAL}/qualia${RESET} in any project.`);
  console.log("");
}

main().catch((e) => {
  console.error(`${RED}  ✗ Installation failed: ${e.message}${RESET}`);
  process.exit(1);
});
