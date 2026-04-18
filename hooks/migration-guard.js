#!/usr/bin/env node
// ~/.claude/hooks/migration-guard.js — catch dangerous SQL patterns in migrations.
// PreToolUse hook on Edit/Write tool calls. Reads tool input as JSON on stdin.
// Exits 2 to BLOCK. Exits 0 to allow.
// Cross-platform (Windows/macOS/Linux).

const fs = require("fs");

const _traceStart = Date.now();

// Read JSON tool input from stdin with a safety timeout.
// On Windows, fs.readFileSync(0) can hang if stdin isn't closed by the host.
// We loop fs.readSync with a 1s deadline; if no data arrives, treat as empty.
// Between EAGAIN retries we sleep via Atomics.wait to avoid CPU-burning spin.
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {}
}
function readInput() {
  const deadline = Date.now() + 1000;
  const buf = Buffer.alloc(65536);
  let data = "";
  try {
    while (Date.now() < deadline) {
      let n = 0;
      try {
        n = fs.readSync(0, buf, 0, buf.length, null);
      } catch (e) {
        // EAGAIN/EWOULDBLOCK: no data yet. Sleep 1ms and retry until deadline.
        if (e && (e.code === "EAGAIN" || e.code === "EWOULDBLOCK")) { sleepSync(1); continue; }
        // Any other read error: bail
        break;
      }
      if (n === 0) break; // EOF
      data += buf.slice(0, n).toString("utf8");
    }
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}

const input = readInput();
const ti = input.tool_input || {};
const file = String(ti.file_path || "").replace(/\\/g, "/");

// For Edit tool calls, dangerous SQL might live in old_string OR new_string.
// Concatenate both sides of the delta plus any full content payload so we
// scan everything that could reach disk.
const content = [ti.old_string, ti.new_string, ti.content]
  .filter((v) => v != null)
  .map((v) => String(v))
  .join("\n");

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
    const filePath = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(filePath, JSON.stringify(entry) + "\n");
  } catch {}
}

// Only inspect SQL files or files that live inside a migrations/ directory.
// Prior regex was over-broad (matched MigrationModal.tsx, migrations.md, etc.).
if (!/(^|\/)migrations?\//i.test(file) && !/\.sql$/i.test(file)) {
  _trace("migration-guard", "allow", { reason: "non-migration file" });
  process.exit(0);
}

// Strip SQL comments before pattern matching so rolled-back/explanatory
// statements inside `-- ...` line comments or `/* ... */` block comments
// don't trigger false positives.
function stripSqlComments(src) {
  // Remove /* ... */ block comments (non-greedy, multi-line).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove -- line comments (to end of line).
  out = out.replace(/--[^\n\r]*/g, "");
  return out;
}

const scan = stripSqlComments(content);

const errors = [];

// DROP TABLE without IF EXISTS
if (/DROP\s+TABLE/i.test(scan) && !/IF\s+EXISTS/i.test(scan)) {
  errors.push("DROP TABLE without IF EXISTS");
}

// DROP DATABASE — almost never appropriate in app migrations
if (/DROP\s+DATABASE/i.test(scan)) {
  errors.push("DROP DATABASE detected — refuse unless explicitly approved");
}

// DROP SCHEMA — destructive, especially with CASCADE
if (/DROP\s+SCHEMA/i.test(scan)) {
  errors.push("DROP SCHEMA detected — refuse unless explicitly approved");
}

// ALTER TABLE ... DROP COLUMN — destructive schema change
if (/ALTER\s+TABLE\s+[^;]*\bDROP\s+COLUMN\b/i.test(scan)) {
  errors.push("ALTER TABLE ... DROP COLUMN is destructive");
}

// DELETE / UPDATE without WHERE — check per-statement, not file-global.
// Previously a file containing "DELETE FROM foo;" followed by any later
// "... WHERE ..." (in a SELECT, JOIN, etc.) would pass the check.
function splitStatements(src) {
  return src.split(/;/g).map((s) => s.trim()).filter(Boolean);
}
const statements = splitStatements(scan);
for (const stmt of statements) {
  if (/^\s*DELETE\s+FROM\b/i.test(stmt) && !/\bWHERE\b/i.test(stmt)) {
    errors.push("DELETE FROM without WHERE clause");
    break;
  }
}
for (const stmt of statements) {
  if (/^\s*UPDATE\s+\w+(?:\.\w+)?\s+SET\b/i.test(stmt) && !/\bWHERE\b/i.test(stmt)) {
    errors.push("UPDATE without WHERE clause — affects every row");
    break;
  }
}

// TRUNCATE (almost always wrong in migrations)
if (/TRUNCATE/i.test(scan)) {
  errors.push("TRUNCATE detected — are you sure?");
}

// GRANT ... TO PUBLIC — privilege leak
if (/GRANT\s+[^;]*\bTO\s+PUBLIC\b/i.test(scan)) {
  errors.push("GRANT ... TO PUBLIC detected — privilege leak");
}

// CREATE TABLE without RLS — but skip TEMP/TEMPORARY tables and partitions.
// Strategy: enumerate CREATE TABLE statements, drop the ones that don't need RLS,
// then if any "real" CREATE TABLE remains, require ENABLE ROW LEVEL SECURITY.
const createTableMatches = scan.match(/CREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:TEMP|TEMPORARY|UNLOGGED)?\s*TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[^;]*/gi) || [];
const realCreateTables = createTableMatches.filter((stmt) => {
  // Skip TEMP/TEMPORARY tables — they're session-scoped, no RLS needed.
  if (/CREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:TEMP|TEMPORARY)\b/i.test(stmt)) return false;
  // Skip partition tables — RLS lives on the parent table.
  if (/\bPARTITION\s+OF\b/i.test(stmt)) return false;
  return true;
});
if (realCreateTables.length > 0 && !/ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(scan)) {
  errors.push("CREATE TABLE without ENABLE ROW LEVEL SECURITY");
}

if (errors.length > 0) {
  console.log("⬢ Migration guard — dangerous patterns found:");
  for (const e of errors) {
    console.log(`  ✗ ${e}`);
  }
  console.log("");
  console.log("Fix these before proceeding. If intentional, ask Fawzi to approve.");
  _trace("migration-guard", "block", { errors });
  process.exit(2);
}

_trace("migration-guard", "allow");
process.exit(0);
