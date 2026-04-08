#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

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
    const latest = execSync("npm view qualia-framework-v2 version 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
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
    // Pull latest and reinstall with saved code
    execSync(
      `npx qualia-framework-v2@latest install <<< "${cfg.code}"`,
      { stdio: "inherit", shell: true, timeout: 60000 }
    );
  } catch (e) {
    console.log(`  ${RED}✗${RESET} Update failed. Run manually: npx qualia-framework-v2@latest install`);
    process.exit(1);
  }
}

function cmdHelp() {
  banner();
  console.log("");
  console.log(`  ${WHITE}Commands:${RESET}`);
  console.log(`    npx qualia-framework-v2 ${TEAL}install${RESET}     Install or reinstall the framework`);
  console.log(`    npx qualia-framework-v2 ${TEAL}update${RESET}      Update to the latest version`);
  console.log(`    npx qualia-framework-v2 ${TEAL}version${RESET}     Show installed version + check for updates`);
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
  default:
    cmdHelp();
}
