#!/usr/bin/env node
// ~/.claude/bin/knowledge-flush.js — non-interactive memory-layer flush.
//
// Wraps `/qualia-flush` so it can run from cron (or systemd timer, or any
// CI/scheduled job) without an interactive Claude Code session. Closes the
// memory loop end-to-end:
//
//   Stop hook (auto, every turn) → ~/.claude/knowledge/daily-log/{date}.md
//   THIS SCRIPT (weekly cron)    → spawns `claude -p "/qualia-flush --days 7"`
//   /qualia-flush                 → promotes raw → curated tier
//   bin/knowledge.js (every spawn) → reads index.md → reaches the right file
//
// Usage:
//   node ~/.claude/bin/knowledge-flush.js               # 7-day flush
//   node ~/.claude/bin/knowledge-flush.js --days 14     # custom window
//   node ~/.claude/bin/knowledge-flush.js --dry-run     # preview only
//   node ~/.claude/bin/knowledge-flush.js --project X   # scope to one project
//
// Recommended cron entry (weekly Sunday 3 AM local):
//   0 3 * * 0 node ~/.claude/bin/knowledge-flush.js >> ~/.claude/.qualia-flush.log 2>&1
//
// Behavior:
//   • If `claude` CLI isn't on PATH, exits 0 with a logged warning. Cron
//     spam is worse than a missed flush — a real failure surfaces in the
//     log file the user is presumably watching.
//   • If the daily-log dir is empty (nothing to flush), exits 0 silently.
//   • If `claude -p` returns non-zero, exits 1 with the error captured in
//     the log so cron can be configured to alert on it.
//   • Writes one structured JSONL line per run to ~/.claude/.qualia-flush.log
//     so the user can audit "when did the last 5 flushes run, what did they
//     produce?" without parsing free text.
//
// Cross-platform (Windows/macOS/Linux). Honors the same args as the skill.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const HOME = os.homedir();
const KNOWLEDGE_DIR = path.join(HOME, ".claude", "knowledge");
const DAILY_DIR = path.join(KNOWLEDGE_DIR, "daily-log");
const LOG_FILE = path.join(HOME, ".claude", ".qualia-flush.log");

const _start = Date.now();

function logEvent(event) {
  try {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - _start,
      ...event,
    });
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {}
}

function which(cmd) {
  // Cross-platform `which`. Returns the first PATH match or null.
  // We don't shell out to `which` itself because it doesn't exist on Windows
  // (it's `where` there, with different semantics).
  const sep = process.platform === "win32" ? ";" : ":";
  const exts = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];
  const dirs = (process.env.PATH || "").split(sep);
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, cmd + ext);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {}
    }
  }
  return null;
}

// Pass-through args (so `--days 14`, `--dry-run`, `--project X` all reach the
// skill). We don't parse them ourselves — the skill is the source of truth
// for argument semantics. We only use `--days` locally to short-circuit when
// the daily-log is genuinely empty.
const argv = process.argv.slice(2);
const flagIdx = argv.indexOf("--days");
const days = flagIdx >= 0 ? parseInt(argv[flagIdx + 1], 10) || 7 : 7;

function dailyLogHasRecentEntries(windowDays) {
  if (!fs.existsSync(DAILY_DIR)) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  try {
    const entries = fs.readdirSync(DAILY_DIR);
    for (const f of entries) {
      if (!f.endsWith(".md")) continue;
      const base = f.replace(/\.md$/, "");
      if (base >= cutoffStr) return true;
    }
  } catch {}
  return false;
}

// ── Preflight ────────────────────────────────────────────
const claudeBin = which("claude");
if (!claudeBin) {
  logEvent({ event: "skipped", reason: "claude-cli-not-on-path" });
  // Exit 0 — a missing CLI on the host running cron is a config issue, not
  // a flush failure. Don't spam alerts.
  process.exit(0);
}

if (!dailyLogHasRecentEntries(days)) {
  logEvent({ event: "skipped", reason: "no-recent-daily-log", window_days: days });
  process.exit(0);
}

// ── Run ──────────────────────────────────────────────────
// `claude -p "<prompt>"` runs a single non-interactive turn. The skill body
// invocation matches what the user would type at the prompt.
const prompt = `/qualia-flush ${argv.join(" ")}`.trim();

const result = spawnSync(claudeBin, ["-p", prompt], {
  encoding: "utf8",
  timeout: 5 * 60 * 1000, // 5 min hard cap — flush should never take this long
  shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"],
});

const stdout = (result.stdout || "").trim();
const stderr = (result.stderr || "").trim();
const status = typeof result.status === "number" ? result.status : -1;

if (status !== 0) {
  logEvent({
    event: "failed",
    status,
    prompt,
    stderr_tail: stderr.slice(-1000),
  });
  // Surface to stderr so cron's MAILTO sends an alert.
  console.error(`knowledge-flush: claude -p exited ${status}`);
  if (stderr) console.error(stderr.slice(-2000));
  process.exit(1);
}

// Success: parse stdout for the skill's summary line if present, else log
// the full output tail.
const summaryMatch = stdout.match(/⬢ Flushed daily-log .+/);
logEvent({
  event: "ok",
  prompt,
  summary: summaryMatch ? summaryMatch[0] : stdout.split("\n").slice(-3).join(" | "),
});

// Echo the user-facing summary to stdout so cron logs / interactive runs
// both surface what happened.
if (summaryMatch) {
  console.log(summaryMatch[0]);
} else {
  console.log(stdout.split("\n").slice(-5).join("\n"));
}
process.exit(0);
