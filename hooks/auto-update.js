#!/usr/bin/env node
// ~/.claude/hooks/auto-update.js — daily silent update check in the background.
// PreToolUse hook on every Bash tool call. Fast path: single stat() call that
// returns immediately if last check was <24h ago. Cross-platform.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

const _traceStart = Date.now();

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const CACHE_FILE = path.join(CLAUDE_DIR, ".qualia-last-update-check");
const CONFIG_FILE = path.join(CLAUDE_DIR, ".qualia-config.json");
const LOCK_FILE = path.join(CLAUDE_DIR, ".qualia-updating");
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
    const traceFile = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(traceFile, JSON.stringify(entry) + "\n");
  } catch {}
}

try {
  // Fast path: recently checked
  if (fs.existsSync(CACHE_FILE)) {
    const last = Number(fs.readFileSync(CACHE_FILE, "utf8")) || 0;
    if (Date.now() - last * 1000 < MAX_AGE_MS) {
      _trace("auto-update", "allow", { reason: "recently-checked" });
      process.exit(0);
    }
  }

  // Already updating
  if (fs.existsSync(LOCK_FILE)) {
    _trace("auto-update", "allow", { reason: "already-updating" });
    process.exit(0);
  }

  // Update cache timestamp immediately to debounce concurrent checks
  fs.writeFileSync(CACHE_FILE, String(Math.floor(Date.now() / 1000)));

  // Read current config
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    _trace("auto-update", "allow", { reason: "config-unreadable" });
    process.exit(0);
  }
  if (!cfg.code || !cfg.version) {
    _trace("auto-update", "allow", { reason: "config-incomplete" });
    process.exit(0);
  }

  // Fork the check-and-update into a detached background process so the hook
  // returns immediately and Claude Code is never blocked.
  const script = `
    const fs = require("fs");
    const path = require("path");
    const { spawnSync } = require("child_process");
    const CLAUDE_DIR = ${JSON.stringify(CLAUDE_DIR)};
    const LOCK_FILE = ${JSON.stringify(LOCK_FILE)};
    const CONFIG_FILE = ${JSON.stringify(CONFIG_FILE)};
    const cfg = ${JSON.stringify(cfg)};
    try {
      fs.writeFileSync(LOCK_FILE, String(process.pid));
      const r = spawnSync("npm", ["view", "qualia-framework-v2", "version"], {
        encoding: "utf8",
        timeout: 15000,
        shell: process.platform === "win32",
      });
      const latest = ((r.stdout || "").trim());
      if (!latest) { fs.unlinkSync(LOCK_FILE); process.exit(0); }
      const cmp = (a, b) => {
        const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if ((pa[i]||0) > (pb[i]||0)) return 1;
          if ((pa[i]||0) < (pb[i]||0)) return -1;
        }
        return 0;
      };
      if (cmp(latest, cfg.version) > 0) {
        // Silent update — pipe the install code via stdin
        const child = spawnSync("npx", ["qualia-framework-v2@latest", "install"], {
          input: cfg.code + "\\n",
          timeout: 120000,
          stdio: ["pipe", "ignore", "ignore"],
          shell: process.platform === "win32",
        });
      }
    } catch {}
    try { fs.unlinkSync(LOCK_FILE); } catch {}
  `;

  const child = spawn(process.execPath, ["-e", script], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
} catch {
  // Silent — never block the tool call
}

_trace("auto-update", "allow", { reason: "check-spawned" });
process.exit(0);
