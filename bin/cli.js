#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const TEAL = "\x1b[38;2;0;206;209m";
const TG = "\x1b[38;2;0;170;175m";
const DIM = "\x1b[38;2;80;90;100m";
const GREEN = "\x1b[38;2;52;211;153m";
const WHITE = "\x1b[38;2;220;225;230m";
const YELLOW = "\x1b[38;2;234;179;8m";
const RED = "\x1b[38;2;239;68;68m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const CLAUDE_DIR = path.join(require("os").homedir(), ".claude");
const PKG = require("../package.json");
const CONFIG_FILE = path.join(CLAUDE_DIR, ".qualia-config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + "\n");
}

function banner() {
  console.log("");
  console.log(`  ${TEAL}${BOLD}⬢${RESET} ${WHITE}${BOLD}Qualia Framework${RESET} ${DIM}v${PKG.version}${RESET}`);
  console.log(`  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
}

// ─── Commands ────────────────────────────────────────────

function cmdInstall() {
  require("./install.js");
}

function cmdVersion() {
  banner();
  const cfg = readConfig();

  console.log(`  ${DIM}Installed:${RESET}  ${WHITE}${PKG.version}${RESET}`);
  if (cfg.installed_by) {
    console.log(`  ${DIM}User:${RESET}       ${WHITE}${cfg.installed_by}${RESET} ${DIM}(${cfg.role})${RESET}`);
  }
  if (cfg.installed_at) {
    console.log(`  ${DIM}Date:${RESET}       ${WHITE}${cfg.installed_at}${RESET}`);
  }

  // Check for updates
  try {
    // spawnSync with argv — no bash-only `2>/dev/null` redirect, no shell
    // interpolation. stdio: "ignore" on stderr silences any npm warnings
    // (offline, proxy, etc.) without a shell redirect. shell: true on
    // Windows because `npm` is a .cmd shim that only resolves through cmd.
    const r = spawnSync("npm", ["view", "qualia-framework", "version"], {
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
      timeout: 5000,
      encoding: "utf8",
    });
    const latest = (r.stdout || "").trim();
    const semverGt = (a, b) => {
      const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) { if (pa[i] > pb[i]) return true; if (pa[i] < pb[i]) return false; }
      return false;
    };
    if (latest && semverGt(latest, PKG.version)) {
      console.log("");
      console.log(`  ${YELLOW}Update available:${RESET} ${WHITE}${latest}${RESET}`);
      console.log(`  ${DIM}Run:${RESET} npx qualia-framework update`);
    } else if (latest) {
      console.log(`  ${DIM}Latest:${RESET}     ${GREEN}${latest} ✓${RESET} ${DIM}(up to date)${RESET}`);
    }
  } catch {
    console.log(`  ${DIM}Latest:${RESET}     ${DIM}(offline — couldn't check)${RESET}`);
  }
  console.log("");
}

function cmdUpdate() {
  banner();
  const cfg = readConfig();

  if (!cfg.code) {
    console.log(`  ${RED}✗${RESET} No install code saved. Run ${TEAL}install${RESET} first.`);
    console.log("");
    process.exit(1);
  }

  console.log(`  ${DIM}Current:${RESET}  ${WHITE}${PKG.version}${RESET}`);
  console.log(`  ${DIM}Updating...${RESET}`);
  console.log("");

  try {
    const r = spawnSync("npx", ["qualia-framework@latest", "install"], {
      input: cfg.code + "\n",
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",  // npx is a .cmd shim on Windows — must go through shell
      timeout: 120000,
      encoding: "utf8",
    });
    if (r.status !== 0) {
      console.log(`  ${RED}✗${RESET} Update failed. Run manually: npx qualia-framework@latest install`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`  ${RED}✗${RESET} Update failed: ${e.message}`);
    console.log(`  ${DIM}Run manually:${RESET} npx qualia-framework@latest install`);
    process.exit(1);
  }
}

// ─── Uninstall ───────────────────────────────────────────
// Surgical removal of the Qualia Framework from ~/.claude/.
// Preserves CLAUDE.md (user may have customized it) and preserves any
// non-Qualia entries in settings.json (other hooks, user env vars, etc.).
// --yes / -y skips the confirmation prompt for scripted use.

// 8 Qualia hook filenames — only these are removed from ~/.claude/hooks/,
// any other hooks the user dropped in there are left alone.
const QUALIA_HOOK_FILES = [
  "session-start.js",
  "auto-update.js",
  "branch-guard.js",
  "pre-push.js",
  "block-env-edit.js",
  "migration-guard.js",
  "pre-deploy-gate.js",
  "pre-compact.js",
];

// 4 Qualia agents — only these are removed.
const QUALIA_AGENT_FILES = ["planner.md", "builder.md", "verifier.md", "qa-browser.md"];

// 3 Qualia bin scripts.
const QUALIA_BIN_FILES = ["state.js", "qualia-ui.js", "statusline.js"];

// 4 Qualia rules.
const QUALIA_RULE_FILES = ["security.md", "frontend.md", "design-reference.md", "deployment.md"];

function promptYesNo(question, defaultYes) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultYes ? " (Y/n)" : " (y/N)";
    rl.question(`  ${WHITE}${question}${RESET}${suffix} `, (answer) => {
      rl.close();
      const a = String(answer || "").trim().toLowerCase();
      if (!a) return resolve(defaultYes);
      resolve(a === "y" || a === "yes");
    });
  });
}

function safeUnlink(p, counters) {
  try {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      counters.filesRemoved++;
    }
  } catch (e) {
    counters.errors.push(`${p}: ${e.message}`);
  }
}

function safeRmDir(p, counters) {
  try {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      counters.dirsRemoved++;
    }
  } catch (e) {
    counters.errors.push(`${p}: ${e.message}`);
  }
}

function cleanSettingsJson(counters) {
  const settingsPath = path.join(CLAUDE_DIR, "settings.json");
  if (!fs.existsSync(settingsPath)) return;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (e) {
    counters.errors.push(`settings.json: ${e.message}`);
    return;
  }

  // Only remove entries that point at qualia paths. Leave everything else.
  const isQualiaCommand = (cmd) =>
    typeof cmd === "string" && (cmd.includes("qualia") || cmd.includes(".claude/hooks/") || cmd.includes(".claude/bin/"));

  const filterHookArray = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr
      .map((entry) => {
        if (!entry || !Array.isArray(entry.hooks)) return entry;
        const hooks = entry.hooks.filter((h) => !isQualiaCommand(h && h.command));
        return { ...entry, hooks };
      })
      .filter((entry) => Array.isArray(entry.hooks) && entry.hooks.length > 0);
  };

  if (settings.hooks && typeof settings.hooks === "object") {
    for (const key of ["SessionStart", "PreToolUse", "PreCompact"]) {
      if (settings.hooks[key]) {
        const cleaned = filterHookArray(settings.hooks[key]);
        if (cleaned && cleaned.length > 0) {
          settings.hooks[key] = cleaned;
        } else {
          delete settings.hooks[key];
        }
      }
    }
    // If hooks is now empty, remove it entirely.
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  }

  // Status line — only drop it if it points at our renderer.
  if (settings.statusLine && typeof settings.statusLine === "object") {
    const cmd = settings.statusLine.command || "";
    if (isQualiaCommand(cmd) || cmd.includes("statusline.js") || cmd.includes("qualia-ui")) {
      delete settings.statusLine;
    }
  }

  // Qualia-specific spinner overrides.
  if (settings.spinnerVerbs) delete settings.spinnerVerbs;
  if (settings.spinnerTipsOverride) delete settings.spinnerTipsOverride;

  // Leave settings.env alone — the user may have other env vars in there.

  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    counters.settingsCleaned = true;
  } catch (e) {
    counters.errors.push(`settings.json write: ${e.message}`);
  }
}

async function cmdUninstall() {
  banner();

  const args = process.argv.slice(3);
  const skipConfirm = args.includes("-y") || args.includes("--yes");

  const cfg = readConfig();
  console.log("");
  if (cfg.installed_by) {
    console.log(`  ${DIM}User:${RESET} ${WHITE}${cfg.installed_by}${RESET} ${DIM}(${cfg.role || "?"})${RESET}`);
  } else {
    console.log(`  ${DIM}No Qualia config found at${RESET} ${WHITE}${CONFIG_FILE}${RESET}`);
  }
  console.log("");

  if (!skipConfirm) {
    const confirm = await promptYesNo("Are you sure you want to uninstall the Qualia Framework?", false);
    if (!confirm) {
      console.log("");
      console.log(`  ${DIM}Aborted.${RESET}`);
      console.log("");
      return;
    }
  }

  // Preserve knowledge base by default.
  let preserveKnowledge = true;
  if (!skipConfirm) {
    preserveKnowledge = await promptYesNo(
      "Preserve knowledge base? (your learned patterns, fixes, client prefs)",
      true
    );
  }

  console.log("");
  console.log(`  ${DIM}Removing framework files...${RESET}`);
  console.log("");

  const counters = { filesRemoved: 0, dirsRemoved: 0, settingsCleaned: false, errors: [] };

  // Skills — any directory starting with "qualia" under ~/.claude/skills/.
  const skillsDir = path.join(CLAUDE_DIR, "skills");
  try {
    if (fs.existsSync(skillsDir)) {
      for (const name of fs.readdirSync(skillsDir)) {
        if (name === "qualia" || name.startsWith("qualia-")) {
          safeRmDir(path.join(skillsDir, name), counters);
        }
      }
    }
  } catch (e) {
    counters.errors.push(`skills scan: ${e.message}`);
  }

  // Agents — only the 4 Qualia ones.
  for (const f of QUALIA_AGENT_FILES) {
    safeUnlink(path.join(CLAUDE_DIR, "agents", f), counters);
  }

  // Hooks — only the 8 Qualia ones.
  for (const f of QUALIA_HOOK_FILES) {
    safeUnlink(path.join(CLAUDE_DIR, "hooks", f), counters);
  }

  // Bin scripts — only the 3 Qualia ones.
  for (const f of QUALIA_BIN_FILES) {
    safeUnlink(path.join(CLAUDE_DIR, "bin", f), counters);
  }

  // Rules — all 4.
  for (const f of QUALIA_RULE_FILES) {
    safeUnlink(path.join(CLAUDE_DIR, "rules", f), counters);
  }

  // Templates directory (entire).
  safeRmDir(path.join(CLAUDE_DIR, "qualia-templates"), counters);

  // Knowledge directory (optional preservation).
  if (!preserveKnowledge) {
    safeRmDir(path.join(CLAUDE_DIR, "knowledge"), counters);
  }

  // Config + state files.
  safeUnlink(path.join(CLAUDE_DIR, ".qualia-config.json"), counters);
  safeUnlink(path.join(CLAUDE_DIR, ".qualia-last-update-check"), counters);
  safeUnlink(path.join(CLAUDE_DIR, ".erp-api-key"), counters);
  safeUnlink(path.join(CLAUDE_DIR, ".qualia-team.json"), counters);
  safeUnlink(path.join(CLAUDE_DIR, "qualia-guide.md"), counters);

  // Traces directory.
  safeRmDir(path.join(CLAUDE_DIR, ".qualia-traces"), counters);

  // Clean settings.json surgically.
  cleanSettingsJson(counters);

  // Summary.
  console.log("");
  console.log(`${TEAL}  ⬢ Uninstall complete${RESET}`);
  console.log(`${DIM}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`  ${DIM}Files removed:${RESET}       ${WHITE}${counters.filesRemoved}${RESET}`);
  console.log(`  ${DIM}Directories removed:${RESET} ${WHITE}${counters.dirsRemoved}${RESET}`);
  console.log(
    `  ${DIM}settings.json:${RESET}       ${counters.settingsCleaned ? `${GREEN}cleaned ✓${RESET}` : `${DIM}not present${RESET}`}`
  );
  if (preserveKnowledge) {
    console.log(`  ${DIM}Knowledge base:${RESET}      ${GREEN}preserved ✓${RESET}`);
  } else {
    console.log(`  ${DIM}Knowledge base:${RESET}      ${YELLOW}removed${RESET}`);
  }

  if (counters.errors.length > 0) {
    console.log("");
    console.log(`  ${YELLOW}${counters.errors.length} warning(s):${RESET}`);
    for (const err of counters.errors.slice(0, 5)) {
      console.log(`    ${DIM}${err}${RESET}`);
    }
  }

  console.log("");
  console.log(
    `  ${YELLOW}Manual step:${RESET} edit ${WHITE}~/.claude/CLAUDE.md${RESET} to remove the Qualia Framework section if desired.`
  );
  console.log("");
}

// ─── Team Management ────────────────────────────────────
// External team file at ~/.claude/.qualia-team.json.
// Falls back to embedded defaults in install.js.

function getDefaultTeam() {
  return {
    "QS-FAWZI-01": { name: "Fawzi Goussous", role: "OWNER", description: "Company owner. Full access. Can push to main, approve deploys, edit secrets." },
    "QS-HASAN-02": { name: "Hasan", role: "EMPLOYEE", description: "Developer. Feature branches only. Cannot push to main or edit .env files." },
    "QS-MOAYAD-03": { name: "Moayad", role: "EMPLOYEE", description: "Developer. Feature branches only. Cannot push to main or edit .env files." },
    "QS-RAMA-04": { name: "Rama", role: "EMPLOYEE", description: "Developer. Feature branches only. Cannot push to main or edit .env files." },
    "QS-SALLY-05": { name: "Sally", role: "EMPLOYEE", description: "Developer. Feature branches only. Cannot push to main or edit .env files." },
  };
}

function readTeamFile() {
  const teamFile = path.join(CLAUDE_DIR, ".qualia-team.json");
  try {
    if (fs.existsSync(teamFile)) {
      const data = JSON.parse(fs.readFileSync(teamFile, "utf8"));
      if (data && typeof data === "object" && Object.keys(data).length > 0) return data;
    }
  } catch {}
  return null;
}

function writeTeamFile(team) {
  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CLAUDE_DIR, ".qualia-team.json"), JSON.stringify(team, null, 2) + "\n");
}

function parseTeamArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--code" && argv[i + 1]) { args.code = argv[++i]; }
    else if (argv[i] === "--name" && argv[i + 1]) { args.name = argv[++i]; }
    else if (argv[i] === "--role" && argv[i + 1]) { args.role = argv[++i].toUpperCase(); }
  }
  return args;
}

function cmdTeam() {
  const sub = process.argv[3];

  switch (sub) {
    case "list": {
      banner();
      console.log("");
      const team = readTeamFile();
      const source = team || getDefaultTeam();
      const label = team ? "team file" : "embedded defaults";
      console.log(`  ${DIM}Source: ${label}${RESET}`);
      console.log("");
      for (const [code, member] of Object.entries(source)) {
        const roleColor = member.role === "OWNER" ? TEAL : WHITE;
        console.log(`  ${WHITE}${code}${RESET}  ${roleColor}${member.role}${RESET}  ${DIM}${member.name}${RESET}`);
      }
      console.log("");
      break;
    }

    case "add": {
      const args = parseTeamArgs(process.argv.slice(4));
      if (!args.code || !args.name) {
        console.log(`  ${RED}Usage:${RESET} qualia-framework team add --code QS-NAME-NN --name "Full Name" [--role EMPLOYEE|OWNER]`);
        process.exit(1);
      }
      const team = readTeamFile() || getDefaultTeam();
      const code = args.code.toUpperCase();
      const role = args.role || "EMPLOYEE";
      team[code] = {
        name: args.name,
        role,
        description: role === "OWNER"
          ? "Company owner. Full access. Can push to main, approve deploys, edit secrets."
          : "Developer. Feature branches only. Cannot push to main or edit .env files.",
      };
      writeTeamFile(team);
      console.log(`  ${GREEN}+${RESET} ${WHITE}${code}${RESET} ${DIM}(${args.name}, ${role})${RESET}`);
      break;
    }

    case "remove": {
      const code = (process.argv[4] || "").toUpperCase();
      if (!code) {
        console.log(`  ${RED}Usage:${RESET} qualia-framework team remove QS-NAME-NN`);
        process.exit(1);
      }
      const team = readTeamFile();
      if (!team || !team[code]) {
        console.log(`  ${YELLOW}!${RESET} ${code} not found in team file.`);
        process.exit(1);
      }
      delete team[code];
      writeTeamFile(team);
      console.log(`  ${RED}-${RESET} ${WHITE}${code}${RESET} removed`);
      break;
    }

    default:
      console.log(`  ${RED}Usage:${RESET} qualia-framework team <list|add|remove>`);
      process.exit(1);
  }
}

// ─── Traces ─────────────────────────────────────────────

function cmdTraces() {
  banner();
  console.log("");
  const tracesDir = path.join(CLAUDE_DIR, ".qualia-traces");
  if (!fs.existsSync(tracesDir)) {
    console.log(`  ${DIM}No traces found. Traces are written by hooks during normal operation.${RESET}`);
    console.log("");
    return;
  }
  const files = fs.readdirSync(tracesDir).filter((f) => f.endsWith(".jsonl")).sort().reverse();
  if (files.length === 0) {
    console.log(`  ${DIM}No trace files found.${RESET}`);
    console.log("");
    return;
  }
  const latest = path.join(tracesDir, files[0]);
  const lines = fs.readFileSync(latest, "utf8").trim().split("\n").slice(-20);
  console.log(`  ${WHITE}Recent traces${RESET} ${DIM}(${files[0]})${RESET}`);
  console.log("");
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const color = e.result === "block" ? RED : e.result === "allow" ? GREEN : DIM;
      const time = (e.timestamp || "").split("T")[1] || "";
      const ts = time.split(".")[0] || "";
      console.log(`  ${DIM}${ts}${RESET}  ${color}${e.result}${RESET}  ${WHITE}${e.hook}${RESET}  ${DIM}${e.duration_ms || 0}ms${RESET}`);
    } catch {}
  }
  console.log("");
}

// ─── Migrate ────────────────────────────────────────────

function cmdMigrate() {
  banner();
  console.log("");

  const settingsPath = path.join(CLAUDE_DIR, "settings.json");
  if (!fs.existsSync(settingsPath)) {
    console.log(`  ${RED}✗${RESET} No settings.json found. Run ${TEAL}qualia-framework install${RESET} first.`);
    console.log("");
    process.exit(1);
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (e) {
    console.log(`  ${RED}✗${RESET} Failed to parse settings.json: ${e.message}`);
    process.exit(1);
  }

  const cfg = readConfig();
  const fromVersion = cfg.version || "unknown";
  let changes = 0;

  console.log(`  ${DIM}Current version:${RESET} ${WHITE}${fromVersion}${RESET}`);
  console.log(`  ${DIM}Target version:${RESET}  ${WHITE}${PKG.version}${RESET}`);
  console.log("");

  // 1. Ensure all 8 hooks are wired (v2 missed block-env-edit and branch-guard)
  const hd = path.join(CLAUDE_DIR, "hooks");
  const nodeCmd = (hookFile) => `node "${path.join(hd, hookFile)}"`;

  if (!settings.hooks) settings.hooks = {};

  // Check SessionStart hooks
  if (!settings.hooks.SessionStart || !Array.isArray(settings.hooks.SessionStart)) {
    settings.hooks.SessionStart = [{ matcher: ".*", hooks: [{ type: "command", command: nodeCmd("session-start.js"), timeout: 5 }] }];
    changes++;
    console.log(`  ${GREEN}+${RESET} Added SessionStart hook`);
  }

  // Check PreToolUse hooks — ensure all critical hooks are present
  const requiredBashHooks = ["auto-update.js", "branch-guard.js", "pre-push.js", "pre-deploy-gate.js"];
  const requiredEditHooks = ["block-env-edit.js", "migration-guard.js"];

  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

  // Find or create Bash matcher entry
  let bashEntry = settings.hooks.PreToolUse.find(e => e.matcher === "Bash");
  if (!bashEntry) {
    bashEntry = { matcher: "Bash", hooks: [] };
    settings.hooks.PreToolUse.push(bashEntry);
  }
  if (!bashEntry.hooks) bashEntry.hooks = [];

  for (const hookFile of requiredBashHooks) {
    const cmd = nodeCmd(hookFile);
    const exists = bashEntry.hooks.some(h => h.command && h.command.includes(hookFile));
    if (!exists) {
      const hookDef = { type: "command", command: cmd, timeout: hookFile === "pre-deploy-gate.js" ? 180 : 5 };
      if (hookFile === "branch-guard.js") hookDef.if = "Bash(git push*)";
      if (hookFile === "pre-push.js") { hookDef.if = "Bash(git push*)"; hookDef.timeout = 15; }
      if (hookFile === "pre-deploy-gate.js") hookDef.if = "Bash(vercel --prod*)";
      bashEntry.hooks.push(hookDef);
      changes++;
      console.log(`  ${GREEN}+${RESET} Wired ${hookFile} into PreToolUse/Bash`);
    }
  }

  // Find or create Edit|Write matcher entry
  let editEntry = settings.hooks.PreToolUse.find(e => e.matcher === "Edit|Write");
  if (!editEntry) {
    editEntry = { matcher: "Edit|Write", hooks: [] };
    settings.hooks.PreToolUse.push(editEntry);
  }
  if (!editEntry.hooks) editEntry.hooks = [];

  for (const hookFile of requiredEditHooks) {
    const cmd = nodeCmd(hookFile);
    const exists = editEntry.hooks.some(h => h.command && h.command.includes(hookFile));
    if (!exists) {
      const hookDef = { type: "command", command: cmd, timeout: hookFile === "migration-guard.js" ? 10 : 5 };
      if (hookFile === "migration-guard.js") hookDef.if = "Edit(*migration*)|Write(*migration*)|Edit(*.sql)|Write(*.sql)";
      editEntry.hooks.push(hookDef);
      changes++;
      console.log(`  ${GREEN}+${RESET} Wired ${hookFile} into PreToolUse/Edit|Write`);
    }
  }

  // Check PreCompact hook
  if (!settings.hooks.PreCompact) {
    settings.hooks.PreCompact = [{ matcher: "compact", hooks: [{ type: "command", command: nodeCmd("pre-compact.js"), timeout: 15 }] }];
    changes++;
    console.log(`  ${GREEN}+${RESET} Added PreCompact hook`);
  }

  // 2. Ensure env vars are up to date
  if (!settings.env) settings.env = {};
  const requiredEnv = {
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0",
    MAX_MCP_OUTPUT_TOKENS: "25000",
    CLAUDE_CODE_NO_FLICKER: "1",
  };
  for (const [k, v] of Object.entries(requiredEnv)) {
    if (settings.env[k] !== v) {
      settings.env[k] = v;
      changes++;
      console.log(`  ${GREEN}+${RESET} Set env.${k}`);
    }
  }

  // 3. Update status line if missing
  if (!settings.statusLine) {
    settings.statusLine = { type: "command", command: `node "${path.join(CLAUDE_DIR, "bin", "statusline.js")}"` };
    changes++;
    console.log(`  ${GREEN}+${RESET} Added status line`);
  }

  // 4. Update config version
  cfg.version = PKG.version;
  cfg.migrated_at = new Date().toISOString().split("T")[0];
  writeConfig(cfg);

  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");

  console.log("");
  if (changes === 0) {
    console.log(`  ${GREEN}✓${RESET} Already up to date — no migration needed.`);
  } else {
    console.log(`  ${GREEN}✓${RESET} Applied ${WHITE}${changes}${RESET} changes. Restart Claude Code to take effect.`);
  }
  console.log("");
}

// ─── Analytics ──────────────────────────────────────────

function cmdAnalytics() {
  banner();
  console.log("");

  const tracesDir = path.join(CLAUDE_DIR, ".qualia-traces");
  if (!fs.existsSync(tracesDir)) {
    console.log(`  ${DIM}No traces found. Analytics require hook telemetry data.${RESET}`);
    console.log(`  ${DIM}Traces are collected automatically during normal framework use.${RESET}`);
    console.log("");
    return;
  }

  const files = fs.readdirSync(tracesDir).filter(f => f.endsWith(".jsonl")).sort();
  if (files.length === 0) {
    console.log(`  ${DIM}No trace data yet.${RESET}`);
    console.log("");
    return;
  }

  // Parse all traces
  const traces = [];
  for (const file of files) {
    const lines = fs.readFileSync(path.join(tracesDir, file), "utf8").trim().split("\n");
    for (const line of lines) {
      try { traces.push(JSON.parse(line)); } catch {}
    }
  }

  // Aggregate stats
  const hookStats = {};
  let totalBlocks = 0;
  let totalAllows = 0;
  let totalDuration = 0;

  for (const t of traces) {
    const hook = t.hook || "unknown";
    if (!hookStats[hook]) hookStats[hook] = { allow: 0, block: 0, total_ms: 0 };
    if (t.result === "block") { hookStats[hook].block++; totalBlocks++; }
    else { hookStats[hook].allow++; totalAllows++; }
    hookStats[hook].total_ms += t.duration_ms || 0;
    totalDuration += t.duration_ms || 0;
  }

  // Verification outcomes (from traces that include verification data)
  const verifications = traces.filter(t => t.hook === "state-transition" && t.extra && t.extra.verification);
  const passes = verifications.filter(t => t.extra.verification === "pass").length;
  const fails = verifications.filter(t => t.extra.verification === "fail").length;

  // Gap cycle data
  const gapTraces = traces.filter(t => t.hook === "state-transition" && t.extra && t.extra.gap_closure);
  const totalGapCycles = gapTraces.length;

  // Display
  console.log(`  ${WHITE}Framework Analytics${RESET}`);
  console.log(`  ${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log("");
  console.log(`  ${WHITE}Overview${RESET}`);
  console.log(`  ${DIM}Trace files:${RESET}       ${WHITE}${files.length}${RESET} ${DIM}(${files[0]} → ${files[files.length - 1]})${RESET}`);
  console.log(`  ${DIM}Total events:${RESET}      ${WHITE}${traces.length}${RESET}`);
  console.log(`  ${DIM}Total blocks:${RESET}      ${RED}${totalBlocks}${RESET}`);
  console.log(`  ${DIM}Total allows:${RESET}      ${GREEN}${totalAllows}${RESET}`);
  console.log(`  ${DIM}Avg hook time:${RESET}     ${WHITE}${traces.length ? Math.round(totalDuration / traces.length) : 0}ms${RESET}`);
  console.log("");

  // Verification stats
  if (passes + fails > 0) {
    const rate = Math.round((passes / (passes + fails)) * 100);
    console.log(`  ${WHITE}Verification Outcomes${RESET}`);
    console.log(`  ${DIM}First-pass rate:${RESET}   ${rate >= 70 ? GREEN : rate >= 50 ? YELLOW : RED}${rate}%${RESET} ${DIM}(${passes} pass / ${fails} fail)${RESET}`);
    console.log(`  ${DIM}Gap cycles:${RESET}        ${WHITE}${totalGapCycles}${RESET}`);
    console.log("");
  }

  // Per-hook breakdown
  console.log(`  ${WHITE}Per-Hook Breakdown${RESET}`);
  const sorted = Object.entries(hookStats).sort((a, b) => (b[1].allow + b[1].block) - (a[1].allow + a[1].block));
  for (const [hook, stats] of sorted) {
    const total = stats.allow + stats.block;
    const avg = Math.round(stats.total_ms / total);
    const blockRate = stats.block > 0 ? ` ${RED}${stats.block} blocked${RESET}` : "";
    console.log(`  ${DIM}${hook}:${RESET} ${WHITE}${total}${RESET} calls, ${DIM}avg ${avg}ms${RESET}${blockRate}`);
  }
  console.log("");
}

function cmdHelp() {
  banner();
  console.log("");
  console.log(`  ${WHITE}Commands:${RESET}`);
  console.log(`    qualia-framework ${TEAL}install${RESET}      Install or reinstall the framework`);
  console.log(`    qualia-framework ${TEAL}update${RESET}       Update to the latest version`);
  console.log(`    qualia-framework ${TEAL}version${RESET}      Show installed version + check for updates`);
  console.log(`    qualia-framework ${TEAL}uninstall${RESET}    Clean removal from ~/.claude/ (${DIM}-y to skip prompts${RESET})`);
  console.log(`    qualia-framework ${TEAL}migrate${RESET}      Migrate settings from v2 to v3`);
  console.log(`    qualia-framework ${TEAL}team${RESET}         Manage team members (${DIM}list|add|remove${RESET})`);
  console.log(`    qualia-framework ${TEAL}traces${RESET}       View recent hook telemetry`);
  console.log(`    qualia-framework ${TEAL}analytics${RESET}    Show outcome scoring & gap cycle stats`);
  console.log("");
  console.log(`  ${WHITE}After install:${RESET}`);
  console.log(`    ${TG}/qualia${RESET}          What should I do next?`);
  console.log(`    ${TG}/qualia-new${RESET}      Set up a new project`);
  console.log(`    ${TG}/qualia-plan${RESET}     Plan a phase`);
  console.log(`    ${TG}/qualia-build${RESET}    Build it (parallel tasks)`);
  console.log(`    ${TG}/qualia-verify${RESET}   Verify it works`);
  console.log(`    ${TG}/qualia-design${RESET}   One-shot design fix`);
  console.log(`    ${TG}/qualia-debug${RESET}    Structured debugging`);
  console.log(`    ${TG}/qualia-review${RESET}   Production audit`);
  console.log(`    ${TG}/qualia-ship${RESET}     Deploy to production`);
  console.log(`    ${TG}/qualia-report${RESET}   Log your work`);
  console.log("");
}


// ─── Main ────────────────────────────────────────────────
const cmd = process.argv[2];

switch (cmd) {
  case "install":
    cmdInstall();
    break;
  case "version":
  case "-v":
  case "--version":
    cmdVersion();
    break;
  case "update":
  case "upgrade":
    cmdUpdate();
    break;
  case "uninstall":
  case "remove":
    cmdUninstall().catch((e) => {
      console.error(`${RED}  ✗ Uninstall failed: ${e.message}${RESET}`);
      process.exit(1);
    });
    break;
  case "team":
    cmdTeam();
    break;
  case "traces":
    cmdTraces();
    break;
  case "migrate":
    cmdMigrate();
    break;
  case "analytics":
  case "stats":
    cmdAnalytics();
    break;
  default:
    cmdHelp();
}
