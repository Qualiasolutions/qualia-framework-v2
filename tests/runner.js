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

  // ─── v3.4.2: init guard ────────────────────────────────
  it("init refuses to clobber an existing project (no --force)", () => {
    const tmpDir = makeProject();
    try {
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "init",
        "--project", "TestProject",
        "--phases", '[{"name":"X","goal":"Y"}]',
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "ALREADY_INITIALIZED");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --force overwrites an existing project (preserves lifetime)", () => {
    const tmpDir = makeProject();
    try {
      // Seed lifetime via close-milestone first. --force bypasses the v4
      // readiness guards (MILESTONE_NOT_READY) since this test doesn't
      // exercise the verification flow — it's focused on lifetime preservation.
      const c = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone", "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(c.status, 0);
      const tBefore = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.ok(tBefore.lifetime.milestones_completed >= 1);

      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "init",
        "--project", "TestProject",
        "--phases", '[{"name":"NewFoundation","goal":"X"}]',
        "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);
      const tAfter = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(tAfter.lifetime.milestones_completed, tBefore.lifetime.milestones_completed);
      assert.equal(tAfter.phase, 1);
      assert.equal(tAfter.status, "setup");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v3.4.2: close-milestone idempotency ───────────────
  it("close-milestone refuses double-close (idempotency)", () => {
    const tmpDir = makeProject();
    try {
      // First close uses --force to bypass v4 readiness guards — this test
      // focuses on the ALREADY_CLOSED sentinel, not phase-verification gates.
      const r1 = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone", "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r1.status, 0);
      const out1 = JSON.parse(r1.stdout);
      assert.equal(out1.lifetime.milestones_completed, 1);

      // Manually rewind milestone counter to simulate a re-run on the same closed milestone.
      // (Real close-milestone advances t.milestone, so a true double-close requires
      // putting milestone back to its prior value.)
      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      const t = JSON.parse(fs.readFileSync(tFile, "utf8"));
      t.milestone = out1.closed_milestone; // rewind
      fs.writeFileSync(tFile, JSON.stringify(t, null, 2) + "\n");

      // Second close (without --force) must fail with ALREADY_CLOSED, which
      // is checked BEFORE the readiness guards in cmdCloseMilestone.
      const r2 = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r2.status, 1);
      const out2 = JSON.parse(r2.stdout);
      assert.equal(out2.error, "ALREADY_CLOSED");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("close-milestone --force allows re-close", () => {
    const tmpDir = makeProject();
    try {
      const r1 = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone", "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r1.status, 0);

      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      const t = JSON.parse(fs.readFileSync(tFile, "utf8"));
      t.milestone = JSON.parse(r1.stdout).closed_milestone;
      fs.writeFileSync(tFile, JSON.stringify(t, null, 2) + "\n");

      const r2 = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone", "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r2.status, 0);
      const out2 = JSON.parse(r2.stdout);
      assert.equal(out2.lifetime.milestones_completed, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v3.4.2: backfill never reduces lifetime (Math.max) ─
  it("backfill-lifetime never reduces existing counters", () => {
    const tmpDir = makeProject();
    try {
      // Seed lifetime with high values (simulating prior close-milestone)
      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      const t = JSON.parse(fs.readFileSync(tFile, "utf8"));
      t.lifetime.tasks_completed = 100;
      t.lifetime.phases_completed = 20;
      fs.writeFileSync(tFile, JSON.stringify(t, null, 2) + "\n");

      // Backfill on a project with NO completed phases would compute 0/0
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "backfill-lifetime",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);
      const tAfter = JSON.parse(fs.readFileSync(tFile, "utf8"));
      assert.equal(tAfter.lifetime.tasks_completed, 100, "backfill must NOT reduce tasks_completed");
      assert.equal(tAfter.lifetime.phases_completed, 20, "backfill must NOT reduce phases_completed");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v3.4.2: atomic write leaves no .tmp file ──────────
  it("transition leaves no .tmp file on success (atomic write)", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      const r = runState(["transition", "--to", "planned"], tmpDir);
      assert.equal(r.status, 0);
      const planning = path.join(tmpDir, ".planning");
      const tmps = fs.readdirSync(planning).filter(f => f.includes(".tmp."));
      assert.equal(tmps.length, 0, `Stale .tmp files: ${tmps.join(", ")}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v3.6.0: tracking.json schema additions ────────────
  it("init writes new schema fields (team_id, project_id, build_count, etc.)", () => {
    const tmpDir = makeProject();
    try {
      const t = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      // New v3.6 fields (default to empty / 0, but must be present)
      assert.ok("team_id" in t, "team_id missing");
      assert.ok("project_id" in t, "project_id missing");
      assert.ok("git_remote" in t, "git_remote missing");
      assert.ok("session_started_at" in t, "session_started_at missing");
      assert.ok("last_pushed_at" in t, "last_pushed_at missing");
      assert.ok("build_count" in t, "build_count missing");
      assert.ok("deploy_count" in t, "deploy_count missing");
      assert.ok("submitted_by" in t, "submitted_by missing");
      assert.ok("last_closed_milestone" in t.lifetime, "lifetime.last_closed_milestone missing");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("init --force defensively hydrates partial lifetime (no NaN)", () => {
    const tmpDir = makeProject();
    try {
      // Write a partial lifetime that's missing keys
      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      const t = JSON.parse(fs.readFileSync(tFile, "utf8"));
      t.lifetime = { tasks_completed: 5 }; // partial — missing other keys
      fs.writeFileSync(tFile, JSON.stringify(t, null, 2) + "\n");

      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "init",
        "--project", "TestProject",
        "--phases", '[{"name":"X","goal":"Y"}]',
        "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);
      const tAfter = JSON.parse(fs.readFileSync(tFile, "utf8"));
      // Original partial value preserved
      assert.equal(tAfter.lifetime.tasks_completed, 5);
      // Missing keys defaulted to 0, never NaN
      assert.equal(tAfter.lifetime.phases_completed, 0);
      assert.equal(tAfter.lifetime.milestones_completed, 0);
      assert.equal(tAfter.lifetime.total_phases, 0);
      assert.equal(tAfter.lifetime.last_closed_milestone, 0);
      assert.ok(!Number.isNaN(tAfter.lifetime.phases_completed));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4.0.0: milestone readiness guards + milestones[] summary ─
  it("close-milestone refuses unverified phases (MILESTONE_NOT_READY)", () => {
    const tmpDir = makeProject();
    try {
      // No phases verified yet — close-milestone (without --force) must refuse.
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MILESTONE_NOT_READY");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("close-milestone refuses single-phase milestones (MILESTONE_TOO_SMALL)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-single-"));
    try {
      const init = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "init",
        "--project", "SingleProject",
        "--phases", '[{"name":"Only","goal":"Y"}]',
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(init.status, 0);

      // Single-phase milestone — even if the phase were verified, the size
      // guard catches it first. A milestone needs ≥ 2 phases without --force.
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 1);
      const out = JSON.parse(r.stdout);
      assert.equal(out.error, "MILESTONE_TOO_SMALL");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("close-milestone appends a summary to milestones[]", () => {
    const tmpDir = makeProject();
    try {
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "close-milestone", "--force",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);

      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      const t = JSON.parse(fs.readFileSync(tFile, "utf8"));
      assert.ok(Array.isArray(t.milestones), "milestones[] must exist");
      assert.equal(t.milestones.length, 1);
      const m1 = t.milestones[0];
      assert.equal(m1.num, 1);
      assert.ok(m1.total_phases >= 2, "total_phases should reflect seeded phases");
      assert.ok(typeof m1.closed_at === "string" && m1.closed_at.length > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("milestone summary captures cumulative tasks_completed, not current phase only", () => {
    const tmpDir = makeProject();
    try {
      // Simulate 2 phases each with 3 tasks verified pass. This bumps
      // lifetime.tasks_completed to 6. The milestone close summary should
      // reflect 6, not just 3 (the last phase's tasks_done).
      for (const phase of [1, 2]) {
        const planFile = path.join(tmpDir, ".planning", `phase-${phase}-plan.md`);
        fs.writeFileSync(planFile, `---
phase: ${phase}
goal: "x"
tasks: 1
waves: 1
---

## Task 1 — x
**Wave:** 1
**Files:** x.ts
**Depends on:** none
**Acceptance Criteria:**
- ok
`);
        const verFile = path.join(tmpDir, ".planning", `phase-${phase}-verification.md`);
        // Plan → built → verified
        let r = spawnSync(process.execPath, [path.join(BIN, "state.js"), "transition", "--to", "planned", "--phase", String(phase)],
          { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
        assert.equal(r.status, 0, `planned transition failed for phase ${phase}: ${r.stderr || r.stdout}`);
        r = spawnSync(process.execPath, [path.join(BIN, "state.js"), "transition", "--to", "built", "--phase", String(phase), "--tasks-done", "3", "--tasks-total", "3"],
          { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
        assert.equal(r.status, 0, `built transition failed for phase ${phase}: ${r.stderr || r.stdout}`);
        fs.writeFileSync(verFile, "result: PASS");
        r = spawnSync(process.execPath, [path.join(BIN, "state.js"), "transition", "--to", "verified", "--phase", String(phase), "--verification", "pass"],
          { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
        assert.equal(r.status, 0, `verified transition failed for phase ${phase}: ${r.stderr || r.stdout}`);
      }

      // Close milestone
      const r = spawnSync(process.execPath, [path.join(BIN, "state.js"), "close-milestone"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0, `close-milestone failed: ${r.stderr || r.stdout}`);

      const t = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(t.lifetime.tasks_completed, 6, "lifetime should have 6 tasks (2 phases × 3 tasks)");
      assert.equal(t.milestones.length, 1);
      assert.equal(t.milestones[0].tasks_completed, 6, "milestone summary should cumulate all 6 tasks, not just the last phase's 3");
      assert.equal(t.milestones[0].phases_completed, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("build_count bumps on each 'built' transition", () => {
    const tmpDir = makeProject();
    try {
      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      const before = JSON.parse(fs.readFileSync(tFile, "utf8")).build_count || 0;

      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-plan.md"), `---
phase: 1
goal: "x"
tasks: 1
waves: 1
---

## Task 1 — x
**Wave:** 1
**Files:** x.ts
**Depends on:** none
**Acceptance Criteria:**
- ok
`);
      spawnSync(process.execPath, [path.join(BIN, "state.js"), "transition", "--to", "planned", "--phase", "1"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      const r = spawnSync(process.execPath, [path.join(BIN, "state.js"), "transition", "--to", "built", "--phase", "1", "--tasks-done", "1", "--tasks-total", "1"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);

      const after = JSON.parse(fs.readFileSync(tFile, "utf8")).build_count || 0;
      assert.equal(after, before + 1, "build_count should bump on 'built' transition");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("check exposes milestones[] and milestone_name in output", () => {
    const tmpDir = makeProject();
    try {
      const r = spawnSync(process.execPath, [
        path.join(BIN, "state.js"), "check",
      ], { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.ok(Array.isArray(out.milestones), "check must expose milestones[]");
      assert.ok(typeof out.milestone_name === "string", "check must expose milestone_name");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v3.5.0: CRLF tolerance in parseStateMd ────────────
  it("parseStateMd tolerates CRLF line endings (Windows-edited STATE.md)", () => {
    const tmpDir = makeProject();
    try {
      const stateFile = path.join(tmpDir, ".planning", "STATE.md");
      const lf = fs.readFileSync(stateFile, "utf8");
      // Simulate Windows editor save: convert all \n to \r\n
      const crlf = lf.replace(/\n/g, "\r\n");
      fs.writeFileSync(stateFile, crlf);
      const r = runState(["check"], tmpDir);
      assert.equal(r.status, 0, `check failed on CRLF STATE.md: ${r.stdout} ${r.stderr}`);
      const out = JSON.parse(r.stdout);
      assert.equal(out.phase_name, "Foundation", "phase_name must NOT contain trailing \\r");
      assert.equal(out.status, "setup", "status must NOT contain trailing \\r");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v3.4.2: lock file is released after mutation ──────
  it("transition releases the .state.lock", () => {
    const tmpDir = makeProject();
    try {
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      const lockExists = fs.existsSync(path.join(tmpDir, ".planning", ".state.lock"));
      assert.equal(lockExists, false, "lock file should be released after transition");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4 regression: deploy_count actually increments on shipped ───
  it("transition --to shipped increments deploy_count", () => {
    const tmpDir = makeProject();
    try {
      // Walk both phases through verified, then polished, then shipped.
      makeValidPlan(tmpDir, 1);
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-1-verification.md"), "# pass\n");
      runState(["transition", "--to", "verified", "--verification", "pass"], tmpDir);

      makeValidPlan(tmpDir, 2);
      runState(["transition", "--to", "planned"], tmpDir);
      runState(["transition", "--to", "built", "--tasks-done", "1", "--tasks-total", "1"], tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".planning", "phase-2-verification.md"), "# pass\n");
      runState(["transition", "--to", "verified", "--verification", "pass"], tmpDir);
      runState(["transition", "--to", "polished"], tmpDir);

      const before = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(parseInt(before.deploy_count) || 0, 0, "deploy_count starts at 0");

      const r = runState(["transition", "--to", "shipped", "--deployed-url", "https://x.test"], tmpDir);
      assert.equal(r.status, 0, `shipped transition failed: ${r.stdout} ${r.stderr}`);
      const after = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(parseInt(after.deploy_count), 1, "deploy_count must increment to 1");
      assert.equal(after.deployed_url, "https://x.test");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4.0.2: write-ahead journal recovery ─────────────────
  // Simulate a crashed previous mutator by dropping a .state.journal file
  // with pre-transition snapshots of STATE.md and tracking.json. The next
  // mutator invocation must restore both files from the journal and remove it.
  it("recovers STATE.md + tracking.json from .state.journal on next mutator", () => {
    const tmpDir = makeProject();
    try {
      const statePath = path.join(tmpDir, ".planning", "STATE.md");
      const trackPath = path.join(tmpDir, ".planning", "tracking.json");
      const journalPath = path.join(tmpDir, ".planning", ".state.journal");

      const origState = fs.readFileSync(statePath, "utf8");
      const origTracking = fs.readFileSync(trackPath, "utf8");

      // Corrupt STATE.md and tracking.json to simulate a half-completed write.
      fs.writeFileSync(statePath, "# CORRUPTED\n");
      fs.writeFileSync(trackPath, '{"corrupt":true}\n');

      // Drop a journal that would have been written before the corruption.
      fs.writeFileSync(journalPath, JSON.stringify({
        ts: new Date().toISOString(),
        pid: 99999,
        state: origState,
        tracking: origTracking,
      }));

      // Any mutator should trigger recovery. Use `fix` (a cheap mutator).
      const r = runState(["fix"], tmpDir);
      // Not asserting r.status — fix may succeed or report nothing to fix.
      // What matters: STATE.md and tracking.json were restored and journal is gone.
      assert.equal(fs.existsSync(journalPath), false, "journal must be removed after recovery");
      const recoveredState = fs.readFileSync(statePath, "utf8");
      const recoveredTracking = fs.readFileSync(trackPath, "utf8");
      assert.ok(recoveredState.includes("Current Position") || recoveredState === origState,
        "STATE.md must be restored from journal");
      assert.notStrictEqual(recoveredTracking, '{"corrupt":true}\n',
        "tracking.json must no longer be the corrupted snapshot");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4.0.2: corrupt journal is tolerated, not fatal ──────
  it("corrupt .state.journal is cleared without crashing mutator", () => {
    const tmpDir = makeProject();
    try {
      const journalPath = path.join(tmpDir, ".planning", ".state.journal");
      fs.writeFileSync(journalPath, "{not valid json");
      const r = runState(["check"], tmpDir);
      // check is read-only so it won't recover; use a mutator.
      runState(["fix"], tmpDir);
      assert.equal(fs.existsSync(journalPath), false,
        "corrupt journal must be cleaned up so we don't loop on recovery");
      assert.equal(r.status, 0, "check should still work with a stray journal file");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4.0.4: next-report-id ────────────────────────────────
  it("next-report-id returns QS-REPORT-01 on fresh project and increments", () => {
    const tmpDir = makeProject();
    try {
      const r1 = spawnSync(process.execPath,
        [path.join(BIN, "state.js"), "next-report-id"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r1.status, 0, `next-report-id failed: ${r1.stderr || r1.stdout}`);
      const j1 = JSON.parse(r1.stdout);
      assert.equal(j1.report_id, "QS-REPORT-01");
      assert.equal(j1.report_seq, 1);
      assert.equal(j1.peeked, false);

      const r2 = spawnSync(process.execPath,
        [path.join(BIN, "state.js"), "next-report-id"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      const j2 = JSON.parse(r2.stdout);
      assert.equal(j2.report_id, "QS-REPORT-02");
      assert.equal(j2.report_seq, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("next-report-id --peek does NOT increment the counter", () => {
    const tmpDir = makeProject();
    try {
      const r1 = spawnSync(process.execPath,
        [path.join(BIN, "state.js"), "next-report-id", "--peek"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      const j1 = JSON.parse(r1.stdout);
      assert.equal(j1.report_id, "QS-REPORT-01");
      assert.equal(j1.peeked, true);

      // Peek again — should still return QS-REPORT-01 since nothing incremented
      const r2 = spawnSync(process.execPath,
        [path.join(BIN, "state.js"), "next-report-id", "--peek"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      const j2 = JSON.parse(r2.stdout);
      assert.equal(j2.report_id, "QS-REPORT-01");
      assert.equal(j2.report_seq, 1);

      // On-disk report_seq should still be 0
      const t = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.ok(!t.report_seq || t.report_seq === 0,
        `report_seq should remain 0 after peek, got ${t.report_seq}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4.0.4: close-milestone pre-populates next milestone_name from JOURNEY.md
  it("close-milestone pre-populates next milestone_name from JOURNEY.md", () => {
    const tmpDir = makeProject();
    try {
      // Write JOURNEY.md with Milestone 2 definition
      fs.writeFileSync(path.join(tmpDir, ".planning", "JOURNEY.md"), `# Journey

## Milestone 1 · Foundation     [CURRENT]
Exit: scaffolding done

## Milestone 2 · Core Features
Exit: auth + dashboard

## Milestone 3 · Handoff     [FINAL]
Exit: client takeover
`);
      const r = spawnSync(process.execPath,
        [path.join(BIN, "state.js"), "close-milestone", "--force"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0, `close-milestone failed: ${r.stderr || r.stdout}`);

      const t = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(t.milestone, 2);
      assert.equal(t.milestone_name, "Core Features",
        `milestone_name should be pre-populated from JOURNEY.md, got '${t.milestone_name}'`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("close-milestone leaves milestone_name blank when JOURNEY.md is missing", () => {
    const tmpDir = makeProject();
    try {
      // No JOURNEY.md — milestone_name should fall back to blank (legacy behavior)
      const r = spawnSync(process.execPath,
        [path.join(BIN, "state.js"), "close-milestone", "--force"],
        { encoding: "utf8", cwd: tmpDir, timeout: 5000, stdio: ["pipe", "pipe", "pipe"] });
      assert.equal(r.status, 0);

      const t = JSON.parse(fs.readFileSync(path.join(tmpDir, ".planning", "tracking.json"), "utf8"));
      assert.equal(t.milestone_name, "",
        "milestone_name must be blank when JOURNEY.md is absent (fallback unchanged)");
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

  // v3.4.2: behavioral test — the stamp must actually mutate tracking.json
  // AND create a real commit so the push includes it.
  //
  // v4.1.1 NOTE: skipped on Windows. The stamp-commit interacts with git's
  // autocrlf in ways that are not fully reproducible without a live Windows
  // box — pre-push.js now passes `-c core.autocrlf=false` on its own git
  // commands (defensive), but the test's seed-commit path still hits an
  // edge case on Windows that needs platform-specific investigation. This
  // is tracked as a v4.1.2 follow-up; the Linux+macOS paths (which are the
  // overwhelming majority of installs) are fully covered here.
  it("pre-push.js mutates tracking.json AND commits the stamp", { skip: process.platform === "win32" ? "pre-existing autocrlf edge case — investigate in v4.1.2" : false }, () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-push-real-"));
    try {
      // Init a real git repo
      const gitOpts = { cwd: tmpDir, encoding: "utf8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] };
      spawnSync("git", ["init", "--initial-branch=main"], gitOpts);
      spawnSync("git", ["config", "user.email", "test@example.com"], gitOpts);
      spawnSync("git", ["config", "user.name", "Test"], gitOpts);
      spawnSync("git", ["config", "commit.gpgsign", "false"], gitOpts);

      // Seed .planning/tracking.json + an initial commit
      fs.mkdirSync(path.join(tmpDir, ".planning"));
      const tFile = path.join(tmpDir, ".planning", "tracking.json");
      fs.writeFileSync(tFile, JSON.stringify({
        project: "test", phase: 1, status: "setup", last_commit: "OLD", last_updated: "2020-01-01T00:00:00Z",
      }, null, 2) + "\n");
      spawnSync("git", ["add", "."], gitOpts);
      spawnSync("git", ["commit", "-m", "seed", "--no-verify"], gitOpts);

      const headBefore = spawnSync("git", ["rev-parse", "HEAD"], gitOpts).stdout.trim();

      // Run the hook
      const r = spawnSync(process.execPath, [path.join(HOOKS, "pre-push.js")], {
        encoding: "utf8", cwd: tmpDir, timeout: 10000, stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0, `pre-push exited ${r.status}: ${r.stderr}`);

      // tracking.json must have been mutated
      const t = JSON.parse(fs.readFileSync(tFile, "utf8"));
      assert.notEqual(t.last_commit, "OLD", "last_commit should have been updated");
      assert.notEqual(t.last_updated, "2020-01-01T00:00:00Z", "last_updated should have been updated");
      assert.match(t.last_updated, /^\d{4}-\d{2}-\d{2}T/);

      // A NEW commit must exist (this is the smoking-gun fix from v3.4.2)
      const headAfter = spawnSync("git", ["rev-parse", "HEAD"], gitOpts).stdout.trim();
      assert.notEqual(headAfter, headBefore, "pre-push must commit the stamp so it ships with the push");

      // The new commit must be authored by the bot, not the user
      const author = spawnSync("git", ["log", "-1", "--format=%an <%ae>"], gitOpts).stdout.trim();
      assert.match(author, /Qualia Framework/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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
      assert.equal(r.status, 2, "PreToolUse hook must exit 2 to block");
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
      assert.equal(r.status, 2, "PreToolUse hook must exit 2 to block");
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
      assert.equal(r.status, 2, "PreToolUse hook must exit 2 to block");
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

  // v3.5.0: refspec bypass — EMPLOYEE on a feature branch trying to push
  // `feature/x:main` MUST be blocked, even though current branch isn't main.
  it("branch-guard: EMPLOYEE refspec push to main -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/x", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "EMPLOYEE" }));
      // Send Claude Code hook payload via stdin
      const payload = JSON.stringify({
        tool_input: { command: "git push origin feature/x:main" },
      });
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        input: payload,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 2, "refspec push to main must be blocked for EMPLOYEE");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: EMPLOYEE refspec push to master -> blocked", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/x", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "EMPLOYEE" }));
      const payload = JSON.stringify({
        tool_input: { command: "git push origin HEAD:master" },
      });
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        input: payload,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 2, "refspec push to master must be blocked for EMPLOYEE");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("branch-guard: OWNER refspec push to main -> allowed", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-bg-"));
    try {
      const projDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
      spawnSync("git", ["init", "-q"], { cwd: projDir });
      spawnSync("git", ["checkout", "-b", "feature/x", "-q"], { cwd: projDir, stdio: "pipe" });
      fs.writeFileSync(path.join(tmpDir, ".claude", ".qualia-config.json"), JSON.stringify({ role: "OWNER" }));
      const payload = JSON.stringify({
        tool_input: { command: "git push origin feature/x:main" },
      });
      const r = spawnSync(process.execPath, [path.join(HOOKS, "branch-guard.js")], {
        encoding: "utf8", cwd: projDir, timeout: 5000,
        env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
        input: payload,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(r.status, 0, "OWNER may push to main via refspec");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // v3.5.0: migration-guard — comments stripped before pattern match
  it("migration-guard: commented-out DROP TABLE is NOT blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: {
        file_path: "supabase/migrations/001_init.sql",
        content: "-- DROP TABLE old_users; (rolled back, kept for reference)\nCREATE TABLE foo (id uuid) WITH (security_invoker = true);\nALTER TABLE foo ENABLE ROW LEVEL SECURITY;",
      },
    });
    assert.equal(r.status, 0, `commented DROP should not block: ${r.stdout || r.stderr}`);
  });

  // v3.5.0: migration-guard — new destructive patterns
  it("migration-guard: ALTER TABLE DROP COLUMN -> blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "supabase/migrations/002.sql", content: "ALTER TABLE users DROP COLUMN ssn;" },
    });
    assert.equal(r.status, 2, "ALTER TABLE DROP COLUMN must block");
  });

  it("migration-guard: DROP DATABASE -> blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "supabase/migrations/003.sql", content: "DROP DATABASE production;" },
    });
    assert.equal(r.status, 2, "DROP DATABASE must block");
  });

  it("migration-guard: UPDATE without WHERE -> blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "supabase/migrations/004.sql", content: "UPDATE users SET email = NULL;" },
    });
    assert.equal(r.status, 2, "UPDATE without WHERE must block");
  });

  // v4.0.2: per-statement scan (previously a WHERE in ANY later statement
  // made an unsafe DELETE pass).
  it("migration-guard: DELETE FROM followed by unrelated SELECT WHERE -> blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: {
        file_path: "supabase/migrations/004b.sql",
        content: "DELETE FROM users;\nSELECT * FROM logs WHERE ts > NOW();",
      },
    });
    assert.equal(r.status, 2, "per-statement scan must still catch the DELETE without WHERE");
  });

  it("migration-guard: UPDATE SET without WHERE followed by unrelated WHERE -> blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: {
        file_path: "supabase/migrations/004c.sql",
        content: "UPDATE accounts SET active = true;\nSELECT id FROM sessions WHERE expires > NOW();",
      },
    });
    assert.equal(r.status, 2, "per-statement scan must catch the UPDATE without WHERE");
  });

  it("migration-guard: GRANT TO PUBLIC -> blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "supabase/migrations/005.sql", content: "GRANT ALL ON users TO PUBLIC;" },
    });
    assert.equal(r.status, 2, "GRANT TO PUBLIC must block");
  });

  it("migration-guard: CREATE TEMP TABLE without RLS -> NOT blocked", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "supabase/migrations/006.sql", content: "CREATE TEMP TABLE scratch (id int);" },
    });
    assert.equal(r.status, 0, "TEMP tables should be exempt from the RLS requirement");
  });

  it("migration-guard: MigrationModal.tsx is NOT scanned", () => {
    const r = runHook("migration-guard.js", {
      tool_input: { file_path: "src/components/MigrationModal.tsx", content: "DROP TABLE users;" },
    });
    assert.equal(r.status, 0, "files with 'migration' in the name but not in a migrations/ dir should not be scanned");
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

  // ─── v4 regression: journey-tree renders without crashing ───
  // Previously crashed with "Cannot access 'projectName' before initialization"
  // because a const shadowed the fallback function inside its own initializer.
  it("journey-tree renders milestones without crashing", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-jt-"));
    try {
      fs.mkdirSync(path.join(tmpDir, ".planning"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".planning", "JOURNEY.md"),
        "# JOURNEY\n\n## Milestone 1 · Foundation\n\nWhy now.\n\n## Milestone 2 · Handoff\n\nDeliver.\n"
      );
      fs.writeFileSync(
        path.join(tmpDir, ".planning", "tracking.json"),
        JSON.stringify({ project: "jtproj", milestone: 1, milestones: [] })
      );
      fs.writeFileSync(
        path.join(tmpDir, ".planning", "STATE.md"),
        "---\nproject: jtproj\nphase: 1\nstatus: planning\nmilestone: 1\n---\n"
      );
      const r = runUI(["journey-tree"], { cwd: tmpDir, home: tmpDir });
      assert.equal(r.status, 0, `journey-tree crashed: ${r.stderr}`);
      const clean = stripAnsi(r.stdout);
      assert.match(clean, /JOURNEY/);
      assert.match(clean, /M1 · Foundation/);
      assert.match(clean, /M2 · Handoff/);
      assert.match(clean, /\[CURRENT\]/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ─── v4 regression: journey-tree uses projectName() fallback when frontmatter missing ───
  // Would previously throw ReferenceError because `const projectName` shadowed the
  // function name inside its own initializer. Fallback resolves to basename(cwd).
  it("journey-tree uses projectName() fallback when no project: in JOURNEY frontmatter", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-jt-fallback-"));
    try {
      fs.mkdirSync(path.join(tmpDir, ".planning"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".planning", "JOURNEY.md"),
        "# JOURNEY\n\n## Milestone 1 · Foundation\n\nWhy now.\n\n## Milestone 2 · Handoff\n\nLast.\n"
      );
      fs.writeFileSync(
        path.join(tmpDir, ".planning", "tracking.json"),
        JSON.stringify({ project: "ignored-by-fallback", milestone: 1 })
      );
      const r = runUI(["journey-tree"], { cwd: tmpDir, home: tmpDir });
      assert.equal(r.status, 0, `journey-tree crashed: ${r.stderr}`);
      const clean = stripAnsi(r.stdout);
      // Fallback is path.basename(cwd) — whatever the tmp dir is named.
      assert.match(clean, new RegExp(path.basename(tmpDir)));
      assert.match(clean, /M1 · Foundation/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
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
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "bin", "knowledge.js")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", ".qualia-config.json")));
      // v4.2.0 — knowledge layer must be initialized
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "knowledge", "agents.md")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "knowledge", "index.md")));
      assert.ok(fs.existsSync(path.join(tmpHome, ".claude", "knowledge", "daily-log")));
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

  it("9 hooks installed (block-env-edit removed in v3.2.0; git-guardrails + stop-session-log added in v4.2.0)", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      runInstall("QS-FAWZI-01", tmpHome);
      const hooks = fs.readdirSync(path.join(tmpHome, ".claude", "hooks")).filter(f => f.endsWith(".js"));
      assert.equal(hooks.length, 9);
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

  // v4.0.2: reinstall merges hooks instead of clobbering.
  it("re-install preserves user-added hooks in settings.json", () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "qualia-install-"));
    try {
      // Fresh install first, then inject a user-owned hook, then reinstall.
      runInstall("QS-FAWZI-01", tmpHome);
      const settingsPath = path.join(tmpHome, ".claude", "settings.json");
      const before = JSON.parse(fs.readFileSync(settingsPath, "utf8"));

      // Add a user hook to PreToolUse that is not a Qualia command.
      const userHook = {
        matcher: "Bash",
        hooks: [
          { type: "command", command: "echo user-owned-pre-tool-hook", timeout: 3 },
        ],
      };
      before.hooks.PreToolUse = [userHook, ...(before.hooks.PreToolUse || [])];
      fs.writeFileSync(settingsPath, JSON.stringify(before, null, 2));

      const r = runInstall("QS-FAWZI-01", tmpHome);
      assert.equal(r.status, 0);
      const after = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      const allCmds = [];
      for (const block of after.hooks.PreToolUse || []) {
        for (const h of (block.hooks || [])) allCmds.push(String(h.command || ""));
      }
      assert.ok(
        allCmds.some((c) => c.includes("user-owned-pre-tool-hook")),
        `user hook was clobbered by reinstall. Commands: ${allCmds.join(" | ")}`
      );
      // And Qualia hooks should still be there.
      assert.ok(
        allCmds.some((c) => c.includes("branch-guard.js")),
        "Qualia hooks must still be present after reinstall"
      );
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

// ─── Memory MCP server ─────────────────────────────────────
describe("memory-mcp server", () => {
  const SERVER = path.join(ROOT, "mcp", "memory-mcp", "server.js");

  // Drive the server through line-delimited JSON-RPC frames synchronously.
  // Returns an array of parsed responses in order.
  function rpc(frames, env = {}) {
    const input = frames.map((f) => JSON.stringify(f)).join("\n") + "\n";
    const r = spawnSync(process.execPath, [SERVER], {
      encoding: "utf8",
      timeout: 8000,
      input,
      env: { ...process.env, ...env },
    });
    return (r.stdout || "")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  it("responds to initialize with protocol + serverInfo", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      fs.mkdirSync(path.join(tmpRoot, "wiki"), { recursive: true });
      const out = rpc(
        [{ jsonrpc: "2.0", id: 1, method: "initialize" }],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      assert.equal(out[0].id, 1);
      assert.equal(out[0].result.serverInfo.name, "qualia-memory");
      assert.ok(out[0].result.protocolVersion);
      assert.ok(out[0].result.capabilities.tools);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("tools/list advertises three read-only tools", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      fs.mkdirSync(path.join(tmpRoot, "wiki"), { recursive: true });
      const out = rpc(
        [{ jsonrpc: "2.0", id: 1, method: "tools/list" }],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      const names = out[0].result.tools.map((t) => t.name).sort();
      assert.deepEqual(names, ["memory.list", "memory.read", "memory.search"]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("memory.search finds matches and returns file:line:snippet", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      const wiki = path.join(tmpRoot, "wiki");
      fs.mkdirSync(path.join(wiki, "concepts"), { recursive: true });
      fs.writeFileSync(
        path.join(wiki, "concepts", "alpha.md"),
        "# Alpha\nSakani Properties uses Mapbox.\nUnrelated line.\n",
      );
      const out = rpc(
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "memory.search", arguments: { query: "Mapbox" } },
          },
        ],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      const payload = JSON.parse(out[0].result.content[0].text);
      assert.equal(payload.total, 1);
      assert.equal(payload.hits[0].path, "concepts/alpha.md");
      assert.equal(payload.hits[0].line, 2);
      assert.match(payload.hits[0].snippet, /Mapbox/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("memory.read returns file content under the wiki", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      const wiki = path.join(tmpRoot, "wiki");
      fs.mkdirSync(wiki, { recursive: true });
      fs.writeFileSync(path.join(wiki, "hot.md"), "recent context");
      const out = rpc(
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "memory.read", arguments: { path: "hot.md" } },
          },
        ],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      const payload = JSON.parse(out[0].result.content[0].text);
      assert.equal(payload.content, "recent context");
      assert.equal(payload.truncated, false);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("memory.read rejects path traversal outside wiki/", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      fs.mkdirSync(path.join(tmpRoot, "wiki"), { recursive: true });
      // Sibling secret outside wiki/ — must not be reachable via ..
      fs.writeFileSync(path.join(tmpRoot, "secret.txt"), "shhh");
      const out = rpc(
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "memory.read", arguments: { path: "../secret.txt" } },
          },
        ],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      assert.ok(out[0].error, "expected error response");
      assert.match(out[0].error.message, /escapes wiki root/);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("memory.list returns directories first, then files", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      const wiki = path.join(tmpRoot, "wiki");
      fs.mkdirSync(path.join(wiki, "concepts"), { recursive: true });
      fs.writeFileSync(path.join(wiki, "index.md"), "i");
      const out = rpc(
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "memory.list", arguments: {} },
          },
        ],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      const payload = JSON.parse(out[0].result.content[0].text);
      assert.equal(payload.entries[0].type, "dir");
      assert.equal(payload.entries[0].name, "concepts");
      assert.ok(payload.entries.some((e) => e.name === "index.md" && e.type === "file"));
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it("unknown tool returns JSON-RPC -32601", () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "memory-mcp-"));
    try {
      fs.mkdirSync(path.join(tmpRoot, "wiki"), { recursive: true });
      const out = rpc(
        [
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: "memory.delete", arguments: {} },
          },
        ],
        { QUALIA_MEMORY_ROOT: tmpRoot },
      );
      assert.equal(out[0].error.code, -32601);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
