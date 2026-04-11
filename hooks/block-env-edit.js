#!/usr/bin/env node
// ~/.claude/hooks/block-env-edit.js — prevent editing .env files.
// PreToolUse hook on Edit/Write tool calls. Reads tool input as JSON on stdin.
// Exits 2 to BLOCK the tool call. Exits 0 to allow it.
// Cross-platform (Windows/macOS/Linux).

const fs = require("fs");

const _traceStart = Date.now();

function readInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const input = readInput();
const file = (input.tool_input && (input.tool_input.file_path || input.tool_input.command)) || "";

// Match .env, .env.local, .env.production, .env.*, etc.
// Normalize separators so Windows paths (C:\project\.env.local) also match.
const normalized = String(file).replace(/\\/g, "/");

function _trace(hookName, result, extra) {
  try {
    const os = require("os");
    const path = require("path");
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

if (/\.env(\.|$)/.test(normalized)) {
  console.log("BLOCKED: Cannot edit environment files. Ask Fawzi to update secrets.");
  _trace("block-env-edit", "block", { file: normalized });
  process.exit(2);
}

_trace("block-env-edit", "allow");
process.exit(0);
