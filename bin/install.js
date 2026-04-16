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

const CLAUDE_DIR = path.join(require("os").homedir(), ".claude");
const FRAMEWORK_DIR = path.resolve(__dirname, "..");

// ─── Team codes ──────────────────────────────────────────
const DEFAULT_TEAM = {
  "QS-FAWZI-01": {
    name: "Fawzi Goussous",
    role: "OWNER",
    description: "Company owner. Full access. Can push to main, approve deploys, edit secrets.",
  },
  "QS-HASAN-02": {
    name: "Hasan",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main.",
  },
  "QS-MOAYAD-03": {
    name: "Moayad",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main.",
  },
  "QS-RAMA-04": {
    name: "Rama",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main.",
  },
  "QS-SALLY-05": {
    name: "Sally",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main.",
  },
};

// Load team from external file, fall back to embedded defaults.
function loadTeam() {
  const teamFile = path.join(CLAUDE_DIR, ".qualia-team.json");
  try {
    if (fs.existsSync(teamFile)) {
      const external = JSON.parse(fs.readFileSync(teamFile, "utf8"));
      if (external && typeof external === "object" && Object.keys(external).length > 0) {
        return external;
      }
    }
  } catch {}
  return DEFAULT_TEAM;
}

const TEAM = loadTeam();

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

// Recursively copy a directory tree from src to dest.
// Skips hidden files (dot-prefixed) to avoid syncing .DS_Store, editor temp files, etc.
function copyTree(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Surgically remove orphaned v2.6 install cruft from ~/.claude/ on upgrade.
// v2.6 installed a separate ~/.claude/qualia-framework/ directory with workflows/,
// references/, assets/, bin/qualia-tools.js. v3 doesn't use any of that — it was
// just never cleaned up. Also removes broken qualia-*.md agents from the v2.6 era
// that reference /home/qualia/ paths which don't exist.
function cleanupLegacyV26() {
  const removed = { dirs: [], files: [] };

  // Remove the entire v2.6 framework leftover directory.
  const v26Dir = path.join(CLAUDE_DIR, "qualia-framework");
  try {
    if (fs.existsSync(v26Dir)) {
      const versionFile = path.join(v26Dir, "VERSION");
      // Safety: only remove if it has the v2.6 shape (VERSION file exists)
      if (fs.existsSync(versionFile)) {
        fs.rmSync(v26Dir, { recursive: true, force: true });
        removed.dirs.push("~/.claude/qualia-framework/ (v2.6 leftover)");
      }
    }
  } catch {}

  // Remove broken v2.6 agent files that reference /home/qualia/ paths.
  // The canonical v3 agents ship with the framework (planner.md, builder.md, etc.)
  // — scan all qualia-*.md files in agents/ and remove any that contain the
  // /home/qualia/ signature (v2.6 broken absolute paths).
  const agentsDest = path.join(CLAUDE_DIR, "agents");
  try {
    if (fs.existsSync(agentsDest)) {
      for (const name of fs.readdirSync(agentsDest)) {
        if (!name.startsWith("qualia-") || !name.endsWith(".md")) continue;
        const p = path.join(agentsDest, name);
        try {
          const content = fs.readFileSync(p, "utf8");
          if (content.includes("/home/qualia/.claude")) {
            fs.unlinkSync(p);
            removed.files.push(`agents/${name}`);
          }
        } catch {}
      }
    }
  } catch {}

  return removed;
}

// ─── Branded Header ─────────────────────────────────────
const BOLD = "\x1b[1m";
const TEAL_GLOW = "\x1b[38;2;0;170;175m";
const PKG_VERSION = require("../package.json").version;
const RULE = "━".repeat(48);

function printHeader() {
  console.log("");
  console.log("");
  console.log(`  ${TEAL}${BOLD}⬢  Q U A L I A${RESET}`);
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log(`  ${WHITE}Framework v${PKG_VERSION}${RESET}  ${DIM}·${RESET}  ${TEAL_GLOW}Qualia Solutions${RESET}`);
  console.log(`  ${DIM}Plan → Build → Verify → Ship${RESET}`);
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log("");
}

function printSection(title) {
  console.log("");
  console.log(`  ${TEAL}▸${RESET} ${WHITE}${BOLD}${title}${RESET}`);
  console.log(`  ${DIM}${"─".repeat(40)}${RESET}`);
}

// ─── Prompt for code ─────────────────────────────────────
function askCode() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    printHeader();
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
  const roleColor = member.role === "OWNER" ? TEAL : GREEN;
  console.log(`  ${GREEN}✓${RESET} ${WHITE}${BOLD}Welcome, ${member.name}${RESET}`);
  console.log(`  ${DIM}  Role:${RESET} ${roleColor}${member.role}${RESET}  ${DIM}·${RESET}  ${DIM}Target:${RESET} ${WHITE}${CLAUDE_DIR}${RESET}`);

  // ─── Skills ──────────────────────────────────────────
  const skillsDir = path.join(FRAMEWORK_DIR, "skills");
  const skills = fs
    .readdirSync(skillsDir)
    .filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory());

  printSection("Skills");
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
  printSection("Agents");
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
  printSection("Rules");
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
  printSection("Hooks");
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
  // v3.2.0: purge deprecated hooks from existing installs on upgrade.
  // block-env-edit.js was retired — team now has full read/write on .env*.
  const DEPRECATED_HOOKS = ["block-env-edit.js"];
  for (const f of DEPRECATED_HOOKS) {
    const p = path.join(hooksDest, f);
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
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

  // ─── Templates (recursive — supports nested projects/ and research-project/) ─
  printSection("Templates");
  const tmplDir = path.join(FRAMEWORK_DIR, "templates");
  const tmplDest = path.join(CLAUDE_DIR, "qualia-templates");
  if (!fs.existsSync(tmplDest)) fs.mkdirSync(tmplDest, { recursive: true });
  for (const entry of fs.readdirSync(tmplDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const srcPath = path.join(tmplDir, entry.name);
    const destPath = path.join(tmplDest, entry.name);
    try {
      if (entry.isDirectory()) {
        copyTree(srcPath, destPath);
        ok(`${entry.name}/ (directory)`);
      } else {
        copy(srcPath, destPath);
        ok(entry.name);
      }
    } catch (e) {
      warn(`${entry.name} — ${e.message}`);
    }
  }

  // ─── References (methodology docs loaded by skills at runtime) ────
  printSection("References");
  const refDir = path.join(FRAMEWORK_DIR, "references");
  const refDest = path.join(CLAUDE_DIR, "qualia-references");
  if (fs.existsSync(refDir)) {
    if (!fs.existsSync(refDest)) fs.mkdirSync(refDest, { recursive: true });
    for (const file of fs.readdirSync(refDir)) {
      try {
        copy(path.join(refDir, file), path.join(refDest, file));
        ok(file);
      } catch (e) {
        warn(`${file} — ${e.message}`);
      }
    }
  } else {
    log(`${DIM}(no references/ in framework — skipping)${RESET}`);
  }

  // ─── Cleanup legacy v2.6 install cruft ────────────────────
  const legacy = cleanupLegacyV26();
  if (legacy.dirs.length > 0 || legacy.files.length > 0) {
    printSection("Cleanup (v2.6 leftover)");
    for (const d of legacy.dirs) ok(`removed ${d}`);
    for (const f of legacy.files) ok(`removed ${f}`);
  }

  // ─── CLAUDE.md with role ───────────────────────────────
  printSection("Configuration");
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
  printSection("Scripts");
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
  printSection("Knowledge Base");
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
**Symptom:** \`npx qualia-framework install\` rejects \`QS-NAME-O1\` (letter O in suffix).
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

## \`npx qualia-framework update\` fails on Windows or Ubuntu
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
    erp: {
      enabled: true,
      url: "https://portal.qualiasolutions.net",
      api_key_file: ".erp-api-key",
    },
  };
  // mode 0o600: this file holds the role bit (OWNER vs EMPLOYEE) which the
  // branch-guard hook trusts. Default 0644 would let any local user edit it
  // and self-elevate.
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  try { fs.chmodSync(configFile, 0o600); } catch {}

  // ─── ERP API key (for report uploads) ──────────────────
  // Per-user keys, never a hardcoded shared default. Sources, in order:
  //   1. $QUALIA_ERP_KEY env var at install time (CI / scripted installs)
  //   2. Existing ~/.claude/.erp-api-key (preserved across re-installs)
  //   3. Skip — ERP disabled in config until user runs `qualia-framework set-erp-key`
  printSection("ERP Integration");
  const erpKeyFile = path.join(CLAUDE_DIR, ".erp-api-key");
  const envKey = (process.env.QUALIA_ERP_KEY || "").trim();
  if (envKey) {
    fs.writeFileSync(erpKeyFile, envKey, { mode: 0o600 });
    try { fs.chmodSync(erpKeyFile, 0o600); } catch {}
    ok(".erp-api-key (from $QUALIA_ERP_KEY)");
  } else if (fs.existsSync(erpKeyFile)) {
    try { fs.chmodSync(erpKeyFile, 0o600); } catch {}
    ok(".erp-api-key (existing — preserved)");
  } else {
    // Disable ERP in the config we just wrote.
    try {
      const cfg = JSON.parse(fs.readFileSync(configFile, "utf8"));
      cfg.erp = { ...(cfg.erp || {}), enabled: false };
      fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
      try { fs.chmodSync(configFile, 0o600); } catch {}
    } catch {}
    log(`${YELLOW}!${RESET} ERP key not configured — reports won't upload until set.`);
    log(`${DIM}  Set with:${RESET} ${TEAL}export QUALIA_ERP_KEY=...${RESET} ${DIM}then re-install,${RESET}`);
    log(`${DIM}  or write the key to:${RESET} ${WHITE}${erpKeyFile}${RESET} ${DIM}(mode 0600).${RESET}`);
    log(`${DIM}  Get a key from Fawzi.${RESET}`);
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
      "⬢ Lost? Type /qualia for the next step",
      "⬢ Small fix? Use /qualia-quick to skip planning",
      "⬢ End of day? /qualia-report before you clock out",
      "⬢ Context isolation: every task gets a fresh AI brain",
      "⬢ The verifier doesn't trust claims — it greps the code",
      "⬢ Plans are prompts — the plan IS what the builder reads",
      "⬢ Feature branches only — never push to main",
      "⬢ Read before write — no exceptions",
      "⬢ MVP first — build what's asked, nothing extra",
      "⬢ tracking.json syncs to ERP on every push",
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
            timeout: 5,
            statusMessage: "⬢ Checking branch permissions...",
          },
          {
            type: "command",
            if: "Bash(git push*)",
            command: nodeCmd("pre-push.js"),
            timeout: 15,
            statusMessage: "⬢ Syncing tracking...",
          },
          {
            type: "command",
            if: "Bash(vercel --prod*)",
            command: nodeCmd("pre-deploy-gate.js"),
            timeout: 180,
            statusMessage: "⬢ Running quality gates...",
          },
        ],
      },
      {
        matcher: "Edit|Write",
        hooks: [
          {
            type: "command",
            if: "Edit(*migration*)|Write(*migration*)|Edit(*.sql)|Write(*.sql)",
            command: nodeCmd("migration-guard.js"),
            timeout: 10,
            statusMessage: "⬢ Checking migration safety...",
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
            statusMessage: "⬢ Saving state...",
          },
        ],
      },
    ],
  };

  // Permissions — no restrictions on env files or branches.
  // Everyone can read/write .env, push to main.
  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];
  if (!settings.permissions.deny) settings.permissions.deny = [];

  // ─── Optional: next-devtools MCP ─────────────────────────
  // Wire next-devtools-mcp for runtime error visibility in Next.js projects
  if (!settings.mcpServers) settings.mcpServers = {};
  if (!settings.mcpServers["next-devtools"]) {
    settings.mcpServers["next-devtools"] = {
      command: "npx",
      args: ["next-devtools-mcp@0.3.10"],
      disabled: false,
    };
    ok("MCP: next-devtools (runtime error visibility for Next.js projects)");
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  ok("Hooks: session-start, auto-update, branch-guard, pre-push, migration-guard, deploy-gate, pre-compact");
  ok("Status line + spinner configured");
  ok("Environment variables + permissions");

  // ─── Summary ───────────────────────────────────────────
  console.log("");
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log(`  ${TEAL}${BOLD}⬢  INSTALLED${RESET}`);
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log("");
  console.log(`  ${WHITE}${BOLD}${member.name}${RESET}  ${DIM}·${RESET}  ${roleColor}${member.role}${RESET}  ${DIM}·${RESET}  ${DIM}v${PKG_VERSION}${RESET}`);
  console.log("");
  const agentCount = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length;
  const hookCount = fs.readdirSync(hooksSource).length;
  const ruleCount = fs.readdirSync(rulesDir).length;
  const tmplCount = fs.readdirSync(tmplDir).length;
  console.log(`  ${DIM}Skills${RESET}    ${TEAL}${skills.length}${RESET}     ${DIM}Agents${RESET}  ${TEAL}${agentCount}${RESET}     ${DIM}Hooks${RESET}   ${TEAL}${hookCount}${RESET}`);
  console.log(`  ${DIM}Rules${RESET}     ${TEAL}${ruleCount}${RESET}     ${DIM}Scripts${RESET} ${TEAL}3${RESET}     ${DIM}Templates${RESET} ${TEAL}${tmplCount}${RESET}`);

  if (errors > 0) {
    console.log("");
    console.log(`  ${YELLOW}${errors} warning(s)${RESET} — check output above`);
  }

  console.log("");
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log(`  ${WHITE}${BOLD}Quick Start${RESET}`);
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log("");
  console.log(`  ${TEAL}1.${RESET} ${WHITE}Restart Claude Code${RESET} ${DIM}(loads new settings)${RESET}`);
  console.log(`  ${TEAL}2.${RESET} ${WHITE}cd into any project${RESET} ${DIM}and run${RESET} ${TEAL}claude${RESET}`);
  console.log(`  ${TEAL}3.${RESET} ${WHITE}Type${RESET} ${TEAL}${BOLD}/qualia${RESET} ${DIM}— it tells you what to do next${RESET}`);
  console.log("");
  console.log(`  ${DIM}New project?${RESET}    ${TEAL}/qualia-new${RESET}`);
  console.log(`  ${DIM}Quick fix?${RESET}      ${TEAL}/qualia-quick${RESET}`);
  console.log(`  ${DIM}End of day?${RESET}     ${TEAL}/qualia-report${RESET} ${DIM}(mandatory)${RESET}`);
  console.log(`  ${DIM}Stuck?${RESET}          ${TEAL}/qualia${RESET}`);
  console.log("");
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log(`  ${TEAL}${BOLD}Welcome to the future with Qualia.${RESET}`);
  console.log(`  ${DIM}${RULE}${RESET}`);
  console.log("");
}

main().catch((e) => {
  console.error(`${RED}  ✗ Installation failed: ${e.message}${RESET}`);
  process.exit(1);
});
