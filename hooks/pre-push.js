#!/usr/bin/env node
// ~/.claude/hooks/pre-push.js — stamp tracking.json + commit it before push.
// PreToolUse hook on `git push*` commands. The stamp is included in the push
// via a small bot commit (no-verify, bot author) so the ERP — which reads
// tracking.json straight from git — sees fresh data on every push.
//
// Cross-platform (Windows/macOS/Linux). No external dependencies.
//
// History rationale: a previous version (≤v3.4.1) wrote the stamp to
// tracking.json and then `git add`-ed it, but the actual `git push` ran on
// the snapshot already prepared by Claude Code's tool dispatcher — so the
// stamp never made it onto the wire. This rewrite creates a real commit so
// the next `git push` it spawned by Claude Code includes it.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const _traceStart = Date.now();
const HOME = os.homedir();
const TRACKING = path.join(".planning", "tracking.json");
const BOT_AUTHOR = "Qualia Framework <bot@qualia.solutions>";
const SHELL = process.platform === "win32";

function git(args, opts = {}) {
  return spawnSync("git", args, {
    encoding: "utf8",
    timeout: 5000,
    shell: SHELL,
    ...opts,
  });
}

function atomicWrite(file, content) {
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

function inGitRepo() {
  const r = git(["rev-parse", "--is-inside-work-tree"], { stdio: ["ignore", "pipe", "ignore"] });
  return r.status === 0 && (r.stdout || "").trim() === "true";
}

function commitStamp() {
  if (!fs.existsSync(TRACKING)) return { skipped: "no-tracking-file" };
  if (!inGitRepo()) return { skipped: "not-a-git-repo" };

  // Read current commit + stamp
  const head = git(["log", "--oneline", "-1", "--format=%h"]);
  const lastCommit = ((head.stdout || "").trim());
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  // Mutate tracking.json (atomic). Tolerate CRLF on Windows-edited files.
  let raw, parsed;
  try {
    raw = fs.readFileSync(TRACKING, "utf8");
    parsed = JSON.parse(raw);
  } catch (err) {
    return { skipped: "tracking-unreadable", error: err.message };
  }

  const before = JSON.stringify({ last_commit: parsed.last_commit, last_updated: parsed.last_updated });
  if (lastCommit) parsed.last_commit = lastCommit;
  parsed.last_updated = now;
  parsed.last_pushed_at = now;
  const after = JSON.stringify({ last_commit: parsed.last_commit, last_updated: parsed.last_updated });
  if (before === after) return { skipped: "no-change" };

  atomicWrite(TRACKING, JSON.stringify(parsed, null, 2) + "\n");

  // Commit so the stamp is part of the push that's about to happen.
  // --no-verify: skip user pre-commit hooks (this is a bot commit).
  // --no-gpg-sign: don't pop a signing prompt for a chore commit.
  // --author: attribute to bot, not user.
  const add = git(["add", TRACKING]);
  if (add.status !== 0) return { skipped: "git-add-failed", error: add.stderr };

  const commit = git([
    "commit",
    "--no-verify",
    "--no-gpg-sign",
    "--author", BOT_AUTHOR,
    "-m", `chore(track): ERP sync ${now}`,
  ]);
  if (commit.status !== 0) {
    // Commit failed (e.g., empty diff because git's auto-CRLF normalized the
    // only change to nothing, or branch is in a detached/conflicted state).
    // Unstage tracking.json and restore the working tree copy so the user's
    // next manual commit isn't polluted by our aborted stamp.
    try { git(["reset", "HEAD", "--", TRACKING]); } catch {}
    try { if (raw != null) atomicWrite(TRACKING, raw); } catch {}
    return { skipped: "git-commit-failed", error: (commit.stderr || commit.stdout || "").trim() };
  }
  return { committed: true, sha: lastCommit, ts: now };
}

function _trace(result, extra) {
  try {
    const traceDir = path.join(HOME, ".claude", ".qualia-traces");
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    const entry = {
      hook: "pre-push",
      result,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - _traceStart,
      ...extra,
    };
    const file = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  } catch {}
}

try {
  const result = commitStamp();
  _trace("allow", result);
} catch (err) {
  // Never block a push — log and exit clean.
  _trace("allow", { error: err.message });
}

process.exit(0);
