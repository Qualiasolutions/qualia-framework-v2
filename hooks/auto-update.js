#!/usr/bin/env node
// ~/.claude/hooks/auto-update.js — daily silent update check in the background.
// PreToolUse hook on every Bash tool call. Fast path: single stat() call that
// returns immediately if last check was <24h ago. Cross-platform.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const _traceStart = Date.now();

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const CACHE_FILE = path.join(CLAUDE_DIR, ".qualia-last-update-check");
const CONFIG_FILE = path.join(CLAUDE_DIR, ".qualia-config.json");
const LOCK_FILE = path.join(CLAUDE_DIR, ".qualia-updating");
const NOTIF_FILE = path.join(CLAUDE_DIR, ".qualia-update-available.json");
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

  // Synchronously fetch the latest version from npm. Tight timeout so the hook
  // never blocks Claude Code for long. The cache timestamp is written ONLY if
  // this fetch succeeds — otherwise the next session retries (no 24h blackout
  // when the network is unreachable).
  let latest = "";
  try {
    fs.writeFileSync(LOCK_FILE, String(process.pid));
    const r = spawnSync("npm", ["view", "qualia-framework", "version"], {
      encoding: "utf8",
      timeout: 3000,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "ignore"],
    });
    latest = ((r.stdout || "").trim());
  } catch {}
  try { fs.unlinkSync(LOCK_FILE); } catch {}

  if (!latest) {
    // Fetch failed — leave cache untouched so the next call retries.
    _trace("auto-update", "allow", { reason: "npm-fetch-failed" });
    process.exit(0);
  }

  // Successful fetch — debounce future checks for 24h.
  fs.writeFileSync(CACHE_FILE, String(Math.floor(Date.now() / 1000)));

  const cmp = (a, b) => {
    const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i]||0) > (pb[i]||0)) return 1;
      if ((pa[i]||0) < (pb[i]||0)) return -1;
    }
    return 0;
  };

  if (cmp(latest, cfg.version) > 0) {
    // Update available — write a sticky notification file for ALL roles.
    // session-start.js renders a banner every session until the user runs
    // `npx qualia-framework update` manually. We do NOT auto-install during
    // a live Claude Code session because install rewrites ~/.claude/settings.json
    // and can corrupt the running session.
    try {
      fs.writeFileSync(NOTIF_FILE, JSON.stringify({
        current: cfg.version,
        latest: latest,
        detected_at: new Date().toISOString(),
      }, null, 2));
    } catch {}
    // Invalidate the session-start health cache so the next session re-checks
    // whether new critical files shipped in the latest version are installed.
    try {
      fs.unlinkSync(path.join(CLAUDE_DIR, ".qualia-install-health.json"));
    } catch {}
    _trace("auto-update", "allow", { reason: "notification-written", current: cfg.version, latest });
  } else {
    // Already up to date — clear any stale notification file.
    try { fs.unlinkSync(NOTIF_FILE); } catch {}
    _trace("auto-update", "allow", { reason: "up-to-date", version: cfg.version });
  }
} catch {
  // Silent — never block the tool call
}

process.exit(0);
