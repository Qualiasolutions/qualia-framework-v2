#!/usr/bin/env node
// Qualia UI — consistent banners, context panels, status for every skill.
// Zero dependencies. Reads state.js + .qualia-config.json for context.
//
// Commands:
//   banner <action> [phase] [subtitle]  — full header with context panel
//   context                              — just the context panel
//   divider                              — horizontal rule
//   ok <message>                         — green check line
//   fail <message>                       — red cross line
//   warn <message>                       — yellow bang line
//   info <message>                       — blue dot line
//   spawn <agent> <description>          — spawning a subagent
//   wave <N> <total> <task-count>        — wave header for /qualia-build
//   task <N> <title>                     — task line (pending)
//   done <N> <title> [commit]            — task line (completed)
//   next <command>                       — "Run: /qualia-X" footer
//   end <status> [next-command]          — closing banner with optional next

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

// ─── Colors ──────────────────────────────────────────────
const TEAL = "\x1b[38;2;0;206;209m";
const TEAL_DIM = "\x1b[38;2;0;140;145m";
const DIM = "\x1b[38;2;100;110;120m";
const DIM2 = "\x1b[38;2;70;80;90m";
const GREEN = "\x1b[38;2;52;211;153m";
const WHITE = "\x1b[38;2;220;225;230m";
const YELLOW = "\x1b[38;2;234;179;8m";
const RED = "\x1b[38;2;239;68;68m";
const BLUE = "\x1b[38;2;96;165;250m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const RULE = "━".repeat(42);
const RULE_DIM = `${DIM2}${RULE}${RESET}`;

// ─── Action Labels ───────────────────────────────────────
const ACTIONS = {
  router:     { label: "SMART ROUTER",     glyph: "⬢" },
  new:        { label: "NEW PROJECT",      glyph: "✦" },
  plan:       { label: "PLANNING",         glyph: "▣" },
  build:      { label: "BUILDING",         glyph: "⚙" },
  verify:     { label: "VERIFYING",        glyph: "◎" },
  polish:     { label: "POLISHING",        glyph: "✧" },
  ship:       { label: "SHIPPING",         glyph: "△" },
  handoff:    { label: "HANDING OFF",      glyph: "⇢" },
  report:     { label: "SESSION REPORT",   glyph: "▤" },
  debug:      { label: "DEBUGGING",        glyph: "⊘" },
  learn:      { label: "LEARNING",         glyph: "⊙" },
  pause:      { label: "PAUSING",          glyph: "⏸" },
  resume:     { label: "RESUMING",         glyph: "▶" },
  review:     { label: "REVIEW",           glyph: "⊛" },
  design:     { label: "DESIGN PASS",      glyph: "◈" },
  quick:      { label: "QUICK FIX",        glyph: "⚡" },
  task:       { label: "TASK",             glyph: "▪" },
  "skill-new": { label: "NEW SKILL",       glyph: "✦" },
  gaps:       { label: "GAP CLOSURE",      glyph: "⟐" },
};

// ─── State Reading ───────────────────────────────────────
function readState() {
  try {
    const statePath = path.join(os.homedir(), ".claude", "bin", "state.js");
    const r = spawnSync(process.execPath, [statePath, "check"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (r.status !== 0 || !r.stdout) return null;
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function readConfig() {
  try {
    const f = path.join(os.homedir(), ".claude", ".qualia-config.json");
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return {};
  }
}

function projectName() {
  try {
    return path.basename(process.cwd());
  } catch {
    return "—";
  }
}

// ─── Rendering Helpers ───────────────────────────────────
function progressBar(phase, total) {
  if (!total || total < 1) return "";
  const pct = Math.min(100, Math.round(((phase - 1) / total) * 100));
  const filled = Math.round(pct / 10);
  const bar = `${TEAL}${"█".repeat(filled)}${DIM2}${"░".repeat(10 - filled)}${RESET}`;
  return `${bar} ${DIM}${pct}%${RESET}`;
}

function colorForStatus(s) {
  const colors = {
    setup: DIM,
    planned: BLUE,
    built: YELLOW,
    verified: GREEN,
    polished: GREEN,
    shipped: TEAL,
    handed_off: TEAL,
    done: GREEN,
  };
  return colors[s] || WHITE;
}

function pad(str, width) {
  // Width-aware padding ignoring ANSI codes
  const visible = str.replace(/\x1b\[[0-9;]*m/g, "");
  const need = Math.max(0, width - visible.length);
  return str + " ".repeat(need);
}

// ─── Commands ────────────────────────────────────────────
function cmdBanner(action, phase, subtitle) {
  const spec = ACTIONS[action] || { label: (action || "qualia").toUpperCase(), glyph: "⬢" };
  const state = readState();
  const config = readConfig();
  const project = projectName();

  const title = phase
    ? `${spec.label} ${DIM}·${WHITE} Phase ${phase}${subtitle ? ` ${DIM}— ${WHITE}${subtitle}` : ""}`
    : spec.label;

  console.log("");
  console.log(`  ${TEAL}${BOLD}${spec.glyph}${RESET} ${WHITE}${BOLD}QUALIA${RESET} ${DIM}▸${RESET} ${WHITE}${title}${RESET}`);
  console.log(`  ${RULE_DIM}`);

  // Context panel
  const roleColor = config.role === "OWNER" ? TEAL : BLUE;
  const roleLine = config.role
    ? `${roleColor}${config.role}${RESET} ${DIM}·${RESET} ${WHITE}${config.installed_by || ""}${RESET}`
    : `${DIM}(not configured)${RESET}`;

  console.log(`  ${pad(DIM + "Project" + RESET, 20)}${WHITE}${project}${RESET}`);

  if (state && state.ok) {
    const phaseStr = state.phase_name
      ? `${state.phase} of ${state.total_phases} ${DIM}— ${WHITE}${state.phase_name}`
      : `${state.phase} of ${state.total_phases}`;
    console.log(`  ${pad(DIM + "Phase" + RESET, 20)}${WHITE}${phaseStr}${RESET}`);
    console.log(`  ${pad(DIM + "Status" + RESET, 20)}${colorForStatus(state.status)}${state.status}${RESET}`);
    if (state.tasks_total) {
      console.log(`  ${pad(DIM + "Tasks" + RESET, 20)}${WHITE}${state.tasks_done}/${state.tasks_total}${RESET}`);
    }
    const bar = progressBar(state.phase, state.total_phases);
    if (bar) console.log(`  ${pad(DIM + "Progress" + RESET, 20)}${bar}`);
    if (state.gap_cycles > 0) {
      console.log(`  ${pad(DIM + "Gap cycles" + RESET, 20)}${YELLOW}${state.gap_cycles}/${state.gap_cycle_limit || 2}${RESET}`);
    }
  }

  console.log(`  ${pad(DIM + "Role" + RESET, 20)}${roleLine}`);
  console.log(`  ${RULE_DIM}`);
  console.log("");
}

function cmdContext() {
  const state = readState();
  const config = readConfig();
  const project = projectName();

  console.log("");
  console.log(`  ${pad(DIM + "Project" + RESET, 20)}${WHITE}${project}${RESET}`);

  if (state && state.ok) {
    const phaseStr = state.phase_name
      ? `${state.phase} of ${state.total_phases} ${DIM}— ${WHITE}${state.phase_name}`
      : `${state.phase} of ${state.total_phases}`;
    console.log(`  ${pad(DIM + "Phase" + RESET, 20)}${WHITE}${phaseStr}${RESET}`);
    console.log(`  ${pad(DIM + "Status" + RESET, 20)}${colorForStatus(state.status)}${state.status}${RESET}`);
    const bar = progressBar(state.phase, state.total_phases);
    if (bar) console.log(`  ${pad(DIM + "Progress" + RESET, 20)}${bar}`);
  } else {
    console.log(`  ${DIM}No project detected. Run${RESET} ${TEAL}/qualia-new${RESET}`);
  }

  if (config.role) {
    const roleColor = config.role === "OWNER" ? TEAL : BLUE;
    console.log(`  ${pad(DIM + "Role" + RESET, 20)}${roleColor}${config.role}${RESET} ${DIM}·${RESET} ${WHITE}${config.installed_by || ""}${RESET}`);
  }
  console.log("");
}

function cmdDivider() {
  console.log(`  ${RULE_DIM}`);
}

function cmdOk(msg) {
  console.log(`  ${GREEN}✓${RESET} ${WHITE}${msg}${RESET}`);
}

function cmdFail(msg) {
  console.log(`  ${RED}✗${RESET} ${WHITE}${msg}${RESET}`);
}

function cmdWarn(msg) {
  console.log(`  ${YELLOW}!${RESET} ${WHITE}${msg}${RESET}`);
}

function cmdInfo(msg) {
  console.log(`  ${BLUE}◦${RESET} ${DIM}${msg}${RESET}`);
}

function cmdSpawn(agent, desc) {
  const name = agent || "agent";
  const d = desc ? ` ${DIM}— ${desc}${RESET}` : "";
  console.log(`  ${TEAL}⬡${RESET} ${WHITE}Spawning${RESET} ${TEAL}${name}${RESET}${d}`);
}

function cmdWave(num, total, taskCount) {
  console.log("");
  const n = parseInt(num) || 0;
  const t = parseInt(total) || 0;
  const c = parseInt(taskCount) || 0;
  console.log(`  ${TEAL}»${RESET} ${WHITE}${BOLD}Wave ${n}/${t}${RESET} ${DIM}(${c} ${c === 1 ? "task" : "tasks"}, parallel)${RESET}`);
}

function cmdTask(num, title) {
  console.log(`    ${DIM}${num}.${RESET} ${WHITE}${title}${RESET} ${DIM}…${RESET}`);
}

function cmdDone(num, title, commit) {
  const c = commit ? ` ${DIM}(${commit})${RESET}` : "";
  console.log(`    ${GREEN}✓${RESET} ${DIM}${num}.${RESET} ${WHITE}${title}${RESET}${c}`);
}

function cmdNext(cmd) {
  if (!cmd) return;
  console.log("");
  console.log(`  ${TEAL}⟶${RESET} ${WHITE}Next:${RESET}  ${TEAL}${BOLD}${cmd}${RESET}`);
  console.log("");
}

function cmdEnd(status, nextCmd) {
  console.log("");
  console.log(`  ${TEAL}${BOLD}⬢${RESET} ${WHITE}${BOLD}${status || "DONE"}${RESET}`);
  console.log(`  ${RULE_DIM}`);
  if (nextCmd) {
    console.log(`  ${TEAL}⟶${RESET} ${WHITE}Next:${RESET}  ${TEAL}${BOLD}${nextCmd}${RESET}`);
  }
  console.log("");
}

// ─── Main ────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "banner":
    cmdBanner(rest[0] || "router", rest[1] || "", rest.slice(2).join(" "));
    break;
  case "context":  cmdContext(); break;
  case "divider":  cmdDivider(); break;
  case "ok":       cmdOk(rest.join(" ")); break;
  case "fail":     cmdFail(rest.join(" ")); break;
  case "warn":     cmdWarn(rest.join(" ")); break;
  case "info":     cmdInfo(rest.join(" ")); break;
  case "spawn":    cmdSpawn(rest[0], rest.slice(1).join(" ")); break;
  case "wave":     cmdWave(rest[0], rest[1], rest[2]); break;
  case "task":     cmdTask(rest[0], rest.slice(1).join(" ")); break;
  case "done":     cmdDone(rest[0], rest[1], rest[2]); break;
  case "next":     cmdNext(rest.join(" ")); break;
  case "end":      cmdEnd(rest[0], rest.slice(1).join(" ")); break;
  default:
    console.error(
      `Usage: qualia-ui.js <banner|context|divider|ok|fail|warn|info|spawn|wave|task|done|next|end> [args]`
    );
    process.exit(1);
}
