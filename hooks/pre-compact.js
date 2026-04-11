#!/usr/bin/env node
// ~/.claude/hooks/pre-compact.js — commit STATE.md before context compaction.
// PreCompact hook. Silent on failure — context compaction must never be blocked.
// Cross-platform (Windows/macOS/Linux).

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const _traceStart = Date.now();

const STATE_FILE = path.join(".planning", "STATE.md");

try {
  if (fs.existsSync(STATE_FILE)) {
    console.log("QUALIA: Saving state before compaction...");
    // Check if STATE.md has uncommitted changes
    const diff = spawnSync("git", ["diff", "--name-only", STATE_FILE], {
      encoding: "utf8",
      timeout: 3000,
    });
    if ((diff.stdout || "").includes("STATE.md")) {
      spawnSync("git", ["add", STATE_FILE], { timeout: 3000 });
      spawnSync("git", ["commit", "-m", "state: pre-compaction save"], {
        timeout: 5000,
        stdio: "ignore",
      });
    }
  }
} catch {
  // Silent — never block compaction
}

function _trace(hookName, result, extra) {
  try {
    const os = require("os");
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

_trace("pre-compact", "allow");
process.exit(0);
