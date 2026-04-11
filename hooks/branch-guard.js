#!/usr/bin/env node
// ~/.claude/hooks/branch-guard.js — block non-OWNER push to main/master.
// PreToolUse hook on `git push*` commands. Reads role from
// ~/.claude/.qualia-config.json (single source of truth).
// Exits 1 to BLOCK. Exits 0 to allow.
// Cross-platform (Windows/macOS/Linux).

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const _traceStart = Date.now();

const CONFIG = path.join(os.homedir(), ".claude", ".qualia-config.json");

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

function fail(msg) {
  console.log(msg);
  _trace("branch-guard", "block", { reason: msg });
  process.exit(2);
}

let role = "";
try {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  role = cfg.role || "";
} catch {
  fail(`BLOCKED: ${CONFIG} missing or unreadable. Run: npx qualia-framework-v2 install`);
}

if (!role) {
  fail(`BLOCKED: Cannot determine role from ${CONFIG}. Defaulting to deny.`);
}

// Ask git for the current branch --show-current. Works identically on Windows/macOS/Linux.
const r = spawnSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
  timeout: 3000,
});
const branch = ((r.stdout || "").trim());

if (branch === "main" || branch === "master") {
  if (role !== "OWNER") {
    console.log(`BLOCKED: Employees cannot push to ${branch}. Create a feature branch first.`);
    console.log("Run: git checkout -b feature/your-feature-name");
    _trace("branch-guard", "block", { reason: `non-owner push to ${branch}` });
    process.exit(2);
  }
}

_trace("branch-guard", "allow");
process.exit(0);
