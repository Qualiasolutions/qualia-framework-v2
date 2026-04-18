#!/usr/bin/env node
// Qualia status line — teal branded, shows phase + context + git.
// Pure Node.js port of the original statusline.sh. Cross-platform
// (Windows/macOS/Linux). No jq, no GNU stat, no /tmp hardcoding.
//
// Reads JSON from stdin (Claude Code status line schema), prints
// two ANSI-formatted lines to stdout. Never throws — every section
// is wrapped so missing data degrades gracefully.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const HOME = os.homedir();

// ─── Colors (matches bin/qualia-ui.js palette) ───────────
const TEAL = "\x1b[38;2;0;206;209m";
const TEAL_GLOW = "\x1b[38;2;0;170;175m";
const TEAL_DIM = "\x1b[38;2;0;130;135m";
const WHITE = "\x1b[38;2;220;225;230m";
const DIM = "\x1b[38;2;80;90;100m";
const GREEN = "\x1b[38;2;52;211;153m";
const YELLOW = "\x1b[38;2;234;179;8m";
const RED = "\x1b[38;2;239;68;68m";
const RESET = "\x1b[0m";

// ─── Read input ──────────────────────────────────────────
function readInput() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const input = readInput();

function pick(obj, keypath, fallback) {
  try {
    let cur = obj;
    for (const k of keypath.split(".")) {
      if (cur == null) return fallback;
      cur = cur[k];
    }
    return cur == null ? fallback : cur;
  } catch {
    return fallback;
  }
}

const MODEL = String(pick(input, "model.display_name", ""));
const DIR = String(pick(input, "workspace.current_dir", process.cwd()));
const PCT_RAW = Number(pick(input, "context_window.used_percentage", 0)) || 0;
const PCT = Math.floor(PCT_RAW);
const COST = Number(pick(input, "cost.total_cost_usd", 0)) || 0;
const DURATION_MS = Number(pick(input, "cost.total_duration_ms", 0)) || 0;
const AGENT = String(pick(input, "agent.name", "") || "");
const WORKTREE = String(pick(input, "worktree.name", "") || "");

// ─── Context bar ─────────────────────────────────────────
let BAR = "";
let BAR_COLOR = TEAL;
try {
  if (PCT >= 80) BAR_COLOR = RED;
  else if (PCT >= 50) BAR_COLOR = YELLOW;
  else BAR_COLOR = TEAL;

  const BAR_WIDTH = 10;
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.floor((PCT * BAR_WIDTH) / 100)));
  const empty = BAR_WIDTH - filled;
  BAR = "━".repeat(filled) + "╌".repeat(empty);
} catch {
  BAR = "╌".repeat(10);
}

// ─── Git branch (cached, cross-platform) ─────────────────
let BRANCH = "";
let CHANGES = 0;
try {
  const username = (os.userInfo().username || "anon").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cacheFile = path.join(os.tmpdir(), `qualia-git-cache-${username}`);

  let fresh = false;
  try {
    const st = fs.statSync(cacheFile);
    if (Date.now() - st.mtimeMs <= 3000) fresh = true;
  } catch {
    fresh = false;
  }

  if (!fresh) {
    let branch = "";
    let changes = 0;
    try {
      // Single git spawn: `status -b --porcelain=v1` returns branch on the
      // first line (`## branch.name...`) and one change per subsequent line.
      // Three separate git spawns cost ~450ms on Windows; this collapses to one.
      const st = spawnSync("git", ["status", "-b", "--porcelain=v1"], {
        cwd: DIR,
        encoding: "utf8",
        timeout: 1000,
        stdio: ["ignore", "pipe", "ignore"],
        shell: process.platform === "win32",
      });
      if (st.status === 0) {
        const lines = (st.stdout || "").split("\n");
        const header = lines[0] || "";
        if (header.startsWith("## ")) {
          // Possible forms:
          //   "## main"
          //   "## main...origin/main"
          //   "## main...origin/main [ahead 1, behind 2]"
          //   "## HEAD (no branch)"  ← detached
          //   "## No commits yet on main"
          let raw = header.slice(3);
          const ellipsisIdx = raw.indexOf("...");
          if (ellipsisIdx !== -1) raw = raw.slice(0, ellipsisIdx);
          // Strip any trailing "[ahead/behind]" annotation that survived
          raw = raw.replace(/\s*\[.*\]\s*$/, "").trim();
          if (raw === "HEAD (no branch)") {
            branch = "HEAD";
          } else if (raw.startsWith("No commits yet on ")) {
            branch = raw.slice("No commits yet on ".length).trim();
          } else {
            branch = raw;
          }
        }
        // Count change lines: every non-empty line after the header
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].length > 0) changes++;
        }
      }
    } catch {}
    try {
      // Atomic write: tmp + rename so concurrent prompts can't observe
      // a half-written cache file. Same pattern as state.js atomicWrite.
      const tmp = `${cacheFile}.tmp.${process.pid}`;
      fs.writeFileSync(tmp, `${branch}|${changes}`);
      try {
        fs.renameSync(tmp, cacheFile);
      } catch {
        try { fs.unlinkSync(tmp); } catch {}
      }
    } catch {}
  }

  try {
    const cached = fs.readFileSync(cacheFile, "utf8");
    const [b, c] = cached.split("|");
    BRANCH = b || "";
    CHANGES = parseInt(c, 10) || 0;
  } catch {}
} catch {}

// ─── Phase info from .planning/tracking.json ─────────────
let PHASE_INFO = "";
try {
  const trackingPath = path.join(DIR, ".planning", "tracking.json");
  if (fs.existsSync(trackingPath)) {
    const tracking = JSON.parse(fs.readFileSync(trackingPath, "utf8"));
    const phase = Number(tracking.phase || 0) || 0;
    const total = Number(tracking.total_phases || 0) || 0;
    const status = String(tracking.status || "");
    if (total > 0) {
      const pdone = Math.floor((phase * 100) / total);
      const pfill = Math.max(0, Math.min(4, Math.floor(pdone / 25)));
      const pempt = 4 - pfill;
      const pbar = "●".repeat(pfill) + "○".repeat(pempt);
      PHASE_INFO = `${TEAL}${pbar}${RESET} ${WHITE}P${phase}/${total}${RESET} ${TEAL_GLOW}${status}${RESET}`;
    }
  }
} catch {}

// ─── Memory count ────────────────────────────────────────
let MEMORY_COUNT = 0;
try {
  // Claude Code uses a hyphenated encoding of the project directory. Replace
  // BOTH forward and backward slashes so Windows installs (where DIR contains
  // `\`) get a correct key and the memory count renders.
  const dirKey = DIR.replace(/[\/\\]/g, "-");
  const memDir = path.join(HOME, ".claude", "projects", dirKey, "memory");
  if (fs.existsSync(memDir)) {
    const files = fs.readdirSync(memDir).filter(f => f.endsWith(".md") && f !== "MEMORY.md");
    MEMORY_COUNT = files.length;
  }
} catch {}

// ─── Hooks count ─────────────────────────────────────────
let HOOKS_COUNT = 0;
try {
  const settingsPath = path.join(HOME, ".claude", "settings.json");
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (settings.hooks) {
      for (const event of Object.values(settings.hooks)) {
        if (Array.isArray(event)) {
          for (const matcher of event) {
            if (matcher.hooks && Array.isArray(matcher.hooks)) {
              HOOKS_COUNT += matcher.hooks.length;
            }
          }
        }
      }
    }
  }
} catch {}

// ─── Skills count ────────────────────────────────────────
let SKILLS_COUNT = 0;
try {
  const skillsDir = path.join(HOME, ".claude", "skills");
  if (fs.existsSync(skillsDir)) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    SKILLS_COUNT = entries.filter(e => e.isDirectory() || e.name.endsWith(".md")).length;
  }
} catch {}

// ─── Duration ────────────────────────────────────────────
let DUR = "0s";
try {
  if (DURATION_MS >= 60000) {
    DUR = `${Math.floor(DURATION_MS / 60000)}m`;
  } else {
    DUR = `${Math.floor(DURATION_MS / 1000)}s`;
  }
} catch {}

// ─── Cost ────────────────────────────────────────────────
let COST_FMT = "$0.00";
try {
  COST_FMT = `$${COST.toFixed(2)}`;
} catch {}

// ─── Line 1: Project + Git + Agent + Worktree + Phase + Memory + Hooks ──
let LINE1 = "";
try {
  const dirBase = path.basename(DIR) || DIR;
  LINE1 = `${TEAL}⬢${RESET} ${WHITE}${dirBase}${RESET}`;
  if (BRANCH) {
    if (CHANGES > 0) {
      LINE1 += ` ${DIM}on${RESET} ${TEAL_GLOW}${BRANCH}${RESET} ${YELLOW}~${CHANGES}${RESET}`;
    } else {
      LINE1 += ` ${DIM}on${RESET} ${TEAL_GLOW}${BRANCH}${RESET}`;
    }
  }
  if (AGENT) LINE1 += ` ${DIM}│${RESET} ${TEAL}⚡${AGENT}${RESET}`;
  if (WORKTREE) LINE1 += ` ${DIM}│${RESET} ${TEAL_DIM}⎇ ${WORKTREE}${RESET}`;
  if (PHASE_INFO) LINE1 += ` ${DIM}│${RESET} ${PHASE_INFO}`;
  // Memory, hooks, skills — context indicators with labels
  const contextParts = [];
  if (MEMORY_COUNT > 0) contextParts.push(`${DIM}mem${RESET} ${TEAL}${MEMORY_COUNT}${RESET}`);
  if (HOOKS_COUNT > 0) contextParts.push(`${DIM}hooks${RESET} ${TEAL_GLOW}${HOOKS_COUNT}${RESET}`);
  if (SKILLS_COUNT > 0) contextParts.push(`${DIM}skills${RESET} ${TEAL_DIM}${SKILLS_COUNT}${RESET}`);
  if (contextParts.length > 0) {
    LINE1 += ` ${DIM}│${RESET} ${contextParts.join(` ${DIM}·${RESET} `)}`;
  }
} catch {
  LINE1 = `${TEAL}⬢${RESET} ${WHITE}qualia${RESET}`;
}

// ─── Line 2: Context bar + Cost + Duration + Model ───────
let LINE2 = "";
try {
  LINE2 =
    `${BAR_COLOR}${BAR}${RESET} ${DIM}${PCT}%${RESET} ` +
    `${DIM}│${RESET} ${DIM}${COST_FMT}${RESET} ` +
    `${DIM}│${RESET} ${DIM}${DUR}${RESET} ` +
    `${DIM}│${RESET} ${TEAL_DIM}${MODEL}${RESET}`;
} catch {
  LINE2 = `${DIM}${PCT}%${RESET}`;
}

process.stdout.write(LINE1 + "\n");
process.stdout.write(LINE2 + "\n");
