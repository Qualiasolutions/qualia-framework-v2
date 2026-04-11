#!/usr/bin/env node
// ~/.claude/hooks/pre-deploy-gate.js — quality gates before production deploy.
// PreToolUse hook on `vercel --prod*` commands. Runs tsc, lint, tests, build,
// then scans for service_role leaks in client code.
// Exits 1 to BLOCK deploy. Exits 0 to allow.
// Cross-platform (Windows/macOS/Linux). No `grep` or `find` — pure Node.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const _traceStart = Date.now();

function _trace(hookName, result, extra) {
  try {
    const os = require("os");
    const traceDir = path.join(os.homedir(), ".claude", ".qualia-traces");
    if (!fs.existsSync(traceDir)) fs.mkdirSync(traceDir, { recursive: true });
    const entry = {
      hook: hookName,
      result,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - _traceStart,
      ...extra,
    };
    const file = path.join(traceDir, `${new Date().toISOString().split("T")[0]}.jsonl`);
    fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  } catch {}
}

function runGate(label, cmd, args, { required = true } = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "ignore",
    timeout: 180000,
    shell: process.platform === "win32",
  });
  if (r.status === 0) {
    console.log(`  ✓ ${label}`);
    return true;
  }
  if (required) {
    console.log(`BLOCKED: ${label} errors. Fix before deploying.`);
    _trace("pre-deploy-gate", "block", { gate: label });
    process.exit(1);
  }
  return false;
}

function hasScript(name) {
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    return pkg.scripts && typeof pkg.scripts[name] === "string";
  } catch {
    return false;
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanServiceRoleLeaks() {
  const roots = ["app", "components", "src", "pages", "lib"];
  const leaks = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      // --- Path-based skips (no I/O needed) ---

      // Skip server-only files (convention: *.server.ts, server/ dirs)
      if (/\.server\.|[\\/]server[\\/]/.test(file)) continue;

      // Skip App Router route handlers (always server-side)
      if (/[\\/]route\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;

      // Skip middleware (always server-side)
      if (/[\\/]middleware\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;

      // Skip files in app/api/ directory (always server-side)
      if (/[\\/]app[\\/]api[\\/]/.test(file)) continue;

      // --- Content-based checks (requires reading file) ---
      try {
        const content = fs.readFileSync(file, "utf8");

        // Skip files with "use server" directive (Server Actions / Server Components)
        if (/^["']use server["']/m.test(content)) continue;

        if (/service_role/.test(content)) {
          leaks.push(file);
        }
      } catch {}
    }
  }
  return leaks;
}

console.log("⬢ Pre-deploy gate...");

// TypeScript
if (fs.existsSync("tsconfig.json")) {
  runGate("TypeScript", "npx", ["tsc", "--noEmit"]);
}

// Lint
if (hasScript("lint")) {
  runGate("Lint", "npm", ["run", "lint"]);
}

// Tests
if (hasScript("test")) {
  runGate("Tests", "npm", ["test"]);
}

// Build
if (hasScript("build")) {
  runGate("Build", "npm", ["run", "build"]);
}

// Security: no service_role in client code
const leaks = scanServiceRoleLeaks();
if (leaks.length > 0) {
  console.log("BLOCKED: service_role found in client code. Remove before deploying.");
  for (const f of leaks.slice(0, 10)) {
    console.log(`  ✗ ${f}`);
  }
  _trace("pre-deploy-gate", "block", { gate: "security", leaks: leaks.slice(0, 10) });
  process.exit(1);
}
console.log("  ✓ Security");
console.log("⬢ All gates passed.");

_trace("pre-deploy-gate", "allow");
process.exit(0);
