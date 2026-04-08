#!/usr/bin/env node

const { createInterface } = require("readline");
const path = require("path");
const fs = require("fs");

// ─── Colors ──────────────────────────────────────────────
const TEAL = "\x1b[38;2;0;206;209m";
const DIM = "\x1b[38;2;80;90;100m";
const GREEN = "\x1b[38;2;52;211;153m";
const WHITE = "\x1b[38;2;220;225;230m";
const YELLOW = "\x1b[38;2;234;179;8m";
const RED = "\x1b[38;2;239;68;68m";
const RESET = "\x1b[0m";

// ─── Team codes ──────────────────────────────────────────
const TEAM = {
  "QS-FAWZI-01": {
    name: "Fawzi Goussous",
    role: "OWNER",
    description: "Company owner. Full access. Can push to main, approve deploys, edit secrets.",
  },
  "QS-HASAN-02": {
    name: "Hasan",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
  "QS-MOAYAD-03": {
    name: "Moayad",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
  "QS-RAMA-04": {
    name: "Rama",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
  "QS-SALLY-05": {
    name: "Sally",
    role: "EMPLOYEE",
    description: "Developer. Feature branches only. Cannot push to main or edit .env files.",
  },
};

const CLAUDE_DIR = path.join(require("os").homedir(), ".claude");
const FRAMEWORK_DIR = path.resolve(__dirname, "..");

let installed = 0;
let errors = 0;

function log(msg) {
  console.log(`  ${msg}`);
}
function ok(label) {
  installed++;
  log(`${GREEN}✓${RESET} ${label}`);
}
function warn(label) {
  errors++;
  log(`${YELLOW}✗${RESET} ${label}`);
}
function copy(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

// ─── Prompt for code ─────────────────────────────────────
function askCode() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("");
    console.log(`${TEAL}  ◆ Qualia Framework v2${RESET}`);
    console.log(`${DIM}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log("");
    rl.question(`  ${WHITE}Enter install code:${RESET} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Main ────────────────────────────────────────────────
async function main() {
  const code = await askCode();
  const member = TEAM[code];

  if (!member) {
    console.log("");
    log(`${RED}✗${RESET} Invalid code. Get your install code from Fawzi.`);
    console.log("");
    process.exit(1);
  }

  console.log("");
  log(`${GREEN}✓${RESET} ${WHITE}${member.name}${RESET} ${DIM}(${member.role})${RESET}`);
  console.log("");
  log(`Installing to ${WHITE}${CLAUDE_DIR}${RESET}`);
  console.log("");

  // ─── Skills ──────────────────────────────────────────
  const skillsDir = path.join(FRAMEWORK_DIR, "skills");
  const skills = fs
    .readdirSync(skillsDir)
    .filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory());

  log(`${WHITE}Skills${RESET}`);
  for (const skill of skills) {
    try {
      copy(
        path.join(skillsDir, skill, "SKILL.md"),
        path.join(CLAUDE_DIR, "skills", skill, "SKILL.md")
      );
      ok(skill);
    } catch (e) {
      warn(`${skill} — ${e.message}`);
    }
  }

  // ─── Agents ────────────────────────────────────────────
  log(`${WHITE}Agents${RESET}`);
  const agentsDir = path.join(FRAMEWORK_DIR, "agents");
  for (const file of fs.readdirSync(agentsDir)) {
    try {
      copy(path.join(agentsDir, file), path.join(CLAUDE_DIR, "agents", file));
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── Rules ─────────────────────────────────────────────
  log(`${WHITE}Rules${RESET}`);
  const rulesDir = path.join(FRAMEWORK_DIR, "rules");
  for (const file of fs.readdirSync(rulesDir)) {
    try {
      copy(path.join(rulesDir, file), path.join(CLAUDE_DIR, "rules", file));
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── Hooks ─────────────────────────────────────────────
  log(`${WHITE}Hooks${RESET}`);
  const hooksSource = path.join(FRAMEWORK_DIR, "hooks");
  const hooksDest = path.join(CLAUDE_DIR, "hooks");
  if (!fs.existsSync(hooksDest)) fs.mkdirSync(hooksDest, { recursive: true });
  for (const file of fs.readdirSync(hooksSource)) {
    try {
      const dest = path.join(hooksDest, file);
      copy(path.join(hooksSource, file), dest);
      fs.chmodSync(dest, 0o755);
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── Status line ───────────────────────────────────────
  log(`${WHITE}Status line${RESET}`);
  try {
    const slDest = path.join(CLAUDE_DIR, "statusline.sh");
    copy(path.join(FRAMEWORK_DIR, "statusline.sh"), slDest);
    fs.chmodSync(slDest, 0o755);
    ok("statusline.sh");
  } catch (e) {
    warn(`statusline.sh — ${e.message}`);
  }

  // ─── Templates ─────────────────────────────────────────
  log(`${WHITE}Templates${RESET}`);
  const tmplDir = path.join(FRAMEWORK_DIR, "templates");
  const tmplDest = path.join(CLAUDE_DIR, "qualia-templates");
  if (!fs.existsSync(tmplDest)) fs.mkdirSync(tmplDest, { recursive: true });
  for (const file of fs.readdirSync(tmplDir)) {
    try {
      copy(path.join(tmplDir, file), path.join(tmplDest, file));
      ok(file);
    } catch (e) {
      warn(`${file} — ${e.message}`);
    }
  }

  // ─── CLAUDE.md with role ───────────────────────────────
  log(`${WHITE}CLAUDE.md${RESET}`);
  try {
    let claudeMd = fs.readFileSync(
      path.join(FRAMEWORK_DIR, "CLAUDE.md"),
      "utf8"
    );
    claudeMd = claudeMd.replace("{{ROLE}}", member.role);
    claudeMd = claudeMd.replace("{{ROLE_DESCRIPTION}}", member.description);
    const claudeDest = path.join(CLAUDE_DIR, "CLAUDE.md");
    fs.writeFileSync(claudeDest, claudeMd, "utf8");
    ok(`Configured as ${member.role}`);
  } catch (e) {
    warn(`CLAUDE.md — ${e.message}`);
  }

  // ─── Scripts ─────────────────────────────────────────────
  log(`${WHITE}Scripts${RESET}`);
  try {
    const binDest = path.join(CLAUDE_DIR, "bin");
    if (!fs.existsSync(binDest)) fs.mkdirSync(binDest, { recursive: true });
    copy(
      path.join(FRAMEWORK_DIR, "bin", "state.js"),
      path.join(binDest, "state.js")
    );
    ok("state.js (state machine)");
  } catch (e) {
    warn(`state.js — ${e.message}`);
  }

  // ─── Guide ─────────────────────────────────────────────
  try {
    copy(
      path.join(FRAMEWORK_DIR, "guide.md"),
      path.join(CLAUDE_DIR, "qualia-guide.md")
    );
    ok("guide.md");
  } catch (e) {
    warn(`guide.md — ${e.message}`);
  }

  // ─── Knowledge directory ─────────────────────────────────
  log(`${WHITE}Knowledge${RESET}`);
  const knowledgeDir = path.join(CLAUDE_DIR, "knowledge");
  if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });
  const knowledgeFiles = {
    "learned-patterns.md": "# Learned Patterns\n\nPatterns discovered across projects. Updated by `/qualia-evolve` and manual notes.\n",
    "common-fixes.md": "# Common Fixes\n\nRecurring issues and their solutions.\n",
    "client-prefs.md": "# Client Preferences\n\nClient-specific preferences, design choices, and requirements.\n",
  };
  for (const [name, defaultContent] of Object.entries(knowledgeFiles)) {
    const dest = path.join(knowledgeDir, name);
    if (!fs.existsSync(dest)) {
      fs.writeFileSync(dest, defaultContent);
      ok(`${name} (created)`);
    } else {
      ok(`${name} (exists)`);
    }
  }

  // ─── Save config (for update command) ──────────────────
  const configFile = path.join(CLAUDE_DIR, ".qualia-config.json");
  const config = {
    code,
    installed_by: member.name,
    role: member.role,
    version: require("../package.json").version,
    installed_at: new Date().toISOString().split("T")[0],
  };
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");

  // ─── Configure settings.json ───────────────────────────
  console.log("");
  log(`${WHITE}Configuring settings.json...${RESET}`);

  const settingsPath = path.join(CLAUDE_DIR, "settings.json");
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {}
  }

  // Env
  if (!settings.env) settings.env = {};
  Object.assign(settings.env, {
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0",
    MAX_MCP_OUTPUT_TOKENS: "25000",
    CLAUDE_CODE_NO_FLICKER: "1",
  });

  // Status line
  settings.statusLine = {
    type: "command",
    command: "~/.claude/statusline.sh",
  };

  // Spinner
  settings.spinnerVerbs = {
    mode: "replace",
    verbs: [
      "Qualia-fying",
      "Solution-ing",
      "Teal-crafting",
      "Vibe-forging",
      "Shipping",
      "Wiring",
      "Polishing",
      "Verifying",
      "Orchestrating",
      "Architecting",
      "Deploying",
      "Hardening",
    ],
  };

  settings.spinnerTipsOverride = {
    excludeDefault: true,
    tips: [
      "◆ Lost? Type /qualia for the next step",
      "◆ Small fix? Use /qualia-quick to skip planning",
      "◆ End of day? /qualia-report before you clock out",
      "◆ Context isolation: every task gets a fresh AI brain",
      "◆ The verifier doesn't trust claims — it greps the code",
      "◆ Plans are prompts — the plan IS what the builder reads",
      "◆ Feature branches only — never push to main",
      "◆ Read before write — no exceptions",
      "◆ MVP first — build what's asked, nothing extra",
      "◆ tracking.json syncs to ERP on every push",
    ],
  };

  // Hooks — full system
  const hd = path.join(CLAUDE_DIR, "hooks");
  settings.hooks = {
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            if: "Bash(git push*)",
            command: `${hd}/branch-guard.sh`,
            timeout: 10,
            statusMessage: "◆ Checking branch permissions...",
          },
          {
            type: "command",
            if: "Bash(git push*)",
            command: `${hd}/pre-push.sh`,
            timeout: 15,
            statusMessage: "◆ Syncing tracking...",
          },
        ],
      },
      {
        matcher: "Edit|Write",
        hooks: [
          {
            type: "command",
            if: "Edit(*.env*)|Write(*.env*)",
            command: `${hd}/block-env-edit.sh`,
            timeout: 5,
            statusMessage: "◆ Checking file permissions...",
          },
          {
            type: "command",
            if: "Edit(*migration*)|Write(*migration*)|Edit(*.sql)|Write(*.sql)",
            command: `${hd}/migration-guard.sh`,
            timeout: 10,
            statusMessage: "◆ Checking migration safety...",
          },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            if: "Bash(vercel --prod*)",
            command: `${hd}/pre-deploy-gate.sh`,
            timeout: 120,
            statusMessage: "◆ Running quality gates...",
          },
        ],
      },
    ],
    PreCompact: [
      {
        matcher: "compact",
        hooks: [
          {
            type: "command",
            command: `${hd}/pre-compact.sh`,
            timeout: 15,
            statusMessage: "◆ Saving state...",
          },
        ],
      },
    ],
    SubagentStart: [
      {
        matcher: ".*",
        hooks: [
          {
            type: "command",
            command:
              'echo \'{"additionalContext": "◆ Qualia agent spawned"}\'',
          },
        ],
      },
    ],
  };

  // Permissions
  if (!settings.permissions) settings.permissions = {};
  if (!settings.permissions.allow) settings.permissions.allow = [];
  if (!settings.permissions.deny) {
    settings.permissions.deny = [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
    ];
  }

  settings.effortLevel = "high";

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

  ok("Hooks: branch-guard, pre-push, env-block, migration-guard, deploy-gate, pre-compact");
  ok("Status line + spinner configured");
  ok("Environment variables + permissions");

  // ─── Summary ───────────────────────────────────────────
  console.log("");
  console.log(`${TEAL}  ◆ Installed ✓${RESET}`);
  console.log(`${DIM}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`  ${WHITE}${member.name}${RESET} ${DIM}(${member.role})${RESET}`);
  console.log(`  Skills:       ${WHITE}${skills.length}${RESET}`);
  console.log(`  Agents:       ${WHITE}3${RESET} ${DIM}(planner, builder, verifier)${RESET}`);
  console.log(`  Hooks:        ${WHITE}6${RESET} ${DIM}(branch-guard, pre-push, env-block, migration-guard, deploy-gate, pre-compact)${RESET}`);
  console.log(`  Rules:        ${WHITE}3${RESET} ${DIM}(security, frontend, deployment)${RESET}`);
  console.log(`  Scripts:      ${WHITE}1${RESET} ${DIM}(state.js — state machine)${RESET}`);
  console.log(`  Knowledge:    ${WHITE}3${RESET} ${DIM}(patterns, fixes, client prefs)${RESET}`);
  console.log(`  Templates:    ${WHITE}4${RESET}`);
  console.log(`  Status line:  ${GREEN}✓${RESET}`);
  console.log(`  CLAUDE.md:    ${GREEN}✓${RESET} ${DIM}(${member.role})${RESET}`);

  if (errors > 0) {
    console.log("");
    console.log(`  ${YELLOW}${errors} warning(s)${RESET} — check output above`);
  }

  console.log("");
  console.log(`  Restart Claude Code, then type ${TEAL}/qualia${RESET} in any project.`);
  console.log("");
}

main().catch((e) => {
  console.error(`${RED}  ✗ Installation failed: ${e.message}${RESET}`);
  process.exit(1);
});
