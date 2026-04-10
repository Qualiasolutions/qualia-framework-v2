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
  console.log(`  ${TEAL}${BOLD}◆${RESET} ${WHITE}${BOLD}Qualia Framework${RESET} ${DIM}v${PKG.version}${RESET}`);
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
    const r = spawnSync("npm", ["view", "qualia-framework-v2", "version"], {
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
      console.log(`  ${DIM}Run:${RESET} npx qualia-framework-v2 update`);
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
    const r = spawnSync("npx", ["qualia-framework-v2@latest", "install"], {
      input: cfg.code + "\n",
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",  // npx is a .cmd shim on Windows — must go through shell
      timeout: 120000,
      encoding: "utf8",
    });
    if (r.status !== 0) {
      console.log(`  ${RED}✗${RESET} Update failed. Run manually: npx qualia-framework-v2@latest install`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`  ${RED}✗${RESET} Update failed: ${e.message}`);
    console.log(`  ${DIM}Run manually:${RESET} npx qualia-framework-v2@latest install`);
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
  safeUnlink(path.join(CLAUDE_DIR, "qualia-guide.md"), counters);

  // Clean settings.json surgically.
  cleanSettingsJson(counters);

  // Summary.
  console.log("");
  console.log(`${TEAL}  ◆ Uninstall complete${RESET}`);
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

function cmdHelp() {
  banner();
  console.log("");
  console.log(`  ${WHITE}Commands:${RESET}`);
  console.log(`    npx qualia-framework-v2 ${TEAL}install${RESET}     Install or reinstall the framework`);
  console.log(`    npx qualia-framework-v2 ${TEAL}update${RESET}      Update to the latest version`);
  console.log(`    npx qualia-framework-v2 ${TEAL}version${RESET}     Show installed version + check for updates`);
  console.log(`    npx qualia-framework-v2 ${TEAL}uninstall${RESET}   Clean removal from ~/.claude/ (${DIM}-y to skip prompts${RESET})`);
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
  default:
    cmdHelp();
}
