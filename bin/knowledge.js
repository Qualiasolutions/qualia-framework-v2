#!/usr/bin/env node
// ~/.claude/bin/knowledge.js — unified loader for the memory layer.
//
// Replaces ad-hoc `cat ~/.claude/knowledge/X.md` calls scattered across
// skills. One entry point, deterministic output, every command exits 0 even
// when the requested file is missing (prints "(no entries)" to stdout) so
// skills can pipe the output into prompts without breaking on a fresh install.
//
// Why this exists (v4.1.0 audit finding #3):
// Skills hardcode `cat ~/.claude/knowledge/common-fixes.md`. New knowledge
// files are dead weight — the agent never sees them because the skill never
// references them by name. This loader gives skills ONE call (`knowledge.js`
// with no args prints index.md, the entry point) and lets the agent navigate
// from there. New files reachable from the index get used automatically.
//
// Subcommands:
//   knowledge.js                                   → prints index.md (default)
//   knowledge.js load <file>                       → prints knowledge/<file>
//   knowledge.js list                              → lists all knowledge files
//   knowledge.js search <query>                    → grep across all files
//   knowledge.js append --type <pattern|fix|client> --title <T> --body <B>
//                                                   appends a formatted entry
//   knowledge.js path [<file>]                     → prints absolute path
//
// Cross-platform (Windows/macOS/Linux). No shell dependencies.

const fs = require("fs");
const path = require("path");
const os = require("os");

const KNOWLEDGE_DIR = path.join(os.homedir(), ".claude", "knowledge");
const INDEX_FILE = path.join(KNOWLEDGE_DIR, "index.md");

// Type → filename mapping for `append` and convenience aliases used by the
// existing `/qualia-learn` taxonomy. Keep this list short — every additional
// type needs a corresponding section in index.md.
const TYPE_TO_FILE = {
  pattern: "learned-patterns.md",
  patterns: "learned-patterns.md",
  fix: "common-fixes.md",
  fixes: "common-fixes.md",
  client: "client-prefs.md",
  "client-pref": "client-prefs.md",
  "client-prefs": "client-prefs.md",
  "client-preference": "client-prefs.md",
};

function ensureDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

function readSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// Look up a knowledge file by friendly name. Accepts: "index", "index.md",
// "patterns" (alias), "fixes" (alias), a bare filename, a subdirectory-
// qualified path like "concepts/stripe-checkout", or a name that exists
// inside a known subdirectory. Returns the resolved absolute path (may
// not exist on disk).
//
// Resolution order:
//   1. "index" / "index.md" → top-level index.md
//   2. Known type alias (pattern|fix|client) → mapped top-level filename
//   3. Path with "/" → treat as relative to knowledge dir (concepts/foo)
//   4. Bare name → look in top-level first; if missing, search known
//      subdirectories (concepts/, daily-log/) for an exact match. This
//      means /qualia-flush can write to concepts/voice-agent-call-state.md
//      and skills can later run `knowledge.js load voice-agent-call-state`
//      without knowing it lives in a subdirectory.
function resolveFile(name) {
  if (!name || name === "index" || name === "index.md") return INDEX_FILE;
  const lower = name.toLowerCase();
  if (TYPE_TO_FILE[lower]) {
    return path.join(KNOWLEDGE_DIR, TYPE_TO_FILE[lower]);
  }
  const withExt = name.endsWith(".md") ? name : `${name}.md`;
  // Subdirectory-qualified path: concepts/foo, daily-log/2026-04-26
  if (withExt.includes("/") || withExt.includes(path.sep)) {
    return path.join(KNOWLEDGE_DIR, withExt);
  }
  // Top-level wins if it exists.
  const topLevel = path.join(KNOWLEDGE_DIR, withExt);
  if (fs.existsSync(topLevel)) return topLevel;
  // Otherwise search known subdirectories. Stop at the first match — if
  // multiple subdirs have the same filename, the user should qualify.
  const KNOWN_SUBDIRS = ["concepts", "connections", "daily-log"];
  for (const sub of KNOWN_SUBDIRS) {
    const candidate = path.join(KNOWLEDGE_DIR, sub, withExt);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fall back to top-level (will trigger the "no entries" stub on read).
  return topLevel;
}

function cmdLoad(arg) {
  ensureDir();
  const target = resolveFile(arg);
  if (!fs.existsSync(target)) {
    // Missing file → print a stub message, never fail. Skills can pipe this
    // safely. The instruction line tells the agent what to do next.
    const rel = path.relative(KNOWLEDGE_DIR, target) || "index.md";
    console.log(`(no entries in ${rel} — use /qualia-learn to add one)`);
    process.exit(0);
  }
  process.stdout.write(readSafe(target));
  process.exit(0);
}

function cmdList() {
  ensureDir();
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log("(knowledge layer not initialized — run: npx qualia-framework@latest install)");
    process.exit(0);
  }
  const entries = [];
  for (const f of fs.readdirSync(KNOWLEDGE_DIR)) {
    const p = path.join(KNOWLEDGE_DIR, f);
    let stat;
    try { stat = fs.statSync(p); } catch { continue; }
    if (stat.isDirectory()) {
      // For daily-log/, count entries.
      let count = 0;
      try { count = fs.readdirSync(p).filter((x) => x.endsWith(".md")).length; } catch {}
      entries.push({ name: `${f}/`, size: count, mtime: stat.mtimeMs, kind: "dir" });
    } else if (f.endsWith(".md")) {
      entries.push({ name: f, size: stat.size, mtime: stat.mtimeMs, kind: "file" });
    }
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const sizeStr = e.kind === "dir" ? `${e.size} entries` : `${e.size}B`;
    const date = new Date(e.mtime).toISOString().split("T")[0];
    console.log(`${e.name.padEnd(28)} ${sizeStr.padEnd(14)} ${date}`);
  }
  process.exit(0);
}

function cmdSearch(query) {
  ensureDir();
  if (!query) {
    console.error("Usage: knowledge.js search <query>");
    process.exit(1);
  }
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log("(knowledge layer not initialized)");
    process.exit(0);
  }
  const needle = query.toLowerCase();
  const matches = [];
  function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!f.name.endsWith(".md")) continue;
      const lines = readSafe(p).split("\n");
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(needle)) {
          const rel = path.relative(KNOWLEDGE_DIR, p);
          matches.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
  walk(KNOWLEDGE_DIR);
  if (matches.length === 0) {
    console.log(`(no matches for "${query}")`);
  } else {
    for (const m of matches) console.log(m);
  }
  process.exit(0);
}

// Parse minimal --flag value pairs from argv. Stops at the first positional
// argument, returns { flags: { type: "pattern", title: "X" }, rest: [...] }.
function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      rest.push(a);
    }
  }
  return { flags, rest };
}

function cmdAppend(rawArgs) {
  ensureDir();
  const { flags } = parseFlags(rawArgs);
  const type = String(flags.type || "").toLowerCase();
  const title = String(flags.title || "").trim();
  const body = String(flags.body || "").trim();
  const project = String(flags.project || "general").trim();
  const context = String(flags.context || "").trim();

  if (!type || !TYPE_TO_FILE[type]) {
    console.error(`append: --type must be one of: ${Object.keys(TYPE_TO_FILE).filter((k) => !k.includes("-")).join(", ")}`);
    process.exit(1);
  }
  if (!title) {
    console.error("append: --title is required");
    process.exit(1);
  }
  if (!body) {
    console.error("append: --body is required");
    process.exit(1);
  }

  const dest = path.join(KNOWLEDGE_DIR, TYPE_TO_FILE[type]);

  // 8-char hex id, ISO date.
  const id = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const date = new Date().toISOString().split("T")[0];
  const entry = [
    "",
    "---",
    "",
    `### ${title}`,
    `**ID:** ${id}`,
    `**Date:** ${date}`,
    `**Project:** ${project}`,
    context ? `**Context:** ${context}` : null,
    "",
    body,
    "",
  ].filter((l) => l !== null).join("\n");

  if (!fs.existsSync(dest)) {
    const header = `# ${title.split(":")[0] || type} entries\n\nAuto-maintained by /qualia-learn (via bin/knowledge.js).\n`;
    fs.writeFileSync(dest, header + entry + "\n");
  } else {
    fs.appendFileSync(dest, entry + "\n");
  }

  console.log(`appended ${id} to ${path.basename(dest)}`);
  process.exit(0);
}

function cmdPath(arg) {
  console.log(resolveFile(arg));
  process.exit(0);
}

function cmdHelp() {
  process.stdout.write(`knowledge.js — Qualia Framework memory-layer loader

Usage:
  knowledge.js                            # print index.md (entry point)
  knowledge.js load <file>                # print a specific knowledge file
                                          # accepts: index, patterns, fixes,
                                          # client, supabase-patterns, etc.
  knowledge.js list                       # list all files with size + mtime
  knowledge.js search <query>             # grep across all files
  knowledge.js append --type <type> --title <T> --body <B> [--project <P>] [--context <C>]
                                          # type: pattern | fix | client
  knowledge.js path [<file>]              # print absolute path (no read)
  knowledge.js help                       # this message

Skills should ALWAYS go through this loader. New knowledge files reachable
from index.md become usable to every agent automatically. Hardcoded
\`cat ~/.claude/knowledge/X.md\` calls in skills are an anti-pattern (audit
finding #3 from the v4.1.0 review) — they make new files invisible.
`);
  process.exit(0);
}

const cmd = process.argv[2];
const rest = process.argv.slice(3);

switch (cmd) {
  case undefined:
  case null:
    cmdLoad(null);
    break;
  case "load":
    cmdLoad(rest[0]);
    break;
  case "list":
  case "ls":
    cmdList();
    break;
  case "search":
  case "grep":
    cmdSearch(rest[0]);
    break;
  case "append":
  case "add":
    cmdAppend(rest);
    break;
  case "path":
  case "which":
    cmdPath(rest[0]);
    break;
  case "help":
  case "-h":
  case "--help":
    cmdHelp();
    break;
  default:
    // Unknown command → fall through to load with that arg, so
    // `knowledge.js patterns` works as shorthand for `knowledge.js load patterns`.
    cmdLoad(cmd);
}
