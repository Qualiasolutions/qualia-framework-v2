#!/usr/bin/env node
// Qualia State Machine — atomic state transitions with precondition validation
// No external dependencies. Node >= 18 only.

const fs = require("fs");
const path = require("path");

const PLANNING = ".planning";
const STATE_FILE = path.join(PLANNING, "STATE.md");
const TRACKING_FILE = path.join(PLANNING, "tracking.json");

// ─── Arg Parsing ─────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2).replace(/-/g, "_");
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

// ─── File I/O ────────────────────────────────────────────
function readTracking() {
  try {
    return JSON.parse(fs.readFileSync(TRACKING_FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeTracking(t) {
  fs.writeFileSync(TRACKING_FILE, JSON.stringify(t, null, 2) + "\n");
}

function readState() {
  try {
    return fs.readFileSync(STATE_FILE, "utf8");
  } catch {
    return null;
  }
}

// ─── STATE.md Parser ─────────────────────────────────────
function parseStateMd(content) {
  if (!content) return null;
  const get = (prefix) => {
    const m = content.match(new RegExp(`^${prefix}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : "";
  };
  const phaseMatch = content.match(
    /^Phase:\s*(\d+)\s+of\s+(\d+)\s*[—-]\s*(.+)$/m
  );
  // Parse roadmap table
  const phases = [];
  const tableMatch = content.match(
    /\| # \| Phase \| Goal \| Status \|\n\|[-|]+\|\n([\s\S]*?)(?=\n##|\n$|$)/
  );
  if (tableMatch) {
    for (const row of tableMatch[1].trim().split("\n")) {
      const cols = row.split("|").map((c) => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        phases.push({
          num: parseInt(cols[0]),
          name: cols[1],
          goal: cols[2],
          status: cols[3],
        });
      }
    }
  }
  return {
    phase: phaseMatch ? parseInt(phaseMatch[1]) : 1,
    total_phases: phaseMatch ? parseInt(phaseMatch[2]) : phases.length || 1,
    phase_name: phaseMatch ? phaseMatch[3].trim() : "",
    status: get("Status").toLowerCase().replace(/\s+/g, "_") || "setup",
    assigned_to: get("Assigned to") || "",
    phases,
  };
}

// ─── STATE.md Writer ─────────────────────────────────────
function writeStateMd(s) {
  const phaseFrac = Math.round(((s.phase - 1) / s.total_phases) * 100);
  const filled = Math.round(phaseFrac / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const now = new Date().toISOString().split("T")[0];

  const roadmap = s.phases
    .map((p) => `| ${p.num} | ${p.name} | ${p.goal} | ${p.status} |`)
    .join("\n");

  const md = `# Project State

## Project
See: .planning/PROJECT.md

## Current Position
Phase: ${s.phase} of ${s.total_phases} — ${s.phase_name}
Status: ${s.status}
Assigned to: ${s.assigned_to}
Last activity: ${now} — ${s.last_activity || "State updated"}

Progress: [${bar}] ${phaseFrac}%

## Roadmap
| # | Phase | Goal | Status |
|---|-------|------|--------|
${roadmap}

## Blockers
${s.blockers || "None."}

## Session
Last session: ${now}
Last worked by: ${s.assigned_to}
Resume: ${s.resume || "—"}
`;
  fs.writeFileSync(STATE_FILE, md);
}

// ─── Precondition Checks ─────────────────────────────────
const VALID_FROM = {
  planned: ["setup", "verified"], // verified(fail) → planned = gap closure
  built: ["planned"],
  verified: ["built"],
  polished: ["verified"],
  shipped: ["polished"],
  handed_off: ["shipped"],
  done: ["handed_off"],
};

function checkPreconditions(current, target, opts) {
  const phase = parseInt(opts.phase) || current.phase;

  // Special transitions (no status gate)
  if (target === "note" || target === "activity") return { ok: true };

  // Check valid transition
  const allowed = VALID_FROM[target];
  if (!allowed) return fail("INVALID_STATUS", `Unknown status: ${target}`);
  if (!allowed.includes(current.status)) {
    return fail(
      "PRECONDITION_FAILED",
      `Cannot go from '${current.status}' to '${target}'. Allowed from: ${allowed.join(", ")}`
    );
  }

  // File checks
  if (target === "planned") {
    const planFile = path.join(PLANNING, `phase-${phase}-plan.md`);
    if (!fs.existsSync(planFile))
      return fail("MISSING_FILE", `Plan file not found: ${planFile}`);
  }

  if (target === "verified") {
    const vFile = path.join(PLANNING, `phase-${phase}-verification.md`);
    if (!fs.existsSync(vFile))
      return fail("MISSING_FILE", `Verification file not found: ${vFile}`);
    if (!opts.verification || !["pass", "fail"].includes(opts.verification))
      return fail("MISSING_ARG", "--verification must be 'pass' or 'fail'");
  }

  if (target === "shipped") {
    if (!opts.deployed_url)
      return fail("MISSING_ARG", "--deployed-url is required for 'shipped'");
  }

  if (target === "handed_off") {
    const hFile = path.join(PLANNING, "HANDOFF.md");
    if (!fs.existsSync(hFile))
      return fail("MISSING_FILE", `Handoff file not found: ${hFile}`);
  }

  // Gap-closure circuit breaker
  if (target === "planned" && current.status === "verified") {
    const t = readTracking() || {};
    const cycles = (t.gap_cycles || {})[String(phase)] || 0;
    if (cycles >= 2) {
      return fail(
        "GAP_CYCLE_LIMIT",
        `Phase ${phase} has failed verification ${cycles} times. Escalate to Fawzi or re-plan from scratch.`
      );
    }
  }

  return { ok: true };
}

function fail(error, message) {
  return { ok: false, error, message };
}

// ─── Next Command Logic ──────────────────────────────────
function nextCommand(status, phase, totalPhases, verification) {
  switch (status) {
    case "setup":
      return `/qualia-plan ${phase}`;
    case "planned":
      return `/qualia-build ${phase}`;
    case "built":
      return `/qualia-verify ${phase}`;
    case "verified":
      if (verification === "fail") return `/qualia-plan ${phase} --gaps`;
      if (phase < totalPhases) return `/qualia-plan ${phase + 1}`;
      return "/qualia-polish";
    case "polished":
      return "/qualia-ship";
    case "shipped":
      return "/qualia-handoff";
    case "handed_off":
      return "/qualia-report";
    case "done":
      return "Done.";
    default:
      return `/qualia`;
  }
}

// ─── Commands ────────────────────────────────────────────

function cmdCheck(opts) {
  const t = readTracking();
  const s = parseStateMd(readState());
  if (!t || !s) {
    return output({
      ok: false,
      error: "NO_PROJECT",
      message: "No .planning/ found. Run /qualia-new to start.",
    });
  }
  output({
    ok: true,
    phase: s.phase,
    phase_name: s.phase_name,
    total_phases: s.total_phases,
    status: s.status,
    assigned_to: s.assigned_to,
    verification: t.verification || "pending",
    gap_cycles: (t.gap_cycles || {})[String(s.phase)] || 0,
    tasks_done: t.tasks_done || 0,
    tasks_total: t.tasks_total || 0,
    deployed_url: t.deployed_url || "",
    next_command: nextCommand(
      s.status,
      s.phase,
      s.total_phases,
      t.verification
    ),
  });
}

function cmdTransition(opts) {
  const target = opts.to;
  if (!target) return output(fail("MISSING_ARG", "--to is required"));

  const t = readTracking();
  const s = parseStateMd(readState());
  if (!t || !s) {
    return output(
      fail("NO_PROJECT", "No .planning/ found. Run /qualia-new.")
    );
  }

  // Special: note/activity (no status change)
  if (target === "note" || target === "activity") {
    const now = new Date().toISOString().split("T")[0];
    if (opts.notes) t.notes = opts.notes;
    t.last_updated = new Date().toISOString();
    writeTracking(t);
    s.last_activity = opts.notes || "Activity logged";
    writeStateMd(s);
    return output({
      ok: true,
      phase: s.phase,
      status: s.status,
      action: target,
    });
  }

  const phase = parseInt(opts.phase) || s.phase;

  // Precondition check
  const check = checkPreconditions(
    { ...s, phase },
    target,
    { ...opts, phase }
  );
  if (!check.ok) return output(check);

  const prevStatus = s.status;

  // Apply transition
  s.status = target;
  s.last_activity = `${target} (phase ${phase})`;

  // Update tracking fields
  t.status = target;
  t.phase = phase;
  t.phase_name = s.phases[phase - 1]?.name || s.phase_name;
  t.last_updated = new Date().toISOString();

  if (target === "planned") {
    // Gap closure: increment counter if coming from verified(fail)
    if (prevStatus === "verified") {
      if (!t.gap_cycles) t.gap_cycles = {};
      t.gap_cycles[String(phase)] = (t.gap_cycles[String(phase)] || 0) + 1;
      s.last_activity = `Gap closure #${t.gap_cycles[String(phase)]} planned (phase ${phase})`;
    }
    // Update roadmap
    if (s.phases[phase - 1]) s.phases[phase - 1].status = "planned";
  }

  if (target === "built") {
    t.tasks_done = parseInt(opts.tasks_done) || 0;
    t.tasks_total = parseInt(opts.tasks_total) || 0;
    t.wave = parseInt(opts.wave) || 0;
    s.last_activity = `Phase ${phase} built (${t.tasks_done}/${t.tasks_total} tasks)`;
    if (s.phases[phase - 1]) s.phases[phase - 1].status = "built";
  }

  if (target === "verified") {
    t.verification = opts.verification;
    s.last_activity = `Phase ${phase} verified — ${opts.verification}`;
    if (s.phases[phase - 1])
      s.phases[phase - 1].status =
        opts.verification === "pass" ? "verified" : "failed";

    // Auto-advance on pass
    if (opts.verification === "pass") {
      if (phase < s.total_phases) {
        s.phase = phase + 1;
        s.phase_name = s.phases[phase]?.name || `Phase ${phase + 1}`;
        s.status = "setup";
        t.phase = s.phase;
        t.phase_name = s.phase_name;
        t.status = "setup";
        t.verification = "pending";
        t.tasks_done = 0;
        t.tasks_total = 0;
        s.last_activity = `Phase ${phase} passed — advancing to phase ${s.phase}`;
      }
      // Reset gap counter for the passed phase
      if (t.gap_cycles) t.gap_cycles[String(phase)] = 0;
    }
  }

  if (target === "polished") {
    if (s.phases[s.phases.length - 1])
      s.phases[s.phases.length - 1].status = "verified";
  }

  if (target === "shipped") {
    t.deployed_url = opts.deployed_url || "";
  }

  // Write both files
  const backupState = readState();
  try {
    writeStateMd(s);
    writeTracking(t);
  } catch (e) {
    // Revert STATE.md on failure
    if (backupState) fs.writeFileSync(STATE_FILE, backupState);
    return output(fail("WRITE_ERROR", e.message));
  }

  output({
    ok: true,
    phase: s.phase,
    phase_name: s.phase_name,
    status: s.status,
    previous_status: prevStatus,
    verification: t.verification,
    gap_cycles: (t.gap_cycles || {})[String(s.phase)] || 0,
    next_command: nextCommand(s.status, s.phase, s.total_phases, t.verification),
  });
}

function cmdInit(opts) {
  if (!opts.project) return output(fail("MISSING_ARG", "--project required"));

  // Parse phases
  let phases = [];
  if (opts.phases) {
    try {
      phases = JSON.parse(opts.phases);
    } catch {
      return output(fail("INVALID_ARG", "--phases must be valid JSON array"));
    }
  }
  const totalPhases = parseInt(opts.total_phases) || phases.length || 1;

  // Ensure phases array has entries
  while (phases.length < totalPhases) {
    phases.push({
      name: `Phase ${phases.length + 1}`,
      goal: "TBD",
    });
  }

  // Create .planning/ if needed
  if (!fs.existsSync(PLANNING)) fs.mkdirSync(PLANNING, { recursive: true });

  const now = new Date().toISOString();
  const date = now.split("T")[0];

  // Build state
  const s = {
    phase: 1,
    total_phases: totalPhases,
    phase_name: phases[0].name,
    status: "setup",
    assigned_to: opts.assigned_to || "",
    last_activity: `Project initialized`,
    phases: phases.map((p, i) => ({
      num: i + 1,
      name: p.name,
      goal: p.goal,
      status: i === 0 ? "ready" : "—",
    })),
    blockers: "None.",
    resume: "—",
  };

  // Build tracking
  const t = {
    project: opts.project,
    client: opts.client || "",
    type: opts.type || "",
    assigned_to: opts.assigned_to || "",
    phase: 1,
    phase_name: phases[0].name,
    total_phases: totalPhases,
    status: "setup",
    wave: 0,
    tasks_done: 0,
    tasks_total: 0,
    verification: "pending",
    gap_cycles: {},
    blockers: [],
    last_updated: now,
    last_commit: "",
    deployed_url: "",
    notes: "",
  };

  writeStateMd(s);
  writeTracking(t);

  output({
    ok: true,
    action: "init",
    project: opts.project,
    phase: 1,
    total_phases: totalPhases,
    status: "setup",
    next_command: "/qualia-plan 1",
  });
}

// ─── Output ──────────────────────────────────────────────
function output(obj) {
  console.log(JSON.stringify(obj, null, 2));
  if (!obj.ok) process.exit(1);
}

// ─── Main ────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);

switch (cmd) {
  case "check":
    cmdCheck(opts);
    break;
  case "transition":
    cmdTransition(opts);
    break;
  case "init":
    cmdInit(opts);
    break;
  default:
    output(
      fail(
        "UNKNOWN_COMMAND",
        `Usage: state.js <check|transition|init> [--options]`
      )
    );
}
