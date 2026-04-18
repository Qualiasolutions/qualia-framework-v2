#!/usr/bin/env node
// Qualia State Machine — atomic state transitions with precondition validation
// No external dependencies. Node >= 18 only.

const fs = require("fs");
const path = require("path");

const PLANNING = ".planning";
const STATE_FILE = path.join(PLANNING, "STATE.md");
const TRACKING_FILE = path.join(PLANNING, "tracking.json");
const LOCK_FILE = path.join(PLANNING, ".state.lock");

// ─── Atomic write (tmp + rename) ─────────────────────────
// Prevents half-written files when SIGINT, OOM, or AV scanners
// interrupt mid-write. Same-filesystem rename is atomic on POSIX
// and best-effort atomic on Windows (NTFS replaces in one syscall).
function atomicWrite(file, content) {
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, content);
  try {
    fs.renameSync(tmp, file);
  } catch (err) {
    // Cleanup tmp on failure (Windows EBUSY, EPERM, etc.)
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

// ─── Exclusive lock ──────────────────────────────────────
// Prevents two concurrent state.js mutations from racing on the dual
// STATE.md + tracking.json write. Read commands (check, validate-plan)
// don't take the lock — only mutators do.
function acquireLock(timeoutMs = 5000) {
  if (!fs.existsSync(PLANNING)) return null; // nothing to lock yet
  const start = Date.now();
  const ours = `${process.pid}@${new Date().toISOString()}`;
  while (Date.now() - start < timeoutMs) {
    try {
      const fd = fs.openSync(LOCK_FILE, "wx");
      fs.writeSync(fd, ours);
      fs.closeSync(fd);
      return LOCK_FILE;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      // Stale lock? If older than 30s, steal it.
      try {
        const stat = fs.statSync(LOCK_FILE);
        if (Date.now() - stat.mtimeMs > 30_000) {
          fs.unlinkSync(LOCK_FILE);
          continue;
        }
      } catch {}
      // Spin-wait briefly. State ops are fast; conflicts rare.
      const t = Date.now() + 50;
      while (Date.now() < t) {}
    }
  }
  // Couldn't acquire — proceed unlocked rather than block the user.
  return null;
}

function releaseLock(lock) {
  if (!lock) return;
  try { fs.unlinkSync(lock); } catch {}
}

// ─── Trace ──────────────────────────────────────────────
// Signature normalized: _trace(event, result, data?). Old callers passed
// (event, data) with `result` as a string in `data` — that produced
// nonsense JSONL ({0:"a",1:"l",2:"l",...}). Always use the 3-arg form.
//
// Log rotation: trace files older than TRACE_RETENTION_DAYS are pruned
// on every write. Heavy users used to accumulate unbounded MB/day in
// ~/.claude/.qualia-traces/. The prune is best-effort and never throws.
const TRACE_RETENTION_DAYS = 30;

function _pruneTraces(traceDir) {
  try {
    const cutoff = Date.now() - TRACE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const name of fs.readdirSync(traceDir)) {
      if (!name.endsWith(".jsonl")) continue;
      const p = path.join(traceDir, name);
      try {
        const stat = fs.statSync(p);
        if (stat.mtimeMs < cutoff) fs.unlinkSync(p);
      } catch {}
    }
  } catch {}
}

function _trace(event, result, data) {
  try {
    const traceDir = path.join(require("os").homedir(), ".claude", ".qualia-traces");
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    // Prune ~1% of the time (cheap on most invocations, bounded over time).
    if (Math.random() < 0.01) _pruneTraces(traceDir);
    const entry = {
      hook: event,
      result: result || "allow",
      timestamp: new Date().toISOString(),
      ...(data && typeof data === "object" ? data : {}),
    };
    const file = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  } catch { /* trace failures must not disrupt state machine */ }
}

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
  atomicWrite(TRACKING_FILE, JSON.stringify(t, null, 2) + "\n");
}

// Ensure lifetime + milestone fields exist (backward compat for old tracking files)
function ensureLifetime(t) {
  if (!t) return t;
  if (typeof t.milestone !== "number") t.milestone = 1;
  if (typeof t.milestone_name !== "string") t.milestone_name = "";
  if (!Array.isArray(t.milestones)) t.milestones = [];
  if (!t.lifetime || typeof t.lifetime !== "object") {
    t.lifetime = {
      tasks_completed: 0,
      phases_completed: 0,
      milestones_completed: 0,
      total_phases: 0,
    };
  }
  return t;
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
  const schema_errors = [];
  const get = (prefix) => {
    // CRLF tolerance: Windows editors save with `\r\n`. Use `(.+?)\r?$` so
    // the `\r` is consumed, not captured. `.trim()` is still applied as
    // belt-and-suspenders for any other trailing whitespace.
    const m = content.match(new RegExp(`^${prefix}:\\s*(.+?)\\r?$`, "m"));
    return m ? m[1].trim() : "";
  };
  const hasField = (prefix) =>
    new RegExp(`^${prefix}:\\s*`, "m").test(content);

  const phaseMatch = content.match(
    /^Phase:\s*(\d+)\s+of\s+(\d+)\s*[—-]\s*(.+?)\r?$/m
  );
  if (!phaseMatch) {
    schema_errors.push({
      field: "phase_header",
      message: 'Missing or malformed "Phase: N of M — Name" header',
      severity: "error",
    });
  }

  // Status field presence (independent of value)
  if (!hasField("Status")) {
    schema_errors.push({
      field: "status_field",
      message: "Missing Status: field",
      severity: "warning",
    });
  }

  // Parse roadmap table
  const phases = [];
  const tableHeaderRe = /\| # \| Phase \| Goal \| Status \|/;
  const tableMatch = content.match(
    /\| # \| Phase \| Goal \| Status \|\n\|[-|]+\|\n([\s\S]*?)(?=\n##|\n$|$)/
  );
  if (!tableHeaderRe.test(content)) {
    schema_errors.push({
      field: "roadmap_table",
      message: "Roadmap table header not found",
      severity: "error",
    });
  } else if (!tableMatch) {
    // Header is there but the separator row or body is malformed
    schema_errors.push({
      field: "roadmap_table",
      message: "Roadmap table is malformed (missing separator row or body)",
      severity: "error",
    });
  } else {
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

  // Row count vs header "of M"
  if (phaseMatch) {
    const declaredTotal = parseInt(phaseMatch[2]);
    if (phases.length && phases.length !== declaredTotal) {
      schema_errors.push({
        field: "roadmap_rows",
        message: `Expected ${declaredTotal} phases in roadmap, found ${phases.length}`,
        severity: "warning",
      });
    }
  }

  return {
    phase: phaseMatch ? parseInt(phaseMatch[1]) : 1,
    total_phases: phaseMatch ? parseInt(phaseMatch[2]) : phases.length || 1,
    phase_name: phaseMatch ? phaseMatch[3].trim() : "",
    status: get("Status").toLowerCase().replace(/\s+/g, "_") || "setup",
    assigned_to: get("Assigned to") || "",
    phases,
    schema_errors,
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
  atomicWrite(STATE_FILE, md);
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

// ─── Configurable Gap Cycle Limit ────────────────────────
function getGapCycleLimit() {
  // Priority: tracking.json.gap_cycle_limit > PROJECT.md > default (2)
  try {
    const t = readTracking();
    if (t && typeof t.gap_cycle_limit === "number" && t.gap_cycle_limit > 0) {
      return t.gap_cycle_limit;
    }
  } catch {}

  try {
    const projectMd = fs.readFileSync(path.join(PLANNING, "PROJECT.md"), "utf8");
    const match = projectMd.match(/^gap_cycle_limit:\s*(\d+)/m);
    if (match) return parseInt(match[1]);
  } catch {}

  return 2; // default
}

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
    // Validate plan content (not just existence)
    const planContent = fs.readFileSync(planFile, "utf8");
    const taskHeaders = planContent.match(/^## Task \d+/gm);
    if (!taskHeaders || taskHeaders.length === 0)
      return fail("INVALID_PLAN", "Plan file has no task headers (expected '## Task N')");
    // Accept either legacy "**Done when:**" or story-file "**Acceptance Criteria:**"
    // so old in-flight plans don't break on upgrade.
    const doneWhenCount = (planContent.match(/\*\*Done when:\*\*/g) || []).length;
    const acCount = (planContent.match(/\*\*Acceptance Criteria:\*\*/g) || []).length;
    const anchors = doneWhenCount + acCount;
    if (anchors < taskHeaders.length)
      return fail("INVALID_PLAN", `${taskHeaders.length} tasks but only ${anchors} 'Done when:' or 'Acceptance Criteria:' anchors`);
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

  // Gap-closure circuit breaker (configurable limit)
  if (target === "planned" && current.status === "verified") {
    const t = readTracking() || {};
    const cycles = (t.gap_cycles || {})[String(phase)] || 0;
    const limit = getGapCycleLimit();
    if (cycles >= limit) {
      return fail(
        "GAP_CYCLE_LIMIT",
        `Phase ${phase} has failed verification ${cycles} times (limit: ${limit}). Escalate to Fawzi or re-plan from scratch.`
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
  ensureLifetime(t);
  output({
    ok: true,
    phase: s.phase,
    phase_name: s.phase_name,
    total_phases: s.total_phases,
    status: s.status,
    assigned_to: s.assigned_to,
    milestone: t.milestone || 1,
    milestone_name: t.milestone_name || "",
    milestones: t.milestones || [],
    lifetime: t.lifetime,
    verification: t.verification || "pending",
    gap_cycles: (t.gap_cycles || {})[String(s.phase)] || 0,
    gap_cycle_limit: getGapCycleLimit(),
    tasks_done: t.tasks_done || 0,
    tasks_total: t.tasks_total || 0,
    deployed_url: t.deployed_url || "",
    next_command: nextCommand(
      s.status,
      s.phase,
      s.total_phases,
      t.verification
    ),
    schema_errors: s.schema_errors && s.schema_errors.length ? s.schema_errors : undefined,
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

  // Refuse transitions if STATE.md has schema errors (severity=error)
  if (s.schema_errors && s.schema_errors.some((e) => e.severity === "error")) {
    return output(
      fail(
        "STATE_SCHEMA_ERROR",
        "STATE.md is malformed. Run `node state.js check` to see errors. Consider `state.js fix` to rewrite canonically."
      )
    );
  }

  // Special: note/activity (no status change)
  if (target === "note" || target === "activity") {
    if (opts.notes) t.notes = opts.notes;
    // Count tasks from quick/task work toward lifetime
    if (opts.tasks_done) {
      const count = parseInt(opts.tasks_done) || 0;
      if (count > 0) {
        ensureLifetime(t);
        t.lifetime.tasks_completed += count;
      }
    }
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
  if (!check.ok) {
    // Force bypasses status-ordering errors AND plan-content errors. The use case
    // is retroactive bookkeeping: a phase was built without /qualia-plan and the
    // user is catching STATE.md up to reality. `--force` never bypasses MISSING_FILE
    // or MISSING_ARG — those would leave the state machine pointing at nothing.
    const forceableErrors = [
      "PRECONDITION_FAILED",
      "GAP_CYCLE_LIMIT",
      "INVALID_PLAN",
    ];
    if (opts.force && forceableErrors.includes(check.error)) {
      console.error(`WARNING: Forcing transition despite: ${check.message}`);
    } else {
      return output(check);
    }
  }

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
    t.build_count = (parseInt(t.build_count) || 0) + 1;
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
      // Accumulate into lifetime BEFORE resetting current counters
      ensureLifetime(t);
      t.lifetime.tasks_completed += (t.tasks_done || 0);
      t.lifetime.phases_completed += 1;

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
    // Mark every passed phase as polished (polish is a whole-project pass).
    // Previously only the last roadmap row was touched, and was set to
    // "verified" — which both lost current-phase context and used the wrong
    // status string. Now we use "polished" on every row that's already at
    // verified or polished or completed.
    for (const p of s.phases) {
      const st = (p.status || "").toLowerCase();
      if (st === "verified" || st === "polished" || st === "completed" || st === "complete") {
        p.status = "polished";
      }
    }
  }

  if (target === "shipped") {
    t.deployed_url = opts.deployed_url || "";
    t.deploy_count = (parseInt(t.deploy_count) || 0) + 1;
  }

  // Write both files
  const backupState = readState();
  try {
    writeStateMd(s);
    writeTracking(t);
  } catch (e) {
    // Revert STATE.md on failure (atomic so the revert itself is safe)
    if (backupState) atomicWrite(STATE_FILE, backupState);
    return output(fail("WRITE_ERROR", e.message));
  }

  // Skill outcome scoring — log transition for analytics
  _trace("state-transition", "allow", {
    phase: s.phase,
    status: s.status,
    previous_status: prevStatus,
    verification: t.verification,
    gap_closure: prevStatus === "verified" && target === "planned",
  });

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

  // Refuse to clobber an active project unless --force.
  // Lifetime preservation runs lower in this fn — but current-phase fields
  // (phase, status, wave, tasks_done, tasks_total, gap_cycles) ARE wiped
  // on init, which is a footgun for an in-progress project.
  if (!opts.force && fs.existsSync(STATE_FILE)) {
    return output(
      fail(
        "ALREADY_INITIALIZED",
        "Project already initialized at .planning/STATE.md. Use --force to re-initialize (preserves lifetime, resets current phase)."
      )
    );
  }

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

  // Read existing tracking for lifetime data preservation across milestone resets
  const prev = readTracking();
  const prevLife = prev ? ensureLifetime(prev) : null;

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

  // Defensive lifetime hydrate: even if `prevLife.lifetime` is partial (an
  // older tracking.json missing some keys), the spread would leave gaps that
  // later `+=` would NaN. Build with safe defaults, then overlay.
  const defaultLifetime = {
    tasks_completed: 0,
    phases_completed: 0,
    milestones_completed: 0,
    total_phases: 0,
    last_closed_milestone: 0,
  };
  const lifetime = prevLife
    ? { ...defaultLifetime, ...(prevLife.lifetime || {}) }
    : { ...defaultLifetime };

  // Preserve milestones array across re-init (v4: milestone summaries for ERP tree).
  const prevMilestones = (prevLife && Array.isArray(prevLife.milestones)) ? prevLife.milestones : [];

  // Build tracking — current-phase fields reset, lifetime + identity preserved
  const t = {
    project: opts.project,
    client: opts.client || (prevLife ? prevLife.client : ""),
    type: opts.type || (prevLife ? prevLife.type : ""),
    assigned_to: opts.assigned_to || (prevLife ? prevLife.assigned_to : ""),
    team_id: opts.team_id || (prevLife ? prevLife.team_id || "" : ""),
    project_id: opts.project_id || (prevLife ? prevLife.project_id || "" : ""),
    git_remote: opts.git_remote || (prevLife ? prevLife.git_remote || "" : ""),
    milestone: prevLife ? prevLife.milestone : 1,
    milestone_name: opts.milestone_name || (prevLife ? prevLife.milestone_name || "" : ""),
    milestones: prevMilestones,
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
    session_started_at: now,
    last_updated: now,
    last_pushed_at: prevLife ? prevLife.last_pushed_at || "" : "",
    last_commit: prevLife ? prevLife.last_commit : "",
    build_count: prevLife ? (prevLife.build_count || 0) : 0,
    deploy_count: prevLife ? (prevLife.deploy_count || 0) : 0,
    deployed_url: prevLife ? prevLife.deployed_url : "",
    notes: "",
    submitted_by: opts.assigned_to || (prevLife ? prevLife.submitted_by || "" : ""),
    lifetime,
  };
  // lifetime.total_phases starts at 0 for new projects. It accumulates only via
  // close-milestone (which adds current total_phases before the next init).
  // The ERP computes grand total as: lifetime.total_phases + current total_phases.

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

function cmdFix(opts) {
  const raw = readState();
  const t = readTracking();
  if (!raw && !t) {
    return output(
      fail("NO_PROJECT", "No .planning/ found. Run /qualia-new.")
    );
  }
  const parsed = parseStateMd(raw) || {
    phase: 1,
    total_phases: 1,
    phase_name: "",
    status: "setup",
    assigned_to: "",
    phases: [],
    schema_errors: [
      { field: "content", message: "STATE.md missing or empty", severity: "error" },
    ],
  };
  const previousErrors = (parsed.schema_errors || []).length;

  // Prefer tracking.json values when parsed fields are defaulted/missing
  const tr = t || {};
  const totalPhases =
    parseInt(tr.total_phases) || parsed.total_phases || parsed.phases.length || 1;
  const phaseNum = parseInt(tr.phase) || parsed.phase || 1;
  const phaseName =
    (parsed.phase_name && parsed.phase_name.trim()) ||
    tr.phase_name ||
    `Phase ${phaseNum}`;
  const status = parsed.status || tr.status || "setup";
  const assignedTo = parsed.assigned_to || tr.assigned_to || "";

  // Build a phases array of the right length
  const phases = [];
  for (let i = 0; i < totalPhases; i++) {
    const existing = parsed.phases[i];
    phases.push({
      num: i + 1,
      name: existing?.name || `Phase ${i + 1}`,
      goal: existing?.goal || "TBD",
      status: existing?.status || (i === 0 ? "ready" : "—"),
    });
  }

  const s = {
    phase: phaseNum,
    total_phases: totalPhases,
    phase_name: phaseName,
    status,
    assigned_to: assignedTo,
    last_activity: "STATE.md repaired by state.js fix",
    phases,
    blockers: "None.",
    resume: "—",
  };

  try {
    writeStateMd(s);
  } catch (e) {
    return output(fail("WRITE_ERROR", e.message));
  }

  output({
    ok: true,
    action: "fix",
    previous_errors: previousErrors,
    fixed: true,
  });
}

function cmdValidatePlan(opts) {
  const phase = parseInt(opts.phase) || 1;
  const planFile = path.join(PLANNING, `phase-${phase}-plan.md`);

  if (!fs.existsSync(planFile)) {
    return output(fail("MISSING_FILE", `Plan file not found: ${planFile}`));
  }

  const content = fs.readFileSync(planFile, "utf8");
  const errors = [];

  // Check frontmatter exists
  if (!/^---\n/.test(content)) {
    errors.push("Missing frontmatter (---) at start of file");
  }

  // Check task count > 0
  const taskHeaders = content.match(/^## Task \d+/gm);
  if (!taskHeaders || taskHeaders.length === 0) {
    errors.push("No task headers found (expected '## Task N — title')");
  }

  // Check "Done when" OR "Acceptance Criteria" anchor exists for each task
  // (story-file format uses Acceptance Criteria; legacy format uses Done when)
  const taskCount = taskHeaders ? taskHeaders.length : 0;
  const doneWhenCount = (content.match(/\*\*Done when:\*\*/g) || []).length;
  const acCount = (content.match(/\*\*Acceptance Criteria:\*\*/g) || []).length;
  const anchors = doneWhenCount + acCount;
  if (anchors < taskCount) {
    errors.push(
      `${taskCount} tasks but only ${anchors} 'Done when:' or 'Acceptance Criteria:' anchors`
    );
  }

  // Check Success Criteria section exists
  if (!/## Success Criteria/m.test(content)) {
    errors.push("Missing '## Success Criteria' section");
  }

  // Check goal in frontmatter
  if (!/^goal:/m.test(content)) {
    errors.push("Missing 'goal:' in frontmatter");
  }

  // ─── Verification Contract Validation (non-blocking) ────
  const warnings = [];
  const VALID_CHECK_TYPES = ["file-exists", "grep-match", "command-exit", "behavioral"];
  let contractCount = 0;

  if (/^## Verification Contract/m.test(content)) {
    // Extract the contract section (from header to next ## or end of file)
    const contractSectionMatch = content.match(
      /^## Verification Contract\s*\n([\s\S]+)/m
    );
    if (contractSectionMatch) {
      // Trim at the next ## heading that isn't ### (i.e., a new top-level section)
      let contractSection = contractSectionMatch[1];
      const nextH2 = contractSection.search(/\n## (?!#)/);
      if (nextH2 !== -1) contractSection = contractSection.substring(0, nextH2);
      // Each contract starts with ### Contract for Task N
      const contractBlocks = contractSection.match(/^### Contract for Task \d+/gm);
      contractCount = contractBlocks ? contractBlocks.length : 0;

      if (contractCount === 0) {
        warnings.push("Verification Contract section exists but contains no contract blocks (expected '### Contract for Task N')");
      } else {
        // Split into individual contract blocks for validation
        const blockSplits = contractSection.split(/^(?=### Contract for Task \d+)/m).filter(Boolean);
        for (const block of blockSplits) {
          const taskNumMatch = block.match(/^### Contract for Task (\d+)/);
          if (!taskNumMatch) continue;
          const taskNum = taskNumMatch[1];

          const checkTypeMatch = block.match(/\*\*Check type:\*\*\s*(.+)/);
          const hasCommand = /\*\*Command:\*\*/.test(block);
          const hasExpected = /\*\*Expected:\*\*/.test(block);
          const hasFailIf = /\*\*Fail if:\*\*/.test(block);

          if (!checkTypeMatch) {
            warnings.push(`Contract for Task ${taskNum}: missing 'Check type'`);
          } else {
            const checkType = checkTypeMatch[1].trim().toLowerCase();
            if (!VALID_CHECK_TYPES.includes(checkType)) {
              warnings.push(
                `Contract for Task ${taskNum}: invalid check type '${checkType}' (valid: ${VALID_CHECK_TYPES.join(", ")})`
              );
            }
            // behavioral type doesn't require Command or Expected
            const isBehavioral = checkType === "behavioral";
            if (!isBehavioral && !hasCommand) {
              warnings.push(`Contract for Task ${taskNum}: missing 'Command' (required for ${checkType})`);
            }
            if (!isBehavioral && !hasExpected) {
              warnings.push(`Contract for Task ${taskNum}: missing 'Expected' (required for ${checkType})`);
            }
          }

          if (!hasFailIf) {
            warnings.push(`Contract for Task ${taskNum}: missing 'Fail if'`);
          }
        }
      }

      // Warn if contract count < task count
      if (taskCount > 0 && contractCount > 0 && contractCount < taskCount) {
        warnings.push(
          `Only ${contractCount} contract(s) for ${taskCount} task(s) — not all tasks have verification contracts`
        );
      }
    }
  }

  if (errors.length > 0) {
    return output({
      ok: false,
      error: "PLAN_VALIDATION_FAILED",
      phase,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: `Plan file has ${errors.length} issue(s)`,
    });
  }

  output({
    ok: true,
    action: "validate-plan",
    phase,
    task_count: taskCount,
    done_when_count: doneWhenCount,
    ac_count: acCount,
    contract_count: contractCount,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}

// ─── Close Milestone ─────────────────────────────────────
// Idempotent: a sentinel `lifetime.last_closed_milestone` records the most
// recently closed milestone so re-running close-milestone (e.g., after a
// hiccup) does NOT double-count. To re-close a milestone deliberately, pass
// --force.
function cmdCloseMilestone(opts) {
  const t = readTracking();
  const s = parseStateMd(readState());
  if (!t || !s) {
    return output(fail("NO_PROJECT", "No .planning/ found."));
  }
  ensureLifetime(t);

  const closedMilestone = t.milestone || 1;
  if (
    !opts.force &&
    typeof t.lifetime.last_closed_milestone === "number" &&
    t.lifetime.last_closed_milestone >= closedMilestone
  ) {
    return output(
      fail(
        "ALREADY_CLOSED",
        `Milestone ${closedMilestone} was already closed (last_closed_milestone=${t.lifetime.last_closed_milestone}). Use --force to close again.`
      )
    );
  }

  // ─── v4 guard rails ─────────────────────────────────────
  // A milestone is only closable if it actually acted like one:
  //   (a) all its phases are verified/polished/completed, AND
  //   (b) it had ≥ 2 phases (so a 1-phase "milestone" is forced back to being a phase).
  // Both guards are bypassable with --force for retroactive bookkeeping.
  if (!opts.force) {
    const totalPhases = parseInt(t.total_phases) || s.phases.length || 0;
    if (totalPhases < 2) {
      return output(
        fail(
          "MILESTONE_TOO_SMALL",
          `Milestone ${closedMilestone} has only ${totalPhases} phase(s). A milestone needs ≥ 2 phases OR must be a shipped release gate. Use --force if this is intentional (e.g. a preview/demo milestone).`
        )
      );
    }
    const unfinished = s.phases.filter((p) => {
      const st = (p.status || "").toLowerCase();
      return !(st === "verified" || st === "polished" || st === "completed" || st === "complete");
    });
    if (unfinished.length > 0) {
      return output(
        fail(
          "MILESTONE_NOT_READY",
          `Milestone ${closedMilestone} has ${unfinished.length} unfinished phase(s): ${unfinished.map((p) => `${p.num}:${p.name}`).join(", ")}. Verify them first, or use --force.`
        )
      );
    }
  }

  // ─── Append a summary to milestones[] so the ERP can render the tree ──
  // This is the minimal metadata needed to reconstruct "milestone N of the
  // project contained these phases" without replaying git history.
  const phasesCompleted = s.phases.filter((p) => {
    const st = (p.status || "").toLowerCase();
    return st === "verified" || st === "polished" || st === "completed" || st === "complete";
  }).length;
  const summary = {
    num: closedMilestone,
    name: t.milestone_name || `Milestone ${closedMilestone}`,
    total_phases: parseInt(t.total_phases) || s.phases.length || 0,
    phases_completed: phasesCompleted,
    tasks_completed: parseInt(t.tasks_done) || 0,
    shipped_url: t.deployed_url || "",
    closed_at: new Date().toISOString(),
  };
  t.milestones = Array.isArray(t.milestones) ? t.milestones : [];
  // Idempotency: don't duplicate if the same milestone number is already logged.
  const existing = t.milestones.findIndex((m) => m && m.num === closedMilestone);
  if (existing >= 0) {
    t.milestones[existing] = summary;
  } else {
    t.milestones.push(summary);
  }

  t.lifetime.milestones_completed += 1;
  t.lifetime.total_phases += (parseInt(t.total_phases) || 0);
  t.lifetime.last_closed_milestone = closedMilestone;
  t.milestone = closedMilestone + 1;
  t.milestone_name = ""; // cleared; /qualia-milestone reads next one from JOURNEY.md
  t.last_updated = new Date().toISOString();

  writeTracking(t);

  _trace("close-milestone", "allow", {
    closed_milestone: closedMilestone,
    next_milestone: t.milestone,
    lifetime: t.lifetime,
  });

  output({
    ok: true,
    action: "close-milestone",
    closed_milestone: closedMilestone,
    next_milestone: t.milestone,
    lifetime: t.lifetime,
  });
}

// ─── Backfill Lifetime ───────────────────────────────────
// Reconstructs lifetime counters from STATE.md roadmap + plan files.
// Safe to run multiple times (idempotent — recalculates from source).
function cmdBackfillLifetime(opts) {
  const t = readTracking();
  const s = parseStateMd(readState());
  if (!t || !s) {
    return output(fail("NO_PROJECT", "No .planning/ found."));
  }
  ensureLifetime(t);

  let phasesCompleted = 0;
  let tasksCompleted = 0;

  // Count completed phases from roadmap table
  for (const p of s.phases) {
    const st = (p.status || "").toLowerCase();
    if (st === "verified" || st === "completed" || st === "complete") {
      phasesCompleted++;

      // Count tasks from that phase's plan file
      const planFile = path.join(PLANNING, `phase-${p.num}-plan.md`);
      const gapsPlanFile = path.join(PLANNING, `phase-${p.num}-gaps-plan.md`);
      for (const f of [planFile, gapsPlanFile]) {
        try {
          if (fs.existsSync(f)) {
            const content = fs.readFileSync(f, "utf8");
            const taskHeaders = content.match(/^## Task \d+/gm);
            if (taskHeaders) tasksCompleted += taskHeaders.length;
          }
        } catch {}
      }
    }
  }

  // Also count the current phase if it's past built (tasks exist but phase not yet verified)
  const currentStatus = (t.status || "").toLowerCase();
  if (currentStatus === "built" || currentStatus === "verified") {
    // Current phase tasks are already in t.tasks_done — add if not already counted
    const currentPhaseAlreadyCounted = s.phases.some(
      (p) => p.num === t.phase && ["verified", "completed", "complete"].includes((p.status || "").toLowerCase())
    );
    if (!currentPhaseAlreadyCounted && t.tasks_done > 0) {
      tasksCompleted += t.tasks_done;
    }
  }

  const previous = { ...t.lifetime };

  // Use Math.max — backfill must NEVER reduce lifetime counters. If the user
  // ran close-milestone previously (rolling phases into lifetime) and then
  // calls backfill, the recomputed value reflects only the current milestone
  // and would otherwise destroy the historical accumulation.
  t.lifetime.phases_completed = Math.max(t.lifetime.phases_completed || 0, phasesCompleted);
  t.lifetime.tasks_completed = Math.max(t.lifetime.tasks_completed || 0, tasksCompleted);
  // total_phases is accumulated by close-milestone only — backfill leaves it.
  t.last_updated = new Date().toISOString();

  writeTracking(t);

  _trace("backfill-lifetime", "allow", {
    previous,
    computed: t.lifetime,
    phases_scanned: s.phases.length,
  });

  output({
    ok: true,
    action: "backfill-lifetime",
    previous,
    computed: t.lifetime,
    phases_scanned: s.phases.length,
    phases_completed: phasesCompleted,
    tasks_completed: tasksCompleted,
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

// Mutators must hold the .planning/.state.lock for the duration of their
// dual STATE.md + tracking.json writes. Read commands (check, validate-plan)
// don't need the lock. The lock is best-effort: if it can't be acquired
// inside acquireLock's timeout, the command proceeds anyway — we'd rather
// risk a rare race than hard-block the user.
const READ_ONLY = new Set(["check", "validate-plan"]);
let __lock = null;
if (!READ_ONLY.has(cmd)) {
  __lock = acquireLock();
  process.on("exit", () => releaseLock(__lock));
  process.on("SIGINT", () => { releaseLock(__lock); process.exit(130); });
  process.on("SIGTERM", () => { releaseLock(__lock); process.exit(143); });
}

try {
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
    case "fix":
      cmdFix(opts);
      break;
    case "validate-plan":
      cmdValidatePlan(opts);
      break;
    case "close-milestone":
      cmdCloseMilestone(opts);
      break;
    case "backfill-lifetime":
      cmdBackfillLifetime(opts);
      break;
    default:
      output(
        fail(
          "UNKNOWN_COMMAND",
          `Usage: state.js <check|transition|init|fix|validate-plan|close-milestone|backfill-lifetime> [--options]`
        )
      );
  }
} finally {
  releaseLock(__lock);
}
