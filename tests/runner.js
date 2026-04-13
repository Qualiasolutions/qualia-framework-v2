#!/usr/bin/env node
// Cross-platform test runner — works on Fedora, EndeavourOS, macOS, and Windows
// Uses node:test (built-in, no dependencies)

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin");
const HOOKS = path.join(ROOT, "hooks");

// Helper: run a bin/ script and return {stdout, stderr, status}
function run(script, args = [], opts = {}) {
  const result = spawnSync(process.execPath, [path.join(BIN, script), ...args], {
    encoding: "utf8",
    timeout: 10000,
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...opts.env },
    input: opts.input || undefined,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

// Helper: run a hook with JSON input on stdin
function runHook(hookFile, jsonInput) {
  const hookPath = path.join(HOOKS, hookFile);
  const result = spawnSync(process.execPath, [hookPath], {
    encoding: "utf8",
    timeout: 5000,
    input: JSON.stringify(jsonInput),
    env: { ...process.env, HOME: os.tmpdir(), USERPROFILE: os.tmpdir() },
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

// Helper: run state.js with args in a given cwd
function runState(args, cwd) {
  const result = spawnSync(process.execPath, [path.join(BIN, "state.js"), ...args], {
    encoding: "utf8",
    timeout: 5000,
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

// Helper: create temp directory with .planning
function withTempPlanning(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-test-"));
  const planningDir = path.join(tmpDir, ".planning");
  fs.mkdirSync(planningDir, { recursive: true });
  try {
    fn(tmpDir, planningDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Helper: create a full temp project (init with 2 phases)
function makeProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-proj-"));
  const r = spawnSync(process.execPath, [
    path.join(BIN, "state.js"), "init",
    "--project", "TestProject",
    "--phases", '[{"name":"Foundation","goal":"Auth"},{"name":"Core","goal":"Features"}]',
  ], {
    encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    throw new Error(`makeProject init failed: ${r.stdout} ${r.stderr}`);
  }
  return tmpDir;
}

// Helper: write a valid plan file
function makeValidPlan(dir, phase) {
  phase = phase || 1;
  const plan = `---
phase: ${phase}
goal: "Test goal"
tasks: 1
waves: 1
---

# Phase ${phase}: Test

Goal: Test goal

## Task 1 — Test task
**Wave:** 1
**Files:** src/test.ts
**Action:** Create test file
**Done when:** File exists

## Success Criteria
- [ ] Test passes
`;
  fs.writeFileSync(path.join(dir, ".planning", `phase-${phase}-plan.md`), plan);
}

// Helper: strip ANSI escape codes
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

// Helper: get package version
const PKG_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

// ═══════════════════════════════════════════════════════════
// CLI Tests
// ═══════════════════════════════════════════════════════════

describe("CLI", () => {
  it("no args shows help banner", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", [], { env: { HOME: tmpHome, USERPROFILE: tmpHome } });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /Qualia Framework/);
      assert.match(clean, /Commands:/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("help mentions all commands", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["help"], { env: { HOME: tmpHome, USERPROFILE: tmpHome } });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /install/);
      assert.match(clean, /update/);
      assert.match(clean, /version/);
      assert.match(clean, /uninstall/);
      assert.match(clean, /migrate/);
      assert.match(clean, /team/);
      assert.match(clean, /traces/);
      assert.match(clean, /analytics/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("shows version", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["version"], {
        env: { HOME: tmpHome, USERPROFILE: tmpHome, npm_config_registry: "http://127.0.0.1:1/" },
      });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /Installed:/);
      assert.match(clean, new RegExp(PKG_VERSION.replace(/\./g, "\\.")));
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("-v is alias for version", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["-v"], {
        env: { HOME: tmpHome, USERPROFILE: tmpHome, npm_config_registry: "http://127.0.0.1:1/" },
      });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /Installed:/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("--version is alias for version", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["--version"], {
        env: { HOME: tmpHome, USERPROFILE: tmpHome, npm_config_registry: "http://127.0.0.1:1/" },
      });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /Installed:/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("unknown command falls through to help", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["frobnicate"], { env: { HOME: tmpHome, USERPROFILE: tmpHome } });
      assert.equal(r.status, 0);
      assert.match(stripAnsi(r.stdout), /Qualia Framework/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("team list works", () => {
    const r = run("cli.js", ["team", "list"]);
    assert.equal(r.status, 0);
    assert.match(stripAnsi(r.stdout), /QS-FAWZI-01/);
  });

  it("traces handles missing traces dir", () => {
    const r = run("cli.js", ["traces"]);
    assert.equal(r.status, 0);
  });

  it("analytics handles missing traces dir", () => {
    const r = run("cli.js", ["analytics"]);
    assert.equal(r.status, 0);
  });

  it("version with config shows User line", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
      fs.writeFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), JSON.stringify({
        code: "QS-FAWZI-01",
        installed_by: "Fawzi Goussous",
        role: "OWNER",
        version: "2.8.1",
        installed_at: "2026-04-10",
      }));
      const r = run("cli.js", ["version"], {
        env: { HOME: tmpHome, USERPROFILE: tmpHome, npm_config_registry: "http://127.0.0.1:1/" },
      });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /User:/);
      assert.match(clean, /Fawzi Goussous/);
      assert.match(clean, /OWNER/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("update without config exits 1", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["update"], { env: { HOME: tmpHome, USERPROFILE: tmpHome } });
      assert.equal(r.status, 1);
      assert.match(stripAnsi(r.stdout), /No install code saved/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("upgrade alias behaves same as update", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-cli-"));
    try {
      const r = run("cli.js", ["upgrade"], { env: { HOME: tmpHome, USERPROFILE: tmpHome } });
      assert.equal(r.status, 1);
      assert.match(stripAnsi(r.stdout), /No install code saved/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// State Machine Tests
// ═══════════════════════════════════════════════════════════

describe("State Machine", () => {
  it("check fails without .planning directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-state-"));
    try {
      const r = runState(["check"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, false);
      assert.equal(out.error, "NO_PROJECT");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init creates state and tracking files", () => {
    withTempPlanning((tmpDir) => {
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "init",
        "--project", "test-proj",
        "--phases", '[{"name":"Foundation","goal":"Auth"}]',
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.project, "test-proj");
      assert.ok(fs.existsSync(path.join(tmpDir, ".planning", "STATE.md")));
      assert.ok(fs.existsSync(path.join(tmpDir, ".planning", "tracking.json")));
    });
  });

  it("init tracking.json has correct fields", () => {
    const tmpDir = makeProject();
    try {
      const tracking = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(tracking.project, "TestProject");
      assert.equal(tracking.total_phases, 2);
      assert.equal(tracking.phase, 1);
      assert.equal(tracking.status, "setup");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init STATE.md has correct header", () => {
    const tmpDir = makeProject();
    try {
      const state = fs.readFileSync(path.join(tmpDir, ".planning", "STATE.md"), "utf8");
      assert.match(state, /Phase: 1 of 2 — Foundation/);
      assert.match(state, /Status: setup/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("check reads back init state", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["check"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.phase, 1);
      assert.equal(out.status, "setup");
      assert.equal(out.total_phases, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("transition requires --to", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_ARG");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("transition rejects invalid status jumps (setup -> built)", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "built"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "PRECONDITION_FAILED");
      assert.match(out.message, /Cannot go from 'setup' to 'built'/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("setup -> planned succeeds with plan file", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      const r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.status, "planned");
      assert.equal(out.previous_status, "setup");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("planned -> built records tasks_done/tasks_total", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      const r = runState(["transition", "--to", "built", "--tasks-done", "5", "--tasks-total", "5"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.status, "built");
      const tracking = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(tracking.tasks_done, 5);
      assert.equal(tracking.tasks_total, 5);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("built -> verified(pass) auto-advances to phase 2", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "5", "--tasks-total", "5"], tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "pass");
      const r = runState(["transition", "--to", "verified", "--verification", "pass"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.phase, 2);
      assert.equal(out.status, "setup");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("built -> verified(fail) stays on same phase", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "3", "--tasks-total", "5"], tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "fail");
      const r = runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.phase, 1);
      assert.equal(out.status, "verified");
      assert.equal(out.verification, "fail");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("planned -> verified fails (requires built)", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "");
      const r = runState(["transition", "--to", "verified", "--verification", "pass"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "PRECONDITION_FAILED");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("setup -> planned fails without plan file (MISSING_FILE)", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_FILE");
      assert.match(out.message, /phase-1-plan\.md/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("built -> verified fails without verification file", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      const r = runState(["transition", "--to", "verified", "--verification", "pass"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_FILE");
      assert.match(out.message, /phase-1-verification\.md/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("built -> verified without --verification -> MISSING_ARG", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "");
      const r = runState(["transition", "--to", "verified"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_ARG");
      assert.match(out.message, /verification/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("unknown target -> INVALID_STATUS", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "frobnicate"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "INVALID_STATUS");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("unknown command shows usage", () => {
    const r = runState(["bogus"], ROOT);
    assert.equal(r.status, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.error, "UNKNOWN_COMMAND");
  });

  it("validate-plan accepts well-formed plan", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      const r = runState(["validate-plan", "--phase", "1"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.task_count, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("validate-plan rejects non-existent plan", () => {
    withTempPlanning((tmpDir) => {
      const r = runState(["validate-plan", "--phase", "1"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_FILE");
    });
  });

  it("validate-plan rejects plan without tasks", () => {
    const tmpDir = makeProject();
    try {
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-plan.md"), "---\ngoal: test\n---\n\nNo tasks here.\n");
      const r = runState(["validate-plan", "--phase", "1"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "PLAN_VALIDATION_FAILED");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("validate-plan rejects plan missing Done when", () => {
    const tmpDir = makeProject();
    try {
      const plan = `---
phase: 1
goal: "Test"
tasks: 1
waves: 1
---
## Task 1 — Incomplete
**Wave:** 1
**Files:** test.ts
**Action:** Do something

## Success Criteria
- [ ] Works
`;
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-plan.md"), plan);
      const r = runState(["validate-plan", "--phase", "1"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "PLAN_VALIDATION_FAILED");
      // The error detail is in the errors array, mentioning "Done when"
      const errStr = JSON.stringify(out.errors || []);
      assert.match(errStr, /Done when/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("transition to planned with invalid plan -> INVALID_PLAN", () => {
    const tmpDir = makeProject();
    try {
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-plan.md"), "# Empty plan with no tasks");
      const r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "INVALID_PLAN");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fix repairs malformed STATE.md", () => {
    const tmpDir = makeProject();
    try {
      fs.writeFileSync(path.join(tmpDir, ".planning", "STATE.md"), "corrupted content");
      const r = runState(["fix"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.fixed, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fix on well-formed STATE.md is idempotent", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["fix"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.previous_errors, 0);
      // Check output is still valid
      const r2 = runState(["check"], tmpDir);
      const out2 = JSON.parse(r2.stdout);
      assert.equal(out2.ok, true);
      assert.equal(out2.phase, 1);
      assert.equal(out2.total_phases, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("gap cycle circuit breaker blocks after limit", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "");

      // Cycle 1: planned -> built -> verified(fail) -> planned
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      let r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 0);
      let out = JSON.parse(r.stdout);
      assert.equal(out.gap_cycles, 1);

      // Cycle 2
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 0);
      out = JSON.parse(r.stdout);
      assert.equal(out.gap_cycles, 2);

      // Cycle 3: should be blocked
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 1);
      out = JSON.parse(r.stdout);
      assert.equal(out.error, "GAP_CYCLE_LIMIT");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("verified(pass) resets gap_cycles to 0", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "");

      // One fail cycle
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      runState(["transition", "--to", "planned"], tmpDir);

      // Now pass
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "pass"], tmpDir);

      const tracking = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      // gap_cycles for phase 1 should be reset to 0
      assert.ok(tracking.gap_cycles);
      assert.equal(tracking.gap_cycles["1"], 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("configurable gap_cycle_limit allows more cycles", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "");

      // Set custom limit
      const trackingPath = path.join(tmpDir, ".planning", "tracking.json");
      const tracking = JSON.parse(fs.readFileSync(trackingPath, "utf8"));
      tracking.gap_cycle_limit = 5;
      fs.writeFileSync(trackingPath, JSON.stringify(tracking, null, 2));

      // 3 gap closure cycles (default limit is 2, but we set 5)
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      runState(["transition", "--to", "planned"], tmpDir);

      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      runState(["transition", "--to", "planned"], tmpDir);

      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      runState(["transition", "--to", "verified", "--verification", "fail"], tmpDir);
      // 3rd closure should succeed (limit is 5)
      const r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--to note records notes without status change", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "note", "--notes", "hello world"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.action, "note");
      assert.equal(out.status, "setup");
      const tracking = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(tracking.notes, "hello world");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--to activity succeeds without status change", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "activity"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.action, "activity");
      assert.equal(out.status, "setup");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--force bypasses precondition (setup -> built)", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "built", "--force"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.status, "built");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--force does NOT bypass MISSING_FILE", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "planned", "--force"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_FILE");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--force bypasses INVALID_PLAN (retroactive bookkeeping)", () => {
    // Use case: a phase was built without /qualia-plan and the user is
    // catching STATE.md up to reality. The plan file exists as documentation
    // but lacks `**Done when:**` markers — that should not block --force.
    const tmpDir = makeProject();
    try {
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-plan.md"), "# No tasks here");
      const r = runState(["transition", "--to", "planned", "--force"], tmpDir);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.ok, true);
      assert.equal(out.status, "planned");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--force still rejects MISSING_FILE", () => {
    // Sanity: --force unblocks plan-content errors but not "no plan at all".
    const tmpDir = makeProject();
    try {
      const r = runState(["transition", "--to", "planned", "--force"], tmpDir);
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MISSING_FILE");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("check includes gap_cycle_limit in output", () => {
    const tmpDir = makeProject();
    try {
      const r = runState(["check"], tmpDir);
      const out = JSON.parse(r.stdout);
      assert.ok("gap_cycle_limit" in out);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Hook Tests
// ═══════════════════════════════════════════════════════════

describe("Hooks", () => {
  it("all hooks pass syntax check", () => {
    const hooks = fs.readdirSync(HOOKS).filter(f => f.endsWith(".js"));
    assert.ok(hooks.length >= 7, `Expected 7+ hooks, found ${hooks.length}`);
    for (const hook of hooks) {
      const r = spawnSync(process.execPath, ["--check", path.join(HOOKS, hook)], {
        encoding: "utf8", timeout: 5000,
      });
      assert.equal(r.status, 0, `Syntax error in ${hook}: ${r.stderr}`);
    }
  });

  // --- migration-guard.js ---

  it("migration-guard blocks DROP without IF EXISTS", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/001.sql", content: "DROP TABLE users;" },
    });
    assert.equal(r.status, 2, "Should block (exit 2)");
  });

  it("migration-guard allows DROP TABLE IF EXISTS", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/001.sql", content: "DROP TABLE IF EXISTS users;" },
    });
    assert.equal(r.status, 0);
  });

  it("migration-guard blocks DELETE without WHERE", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/002.sql", content: "DELETE FROM users;" },
    });
    assert.equal(r.status, 2);
  });

  it("migration-guard allows DELETE with WHERE", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/002.sql", content: "DELETE FROM users WHERE id = 1;" },
    });
    assert.equal(r.status, 0);
  });

  it("migration-guard blocks TRUNCATE", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/003.sql", content: "TRUNCATE TABLE sessions;" },
    });
    assert.equal(r.status, 2);
  });

  it("migration-guard blocks CREATE TABLE without RLS", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/003.sql", content: "CREATE TABLE users (id uuid primary key);" },
    });
    assert.equal(r.status, 2);
  });

  it("migration-guard allows CREATE TABLE with RLS", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/003.sql", content: "CREATE TABLE users (id uuid primary key);\nALTER TABLE users ENABLE ROW LEVEL SECURITY;" },
    });
    assert.equal(r.status, 0);
  });

  it("migration-guard allows safe ALTER TABLE", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "migrations/005.sql", content: "ALTER TABLE users ADD COLUMN email text;" },
    });
    assert.equal(r.status, 0);
  });

  it("migration-guard ignores non-migration files", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "src/app.tsx", content: "DROP TABLE users;" },
    });
    assert.equal(r.status, 0);
  });

  // block-env-edit.js was retired in v3.2.0 — team now has full read/write on
  // .env* files. See CHANGELOG v3.2.0 and bin/install.js DEPRECATED_HOOKS.

  // --- pre-push.js ---

  it("pre-push.js references tracking.json", () => {
    const content = fs.readFileSync(path.join(HOOKS, "pre-push.js"), "utf8");
    assert.match(content, /tracking\.json/);
  });

  it("pre-push.js stamps last_commit", () => {
    const content = fs.readFileSync(path.join(HOOKS, "pre-push.js"), "utf8");
    assert.match(content, /last_commit/);
  });

  it("pre-push.js exits 0 with no tracking.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-push-"));
    try {
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-push.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --- session-start.js ---

  it("session-start.js exits 0 with no project", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-ss-"));
    try {
      const r = spawnSync(process.execPath, [path.join(HOOKS, "session-start.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("session-start.js exits 0 with STATE.md", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-ss-"));
    try {
      const planningDir = path.join(tmpDir, ".planning");
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, "STATE.md"), "# Project State\nPhase: 1 of 3 — Foundation\nStatus: setup\n");
      const r = spawnSync(process.execPath, [path.join(HOOKS, "session-start.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --- pre-compact.js ---

  it("pre-compact.js exits 0 with no STATE.md", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pc-"));
    try {
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-compact.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --- auto-update.js ---

  it("auto-update.js exits 0 and writes cache timestamp", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-au-"));
    try {
      fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
      fs.writeFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), JSON.stringify({
        code: "QS-FAWZI-01", version: "99.99.99",
      }));
      const r = spawnSync(process.execPath, [path.join(HOOKS, "auto-update.js")], {
        encoding: "utf8", timeout: 5000,
        env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", ".qualia-last-update-check")));
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  // --- pre-deploy-gate.js ---

  it("pre-deploy-gate: empty project exits 0", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: no tsconfig -> TS gate skipped", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "app.ts"), "export const x = 1;");
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: service_role in app/ -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "page.tsx"), 'const key = "service_role_literal_leak";\nexport default function P(){return null}');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 1);
      const combined = r.stdout + r.stderr;
      assert.match(combined, /BLOCKED/);
      assert.match(combined, /service_role/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: service_role in components/ -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "components"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "components", "Widget.tsx"), 'const key = "service_role_literal_leak";');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: .server.ts is exempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "api"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "api", "route.server.ts"), 'const key = "service_role_legit_server_key";');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: files under server/ are exempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "server"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "server", "admin.ts"), 'const key = "service_role_legit_server_dir";');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: node_modules not walked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "node_modules", "evil"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "node_modules", "evil", "index.ts"), 'const key = "service_role_in_node_modules";');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: clean project -> all gates pass", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "components"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "lib"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "page.tsx"), "export const a = 1;");
      fs.writeFileSync(path.join(tmpDir, "components", "Widget.tsx"), "export const b = 2;");
      fs.writeFileSync(path.join(tmpDir, "lib", "util.ts"), "export const c = 3;");
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout + r.stderr, /All gates passed/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: route.ts with service_role -> exempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "api", "auth"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "api", "auth", "route.ts"),
        'const key = process.env.SUPABASE_SERVICE_ROLE_KEY; export async function POST() {}');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: middleware.ts with service_role -> exempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "middleware.ts"),
        'import { service_role } from "./config"; export function middleware() {}');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: app/api/ file with service_role -> exempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "api", "webhook"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "api", "webhook", "route.js"),
        'const sr = "service_role"; export async function GET() { return new Response(sr); }');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: 'use server' file with service_role -> exempt", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "admin"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "admin", "actions.ts"),
        '"use server"\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY;\nexport async function deleteUser() {}\n');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("pre-deploy-gate: regular page.tsx with service_role -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-pdg-"));
    try {
      fs.mkdirSync(path.join(tmpDir, "app", "admin"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "app", "admin", "page.tsx"),
        'const key = "service_role"; export default function Page() { return <div>{key}</div>; }');
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-deploy-gate.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // --- branch-guard.js ---

  it("branch-guard: OWNER on main -> allowed", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "main", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "OWNER" }));
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: EMPLOYEE on main -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "main", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "EMPLOYEE" }));
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 2);
      assert.match(r.stdout, /BLOCKED/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: EMPLOYEE on feature branch -> allowed", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/xyz", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "EMPLOYEE" }));
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: missing config -> blocked (fails closed)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/x", "-q"], { cwd: projDir, stdio: "pipe" });
      // No .claude/.qualia-config.json
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: malformed config JSON -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/x", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), "not json{");
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: empty role field -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/x", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "" }));
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Statusline Tests
// ═══════════════════════════════════════════════════════════

describe("Statusline", () => {
  it("statusline.js passes syntax check", () => {
    const r = spawnSync(process.execPath, ["--check", path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
    });
    assert.equal(r.status, 0);
  });

  it("statusline.js runs without crashing", () => {
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      env: { ...process.env, HOME: os.tmpdir(), USERPROFILE: os.tmpdir() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
  });

  it("qualia-ui.js passes syntax check", () => {
    const r = spawnSync(process.execPath, ["--check", path.join(BIN, "qualia-ui.js")], {
      encoding: "utf8", timeout: 5000,
    });
    assert.equal(r.status, 0);
  });

  it("statusline renders 2 lines with minimal input", () => {
    const nonexist = path.join(os.tmpdir(), `qualia-sl-nonexist-${process.pid}`);
    const json = JSON.stringify({
      model: { display_name: "Claude Opus 4.6" },
      workspace: { current_dir: nonexist },
      context_window: { used_percentage: 0 },
      cost: { total_cost_usd: 0 },
      agent: {},
      worktree: {},
    });
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: json,
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    const lines = r.stdout.split("\n").filter(l => l.length > 0);
    assert.equal(lines.length, 2);
    assert.match(r.stdout, /qualia-sl-nonexist/);
    assert.match(r.stdout, /Claude Opus 4\.6/);
  });

  it("statusline shows cost formatting", () => {
    const nonexist = path.join(os.tmpdir(), `qualia-sl-cost-${process.pid}`);
    const json = JSON.stringify({
      model: { display_name: "M" },
      workspace: { current_dir: nonexist },
      context_window: { used_percentage: 10 },
      cost: { total_cost_usd: 2.47, total_duration_ms: 0 },
      agent: {},
      worktree: {},
    });
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: json,
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\$2\.47/);
  });

  it("statusline shows duration in seconds under 60s", () => {
    const nonexist = path.join(os.tmpdir(), `qualia-sl-dur-${process.pid}`);
    const json = JSON.stringify({
      model: { display_name: "M" },
      workspace: { current_dir: nonexist },
      context_window: { used_percentage: 10 },
      cost: { total_cost_usd: 0, total_duration_ms: 45000 },
      agent: {},
      worktree: {},
    });
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: json,
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /45s/);
  });

  it("statusline shows duration in minutes over 60s", () => {
    const nonexist = path.join(os.tmpdir(), `qualia-sl-durm-${process.pid}`);
    const json = JSON.stringify({
      model: { display_name: "M" },
      workspace: { current_dir: nonexist },
      context_window: { used_percentage: 10 },
      cost: { total_cost_usd: 0, total_duration_ms: 125000 },
      agent: {},
      worktree: {},
    });
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: json,
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /2m/);
  });

  it("statusline renders agent name", () => {
    const nonexist = path.join(os.tmpdir(), `qualia-sl-agent-${process.pid}`);
    const json = JSON.stringify({
      model: { display_name: "M" },
      workspace: { current_dir: nonexist },
      context_window: { used_percentage: 10 },
      cost: { total_cost_usd: 0 },
      agent: { name: "qualia-planner" },
      worktree: {},
    });
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: json,
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /qualia-planner/);
  });

  it("statusline handles empty stdin gracefully", () => {
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: "",
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    const lines = r.stdout.split("\n").filter(l => l.length > 0);
    assert.equal(lines.length, 2);
  });

  it("statusline handles invalid JSON gracefully", () => {
    const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
      encoding: "utf8", timeout: 5000,
      input: "not json{",
      stdio: ["pipe", "pipe", "pipe"],
    });
    assert.equal(r.status, 0);
    const lines = r.stdout.split("\n").filter(l => l.length > 0);
    assert.equal(lines.length, 2);
  });

  it("statusline shows phase info from tracking.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-sl-phase-"));
    try {
      fs.mkdirSync(path.join(tmpDir, ".planning"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".planning", "tracking.json"),
        JSON.stringify({ phase: 2, total_phases: 4, status: "built" }));
      const json = JSON.stringify({
        model: { display_name: "M" },
        workspace: { current_dir: tmpDir },
        context_window: { used_percentage: 10 },
        cost: { total_cost_usd: 0 },
        agent: {},
        worktree: {},
      });
      const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
        encoding: "utf8", timeout: 5000,
        input: json,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
      assert.match(r.stdout, /P2\/4/);
      assert.match(r.stdout, /built/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("statusline handles malformed tracking.json", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-sl-bad-"));
    try {
      fs.mkdirSync(path.join(tmpDir, ".planning"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, ".planning", "tracking.json"), "not json");
      const json = JSON.stringify({
        model: { display_name: "M" },
        workspace: { current_dir: tmpDir },
        context_window: { used_percentage: 10 },
        cost: { total_cost_usd: 0 },
        agent: {},
        worktree: {},
      });
      const r = spawnSync(process.execPath, [path.join(BIN, "statusline.js")], {
        encoding: "utf8", timeout: 5000,
        input: json,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0);
      const lines = r.stdout.split("\n").filter(l => l.length > 0);
      assert.equal(lines.length, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// qualia-ui.js Tests
// ═══════════════════════════════════════════════════════════

describe("qualia-ui.js", () => {
  const UI = path.join(BIN, "qualia-ui.js");

  function runUI(args, opts = {}) {
    const tmpHome = opts.home || os.tmpdir();
    const r = spawnSync(process.execPath, [UI, ...args], {
      encoding: "utf8", timeout: 5000,
      cwd: opts.cwd || os.tmpdir(),
      env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
  }

  it("banner router renders QUALIA + SMART ROUTER", () => {
    const r = runUI(["banner", "router"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /QUALIA/);
    assert.match(clean, /SMART ROUTER/);
  });

  it("banner plan 1 foundation renders PLANNING + Phase 1", () => {
    const r = runUI(["banner", "plan", "1", "foundation"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /PLANNING/);
    assert.match(clean, /Phase 1/);
  });

  it("banner unknown action falls back to uppercased label", () => {
    const r = runUI(["banner", "frobnicate"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /QUALIA/);
    assert.match(clean, /FROBNICATE/);
  });

  it("context without project shows No project detected", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-ui-"));
    try {
      const r = runUI(["context"], { cwd: tmpDir, home: tmpDir });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /Project/);
      assert.match(clean, /No project detected/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("ok renders checkmark + message", () => {
    const r = runUI(["ok", "hello world"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /hello world/);
    assert.match(r.stdout, /\u2713/); // checkmark
  });

  it("fail renders cross + message", () => {
    const r = runUI(["fail", "nope nope"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /nope nope/);
    assert.match(r.stdout, /\u2717/); // cross
  });

  it("warn renders message", () => {
    const r = runUI(["warn", "careful"]);
    assert.equal(r.status, 0);
    assert.match(stripAnsi(r.stdout), /careful/);
  });

  it("info renders message", () => {
    const r = runUI(["info", "just fyi"]);
    assert.equal(r.status, 0);
    assert.match(stripAnsi(r.stdout), /just fyi/);
  });

  it("divider renders horizontal rule", () => {
    const r = runUI(["divider"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /\u2501/); // ━ character
  });

  it("spawn renders agent + description", () => {
    const r = runUI(["spawn", "builder", "task 3"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /Spawning/);
    assert.match(clean, /builder/);
    assert.match(clean, /task 3/);
  });

  it("wave renders wave header with task count", () => {
    const r = runUI(["wave", "1", "3", "5"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /Wave 1\/3/);
    assert.match(clean, /5 tasks/);
  });

  it("task renders number + title", () => {
    const r = runUI(["task", "2", "Build login form"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /Build login form/);
    assert.match(clean, /2\./);
  });

  it("done renders checkmark + title + commit", () => {
    const r = runUI(["done", "3", "TaskDone", "abc1234"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /TaskDone/);
    assert.match(clean, /abc1234/);
    assert.match(r.stdout, /\u2713/);
  });

  it("next renders next command", () => {
    const r = runUI(["next", "/qualia-build"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /Next:/);
    assert.match(clean, /\/qualia-build/);
  });

  it("end renders final status + next command", () => {
    const r = runUI(["end", "SHIPPED", "/qualia-handoff"]);
    assert.equal(r.status, 0);
    const clean = stripAnsi(r.stdout);
    assert.match(clean, /SHIPPED/);
    assert.match(clean, /\/qualia-handoff/);
  });

  it("unknown command exits 1 with Usage on stderr", () => {
    const r = runUI(["frobnicate"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Usage:/);
  });

  it("banner router with config shows OWNER + name", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-ui-cfg-"));
    try {
      fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
      fs.writeFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), JSON.stringify({
        code: "QS-FAWZI-01",
        installed_by: "Fawzi Goussous",
        role: "OWNER",
        version: "2.8.1",
        installed_at: "2026-04-10",
      }));
      const r = runUI(["banner", "router"], { home: tmpHome, cwd: tmpHome });
      assert.equal(r.status, 0);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /OWNER/);
      assert.match(clean, /Fawzi Goussous/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════
// Install Tests
// ═══════════════════════════════════════════════════════════

describe("install.js", () => {
  const INSTALL = path.join(BIN, "install.js");

  function runInstall(code, home) {
    const r = spawnSync(process.execPath, [INSTALL], {
      encoding: "utf8", timeout: 15000,
      input: code + "\n",
      env: { ...process.env, HOME: home, USERPROFILE: home },
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
  }

  it("valid code installs everything", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = runInstall("QS-FAWZI-01", tmpHome);
      assert.equal(r.status, 0);
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "skills", "qualia", "SKILL.md")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "hooks", "session-start.js")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "bin", "state.js")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "bin", "qualia-ui.js")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "bin", "statusline.js")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", ".qualia-config.json")));
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("config JSON has correct fields", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const config = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), "utf8"));
      assert.equal(config.code, "QS-FAWZI-01");
      assert.equal(config.installed_by, "Fawzi Goussous");
      assert.equal(config.role, "OWNER");
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("CLAUDE.md role placeholder replaced", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const claude = fs.readFileSync(path.join(tmpHome, ".claude", "CLAUDE.md"), "utf8");
      assert.match(claude, /Role: OWNER/);
      assert.doesNotMatch(claude, /\{\{ROLE\}\}/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("7 hooks installed (block-env-edit removed in v3.2.0)", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const hooks = fs.readdirSync(path.join(tmpHome, ".claude", "hooks")).filter(f => f.endsWith(".js"));
      assert.equal(hooks.length, 7);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("settings.json has hooks and statusLine", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const settings = fs.readFileSync(path.join(tmpHome, ".claude", "settings.json"), "utf8");
      assert.match(settings, /SessionStart/);
      assert.match(settings, /PreToolUse/);
      assert.match(settings, /statusLine/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("lowercase code is normalized", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = runInstall("qs-fawzi-01", tmpHome);
      assert.equal(r.status, 0);
      const config = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), "utf8"));
      assert.equal(config.code, "QS-FAWZI-01");
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("O/0 typo tolerance in code suffix", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = runInstall("QS-FAWZI-O1", tmpHome);
      assert.equal(r.status, 0);
      const config = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), "utf8"));
      assert.equal(config.code, "QS-FAWZI-01");
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("EMPLOYEE role set correctly for MOAYAD", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = runInstall("QS-MOAYAD-03", tmpHome);
      assert.equal(r.status, 0);
      const config = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), "utf8"));
      assert.equal(config.code, "QS-MOAYAD-03");
      assert.equal(config.installed_by, "Moayad");
      assert.equal(config.role, "EMPLOYEE");
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("invalid code exits 1", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = runInstall("QS-BOGUS-99", tmpHome);
      assert.equal(r.status, 1);
      assert.match(stripAnsi(r.stdout), /Invalid code/);
      assert.ok(!fs.existsSync(path.join(tmpHome, ".claude", ".qualia-config.json")));
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("empty code exits 1", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = spawnSync(process.execPath, [INSTALL], {
        encoding: "utf8", timeout: 15000,
        input: "\n",
        env: { ...process.env, HOME: tmpHome, USERPROFILE: tmpHome },
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 1);
      assert.match(stripAnsi(r.stdout || ""), /Invalid code/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("whitespace-padded code is accepted", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      const r = runInstall("  QS-FAWZI-01  ", tmpHome);
      assert.equal(r.status, 0);
      const config = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), "utf8"));
      assert.equal(config.code, "QS-FAWZI-01");
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("settings.json merge preserves custom keys", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      fs.mkdirSync(path.join(tmpHome, ".claude"), { recursive: true });
      fs.writeFileSync(path.join(tmpHome, ".claude", "settings.json"), JSON.stringify({
        customKey: "preserved",
        env: { MY_CUSTOM_VAR: "hello" },
      }));
      const r = runInstall("QS-FAWZI-01", tmpHome);
      assert.equal(r.status, 0);
      const settings = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", "settings.json"), "utf8"));
      assert.equal(settings.customKey, "preserved");
      assert.equal(settings.env.MY_CUSTOM_VAR, "hello");
      assert.ok(settings.hooks);
      assert.ok(settings.statusLine);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("knowledge files created on first install", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "knowledge", "learned-patterns.md")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "knowledge", "common-fixes.md")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "knowledge", "client-prefs.md")));
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("re-install preserves user edits in knowledge files", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      fs.appendFileSync(path.join(tmpHome, ".claude", "knowledge", "learned-patterns.md"),
        "\n## CUSTOM LEARNING — DO NOT OVERWRITE\n");
      runInstall("QS-FAWZI-01", tmpHome);
      const content = fs.readFileSync(path.join(tmpHome, ".claude", "knowledge", "learned-patterns.md"), "utf8");
      assert.match(content, /CUSTOM LEARNING/);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("templates copied to qualia-templates/", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const tmplDir = path.join(tmpHome, ".claude", "qualia-templates");
      assert.ok(fs.existsSync(tmplDir));
      const files = fs.readdirSync(tmplDir);
      assert.ok(files.length > 0, `Expected templates, found ${files.length}`);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("agents copied", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const agentDir = path.join(tmpHome, ".claude", "agents");
      assert.ok(fs.existsSync(agentDir));
      const files = fs.readdirSync(agentDir);
      assert.ok(files.length > 0);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("rules copied", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const rulesDir = path.join(tmpHome, ".claude", "rules");
      assert.ok(fs.existsSync(rulesDir));
      const files = fs.readdirSync(rulesDir);
      assert.ok(files.length > 0);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("config version matches package.json", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const config = JSON.parse(fs.readFileSync(path.join(tmpHome, ".claude", ".qualia-config.json"), "utf8"));
      assert.equal(config.version, PKG_VERSION);
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });
});
