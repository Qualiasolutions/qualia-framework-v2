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
//   update <current> <latest>            — sticky framework update banner
//   plan-summary <path/to/plan.md>       — story-file dashboard for a plan
//   journey-tree [path/to/JOURNEY.md]    — ladder view of all milestones, current highlighted
//   milestone-complete <num> <name> <next> — celebration banner on milestone close

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
  welcome:    { label: "WELCOME",          glyph: "⬢" },
  test:       { label: "TESTING",          glyph: "⊡" },
  analytics:  { label: "ANALYTICS",        glyph: "◈" },
  milestone:  { label: "MILESTONE",        glyph: "◆" },
  journey:    { label: "JOURNEY",          glyph: "◯" },
  auto:       { label: "AUTO MODE",        glyph: "⚡" },
  research:   { label: "RESEARCH",         glyph: "◱" },
  roadmap:    { label: "ROADMAP",          glyph: "◐" },
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

// ─── Journey Tree (the North Star visualization) ────────
// Renders JOURNEY.md as an ASCII ladder with the current milestone highlighted.
// Called after /qualia-new to show the full arc, and by /qualia (router) to
// orient the user on "you are here".
function cmdJourneyTree(journeyPath) {
  const p = journeyPath || ".planning/JOURNEY.md";
  let content = "";
  try {
    content = fs.readFileSync(p, "utf8");
  } catch {
    console.log(`  ${DIM}No JOURNEY.md at ${p}${RESET}`);
    return;
  }

  const state = readState();
  const currentMilestone = state && state.ok ? (state.milestone || 1) : 1;

  // Parse milestone blocks: "## Milestone N · Name" or "## Milestone N · Handoff"
  const milestoneRe = /^## Milestone (\d+)\s*·\s*(.+?)\s*(?:\[[^\]]*\])?\r?$/gm;
  const milestones = [];
  let m;
  while ((m = milestoneRe.exec(content)) !== null) {
    const num = parseInt(m[1]);
    const name = m[2].trim();
    // Extract the section body to pull Why-now and phases
    const startIdx = m.index + m[0].length;
    const nextMatch = milestoneRe.exec(content);
    const endIdx = nextMatch ? nextMatch.index : content.length;
    milestoneRe.lastIndex = startIdx; // rewind for next iteration
    const body = content.slice(startIdx, endIdx);

    const whyMatch = body.match(/\*\*Why now:\*\*\s*(.+?)\r?$/m);
    const why = whyMatch ? whyMatch[1].trim() : "";

    const phaseNames = [];
    const phaseRe = /^\d+\.\s+\*\*([^*]+)\*\*/gm;
    let pm;
    while ((pm = phaseRe.exec(body)) !== null) {
      phaseNames.push(pm[1].trim());
    }

    milestones.push({ num, name, why, phaseNames });
    if (nextMatch) milestoneRe.lastIndex = nextMatch.index;
    else break;
  }

  if (milestones.length === 0) {
    console.log(`  ${DIM}JOURNEY.md has no milestones to render${RESET}`);
    return;
  }

  // Project name from frontmatter if present
  const projMatch = content.match(/^project:\s*"?(.+?)"?\s*$/m);
  const projectName = projMatch ? projMatch[1] : projectName();

  console.log("");
  console.log(`  ${TEAL}${BOLD}◯${RESET} ${WHITE}${BOLD}JOURNEY${RESET} ${DIM}▸${RESET} ${WHITE}${projectName}${RESET}`);
  console.log(`  ${RULE_DIM}`);
  console.log(`  ${DIM}${milestones.length} milestones · currently at M${currentMilestone}${RESET}`);
  console.log("");

  for (let i = 0; i < milestones.length; i++) {
    const ms = milestones[i];
    const isCurrent = ms.num === currentMilestone;
    const isPast = ms.num < currentMilestone;
    const isFuture = ms.num > currentMilestone;
    const isHandoff = /handoff/i.test(ms.name);

    let marker;
    let labelColor;
    let connector = "│";

    if (isPast) {
      marker = `${GREEN}●${RESET}`;
      labelColor = DIM;
    } else if (isCurrent) {
      marker = `${TEAL}${BOLD}◆${RESET}`;
      labelColor = TEAL + BOLD;
    } else {
      marker = `${DIM2}○${RESET}`;
      labelColor = WHITE;
    }

    const tag = isCurrent
      ? ` ${TEAL}${BOLD}[CURRENT]${RESET}`
      : isPast
      ? ` ${GREEN}[shipped]${RESET}`
      : isHandoff
      ? ` ${DIM2}[FINAL]${RESET}`
      : "";

    console.log(`  ${marker} ${labelColor}M${ms.num} · ${ms.name}${RESET}${tag}`);

    if (ms.why && (isCurrent || isFuture)) {
      const shortWhy = ms.why.length > 80 ? ms.why.slice(0, 77) + "…" : ms.why;
      console.log(`  ${DIM2}│${RESET}   ${DIM}${shortWhy}${RESET}`);
    }

    if (ms.phaseNames.length > 0 && (isCurrent || isHandoff)) {
      const phaseList = ms.phaseNames.slice(0, 4).join(` ${DIM2}→${RESET} ${DIM}`);
      console.log(`  ${DIM2}│${RESET}   ${DIM}${phaseList}${DIM}${ms.phaseNames.length > 4 ? ` +${ms.phaseNames.length - 4}` : ""}${RESET}`);
    }

    // Connector between milestones (skip after last)
    if (i < milestones.length - 1) {
      console.log(`  ${DIM2}│${RESET}`);
    }
  }
  console.log("");
  console.log(`  ${RULE_DIM}`);
}

// ─── Milestone Complete (celebration banner) ─────────────
// Shown at milestone-boundary in auto mode, and by /qualia-milestone manually.
function cmdMilestoneComplete(num, name, nextName) {
  console.log("");
  console.log(`  ${GREEN}${BOLD}◆${RESET} ${WHITE}${BOLD}MILESTONE ${num} SHIPPED${RESET} ${DIM}·${RESET} ${TEAL}${name || ""}${RESET}`);
  console.log(`  ${RULE_DIM}`);
  if (nextName) {
    if (/handoff/i.test(nextName)) {
      console.log(`  ${DIM}Next${RESET}      ${TEAL}${BOLD}${nextName}${RESET} ${DIM}· the final milestone${RESET}`);
    } else {
      console.log(`  ${DIM}Next${RESET}      ${WHITE}${nextName}${RESET}`);
    }
  } else {
    console.log(`  ${GREEN}${BOLD}PROJECT COMPLETE${RESET} ${DIM}· last milestone reached${RESET}`);
  }
  console.log(`  ${RULE_DIM}`);
  console.log("");
}

// ─── Plan Summary (story-file dashboard) ─────────────────
// Renders a polished overview of a plan file: phase goal, tasks grouped by wave,
// persona chips, dependency lines, AC count, validation count. Called by
// /qualia-plan after the planner and plan-checker finish.
function cmdPlanSummary(planPath) {
  if (!planPath) {
    console.error("Usage: qualia-ui.js plan-summary <path-to-plan.md>");
    process.exit(1);
  }
  let content = "";
  try {
    content = fs.readFileSync(planPath, "utf8");
  } catch (e) {
    console.error(`Cannot read plan: ${e.message}`);
    process.exit(1);
  }

  // ─ Parse frontmatter + phase header ─
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  const fm = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const m = line.match(/^(\w+):\s*(.+?)\s*$/);
      if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const phaseNum = fm.phase || "?";
  const phaseGoal = fm.goal || "";
  const phaseTitleMatch = content.match(/^# Phase \d+:?\s*(.+?)\r?$/m);
  const phaseTitle = phaseTitleMatch ? phaseTitleMatch[1].trim() : `Phase ${phaseNum}`;
  const whyPhaseMatch = content.match(/^\*\*Why this phase:\*\*\s*(.+?)\r?$/m);
  const whyPhase = whyPhaseMatch ? whyPhaseMatch[1].trim() : "";

  // ─ Parse tasks ─
  const taskBlocks = content.split(/^(?=## Task \d+)/m).filter((b) => /^## Task \d+/.test(b));
  const tasks = taskBlocks.map((block) => {
    const titleMatch = block.match(/^## Task (\d+)\s*—\s*(.+?)\r?$/m);
    const wave = parseInt((block.match(/\*\*Wave:\*\*\s*(\d+)/) || [])[1]) || 1;
    const persona = ((block.match(/\*\*Persona:\*\*\s*(.+?)\r?$/m) || [])[1] || "").trim();
    const deps = ((block.match(/\*\*Depends on:\*\*\s*(.+?)\r?$/m) || [])[1] || "").trim();
    const why = ((block.match(/\*\*Why:\*\*\s*([\s\S]+?)(?=\r?\n\*\*|\r?\n##|$)/) || [])[1] || "").trim().replace(/\s+/g, " ");
    const acBlock = (block.match(/\*\*Acceptance Criteria:\*\*\s*([\s\S]+?)(?=\r?\n\*\*|\r?\n##|$)/) || [])[1] || "";
    const acCount = (acBlock.match(/^[-*]\s+/gm) || []).length;
    const validationBlock = (block.match(/\*\*Validation:\*\*[^\n]*\n([\s\S]+?)(?=\r?\n\*\*|\r?\n##|$)/) || [])[1] || "";
    const validationCount = (validationBlock.match(/^[-*]\s+/gm) || []).length;
    return {
      num: titleMatch ? parseInt(titleMatch[1]) : 0,
      title: titleMatch ? titleMatch[2].trim() : "",
      wave,
      persona: (() => {
        // Strip placeholder syntax ({...}), then only accept the known set
        const cleaned = persona.replace(/[{}]/g, "").trim().toLowerCase();
        const valid = ["security", "architect", "ux", "frontend", "backend", "performance"];
        return valid.includes(cleaned) ? cleaned : "";
      })(),
      deps,
      why,
      acCount,
      validationCount,
    };
  });

  const contractCount = (content.match(/^### Contract for Task \d+/gm) || []).length;
  const totalWaves = tasks.length > 0 ? Math.max(...tasks.map((t) => t.wave)) : 0;

  // ─ Render ─
  console.log("");
  console.log(`  ${TEAL}${BOLD}▣${RESET} ${WHITE}${BOLD}PLAN${RESET} ${DIM}▸${RESET} ${WHITE}Phase ${phaseNum} — ${phaseTitle}${RESET}`);
  console.log(`  ${RULE_DIM}`);
  if (phaseGoal) {
    console.log(`  ${DIM}Goal${RESET}      ${WHITE}${phaseGoal}${RESET}`);
  }
  if (whyPhase) {
    console.log(`  ${DIM}Why${RESET}       ${WHITE}${whyPhase}${RESET}`);
  }
  console.log(`  ${DIM}Shape${RESET}     ${TEAL}${tasks.length}${RESET} ${DIM}tasks${RESET} ${DIM}·${RESET} ${TEAL}${totalWaves}${RESET} ${DIM}waves${RESET} ${DIM}·${RESET} ${TEAL}${contractCount}${RESET} ${DIM}contracts${RESET}`);
  console.log(`  ${RULE_DIM}`);

  // Persona palette
  const personaColors = {
    security: RED,
    architect: BLUE,
    ux: "\x1b[38;2;255;182;193m",
    frontend: TEAL,
    backend: "\x1b[38;2;186;85;211m",
    performance: YELLOW,
  };

  for (let w = 1; w <= totalWaves; w++) {
    const waveTasks = tasks.filter((t) => t.wave === w);
    if (!waveTasks.length) continue;
    console.log("");
    console.log(`  ${TEAL}»${RESET} ${WHITE}${BOLD}Wave ${w}${RESET} ${DIM}(${waveTasks.length} ${waveTasks.length === 1 ? "task" : "tasks"}, parallel)${RESET}`);
    for (const t of waveTasks) {
      const personaChip = t.persona
        ? ` ${(personaColors[t.persona] || DIM)}[${t.persona}]${RESET}`
        : "";
      // Only show the dep chip if it names a real task reference.
      // Suppress blanks, "none", and template placeholders like "{none | Task N}".
      const depsClean = (t.deps || "").trim();
      const depsIsReal =
        depsClean &&
        !/^none$/i.test(depsClean) &&
        !/[{}]/.test(depsClean);
      const depChip = depsIsReal ? ` ${DIM}← ${depsClean}${RESET}` : "";
      console.log(`    ${DIM}${t.num}.${RESET} ${WHITE}${t.title}${RESET}${personaChip}${depChip}`);
      // Suppress placeholder Why text (contains {} braces) to keep the
      // dashboard clean when the planner hasn't filled it in yet.
      if (t.why && !/[{}]/.test(t.why)) {
        const shortWhy = t.why.length > 90 ? t.why.slice(0, 87) + "…" : t.why;
        console.log(`       ${DIM}${shortWhy}${RESET}`);
      }
      const metrics = [];
      if (t.acCount > 0) metrics.push(`${TEAL}${t.acCount}${RESET} ${DIM}AC${RESET}`);
      if (t.validationCount > 0) metrics.push(`${TEAL}${t.validationCount}${RESET} ${DIM}checks${RESET}`);
      if (metrics.length) {
        console.log(`       ${metrics.join(` ${DIM}·${RESET} `)}`);
      }
    }
  }
  console.log("");
  console.log(`  ${RULE_DIM}`);
}

function cmdUpdate(current, latest) {
  if (!current || !latest) return;
  console.log("");
  console.log(`  ${YELLOW}${BOLD}▲${RESET} ${WHITE}${BOLD}QUALIA FRAMEWORK UPDATE AVAILABLE${RESET}`);
  console.log(`  ${DIM2}${RULE}${RESET}`);
  console.log(`  ${pad(DIM + "Current" + RESET, 20)}${DIM}${current}${RESET}`);
  console.log(`  ${pad(DIM + "Latest" + RESET, 20)}${GREEN}${BOLD}${latest}${RESET}`);
  console.log(`  ${pad(DIM + "Update" + RESET, 20)}${TEAL}npx qualia-framework@latest install${RESET}`);
  console.log(`  ${DIM2}${RULE}${RESET}`);
  console.log(`  ${DIM}This notice shows every session until you update.${RESET}`);
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
  case "update":   cmdUpdate(rest[0], rest[1]); break;
  case "plan-summary": cmdPlanSummary(rest[0]); break;
  case "journey-tree": cmdJourneyTree(rest[0]); break;
  case "milestone-complete": cmdMilestoneComplete(rest[0], rest[1], rest.slice(2).join(" ")); break;
  default:
    console.error(
      `Usage: qualia-ui.js <banner|context|divider|ok|fail|warn|info|spawn|wave|task|done|next|end|update|plan-summary|journey-tree|milestone-complete> [args]`
    );
    process.exit(1);
}
