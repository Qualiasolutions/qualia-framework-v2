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

const HOME = os.homedir();
const UI = path.join(HOME, ".claude", "bin", "qualia-ui.js");
const STATE_FILE = path.join(".planning", "STATE.md");
const CONTINUE_HERE = ".continue-here.md";

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

try {
  if (!fs.existsSync(UI)) {
    fallbackText();
  } else if (fs.existsSync(STATE_FILE)) {
    runUi("banner", "router");
    const next = getNextCommand();
    if (next) runUi("info", `Run ${next} to continue`);
  } else if (fs.existsSync(CONTINUE_HERE)) {
    runUi("banner", "router");
    runUi("warn", "Handoff found — read .continue-here.md to resume");
  } else {
    runUi("banner", "router");
    runUi("info", "No project detected. Run /qualia-new to start.");
  }
} catch {
  // Deliberately silent — hook must never fail
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
