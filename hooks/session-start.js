#!/usr/bin/env node
// ~/.claude/hooks/session-start.js — branded context panel on session start.
// Cross-platform (Windows/macOS/Linux). Zero shell dependencies.
//
// CRITICAL: this hook must NEVER exit non-zero. Claude Code treats any non-zero
// exit from a SessionStart hook as a "hook error" and shows a red banner. The
// banner is purely informational — we'd rather render nothing than block a
// session. Every call is wrapped in try/catch and we always exit 0 at the end.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const _traceStart = Date.now();

// ANSI colors used by the no-project welcome panel. Defined here because this
// file does not import qualia-ui (the hook must run even on a broken install).
const TEAL = "\x1b[38;2;0;206;209m";
const DIM = "\x1b[38;2;80;90;100m";
const RESET = "\x1b[0m";

const HOME = os.homedir();
const UI = path.join(HOME, ".claude", "bin", "qualia-ui.js");
const STATE_FILE = path.join(".planning", "STATE.md");
const CONTINUE_HERE = ".continue-here.md";
const NOTIF_FILE = path.join(HOME, ".claude", ".qualia-update-available.json");
const HEALTH_FILE = path.join(HOME, ".claude", ".qualia-install-health.json");

// Critical files referenced by skills via @-import. If any are missing, skills
// silently get empty context and produce ungrounded output. We spot-check these
// on session-start and write a cached result (1-per-day) to HEALTH_FILE so we
// don't stat on every session.
const CRITICAL_FILES = [
  path.join(HOME, ".claude", "rules", "grounding.md"),
  path.join(HOME, ".claude", "rules", "security.md"),
  path.join(HOME, ".claude", "rules", "frontend.md"),
  path.join(HOME, ".claude", "rules", "deployment.md"),
  path.join(HOME, ".claude", "bin", "state.js"),
];

function checkInstallHealth() {
  // Returns null if healthy, or an array of missing files if damaged.
  // Caches result in HEALTH_FILE for 24h to avoid repeated stat overhead.
  try {
    if (fs.existsSync(HEALTH_FILE)) {
      const cached = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8"));
      const age = Date.now() - (cached.checked_at || 0);
      if (age < 24 * 60 * 60 * 1000) {
        return cached.missing && cached.missing.length ? cached.missing : null;
      }
    }
  } catch {}
  const missing = CRITICAL_FILES.filter((f) => !fs.existsSync(f));
  try {
    fs.writeFileSync(
      HEALTH_FILE,
      JSON.stringify({ checked_at: Date.now(), missing }, null, 2),
    );
  } catch {}
  return missing.length ? missing : null;
}

function runUi(...args) {
  if (!fs.existsSync(UI)) return;
  try {
    spawnSync(process.execPath, [UI, ...args], {
      stdio: "inherit",
      timeout: 3000,
    });
  } catch {}
}

function getNextCommand() {
  const stateJs = path.join(HOME, ".claude", "bin", "state.js");
  if (!fs.existsSync(stateJs)) return "";
  try {
    const r = spawnSync(process.execPath, [stateJs, "check"], {
      encoding: "utf8",
      timeout: 3000,
    });
    if (!r.stdout) return "";
    const j = JSON.parse(r.stdout);
    return j.next_command || "";
  } catch {
    return "";
  }
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(HOME, ".claude", ".qualia-config.json"), "utf8"));
  } catch {
    return {};
  }
}

function fallbackText() {
  // If qualia-ui.js is missing, emit plain text. Keeps the session informative
  // even on a broken install.
  if (fs.existsSync(STATE_FILE)) {
    try {
      const content = fs.readFileSync(STATE_FILE, "utf8");
      const phase = (content.match(/^Phase:\s*(.+)$/m) || [])[1] || "—";
      const status = (content.match(/^Status:\s*(.+)$/m) || [])[1] || "—";
      console.log(`QUALIA: Project loaded. Phase: ${phase.trim()} | Status: ${status.trim()}`);
      console.log("QUALIA: Run /qualia for next step.");
    } catch {
      console.log("QUALIA: Project detected but STATE.md could not be read.");
    }
  } else if (fs.existsSync(CONTINUE_HERE)) {
    console.log("QUALIA: Handoff file found. Read .continue-here.md to resume.");
  } else {
    console.log("QUALIA: No project detected. Run /qualia-new to start.");
  }
}

function maybeRenderUpdateBanner() {
  // EMPLOYEE-only sticky banner. auto-update.js writes NOTIF_FILE when a new
  // version is detected; we render it every session until the user actually
  // runs `npx qualia-framework@latest install`. The file is cleared by
  // auto-update.js once the install completes or the version catches up.
  if (!fs.existsSync(NOTIF_FILE) || !fs.existsSync(UI)) return;
  try {
    const notif = JSON.parse(fs.readFileSync(NOTIF_FILE, "utf8"));
    if (notif && notif.current && notif.latest) {
      runUi("update", notif.current, notif.latest);
    }
  } catch {}
}

function renderHealthWarning(missing) {
  // Loud, non-blocking warning when critical install files are missing.
  // Tells the user exactly what to run — never silent.
  const label = missing.map((f) => path.basename(f)).join(", ");
  if (fs.existsSync(UI)) {
    runUi("warn", `Install incomplete — missing: ${label}`);
    runUi("info", "Run: npx qualia-framework@latest install");
  } else {
    console.log(`QUALIA: Install incomplete — missing ${label}`);
    console.log(`QUALIA: Run: npx qualia-framework@latest install`);
  }
}

try {
  maybeRenderUpdateBanner();

  const healthMissing = checkInstallHealth();
  if (healthMissing) renderHealthWarning(healthMissing);

  if (!fs.existsSync(UI)) {
    fallbackText();
  } else if (fs.existsSync(STATE_FILE)) {
    runUi("banner", "router");
    const next = getNextCommand();
    if (next) {
      console.log("");
      runUi("next", next);
    }
  } else if (fs.existsSync(CONTINUE_HERE)) {
    runUi("banner", "resume");
    runUi("warn", "Previous session found — type /qualia-resume to pick up where you left off");
    console.log("");
  } else {
    // No project — show a welcoming first-run experience
    const config = readConfig();
    const name = config.installed_by || "";
    runUi("banner", "router");
    if (name) {
      console.log(`  ${TEAL}Ready when you are, ${name}.${RESET}`);
    }
    console.log("");
    console.log(`  ${DIM}Start here:${RESET}`);
    console.log(`    ${TEAL}/qualia-new${RESET}    ${DIM}Set up a new project${RESET}`);
    console.log(`    ${TEAL}/qualia${RESET}        ${DIM}What should I do next?${RESET}`);
    console.log(`    ${TEAL}/qualia-quick${RESET}  ${DIM}Quick fix (skip planning)${RESET}`);
    console.log("");
  }
} catch (e) {
  // Hook must never exit non-zero. Log to trace so silent crashes are visible
  // in analytics, but do not print to stderr (would clutter the banner).
  try {
    const traceDir = path.join(os.homedir(), ".claude", ".qualia-traces");
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    const file = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(
      file,
      JSON.stringify({
        hook: "session-start",
        result: "error",
        error: String(e && e.message ? e.message : e),
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
  } catch {}
}

function _trace(hookName, result, extra) {
  try {
    const traceDir = path.join(os.homedir(), ".claude", ".qualia-traces");
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    const entry = {
      hook: hookName,
      result,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - _traceStart,
      ...extra,
    };
    const file = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  } catch {}
}

_trace("session-start", "allow");
process.exit(0);
