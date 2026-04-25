#!/usr/bin/env node
// Qualia Memory MCP — read-only access to the Obsidian wiki at QUALIA_MEMORY_ROOT.
// Zero dependencies. Implements MCP over stdio (JSON-RPC 2.0, line-delimited).
//
// Tools:
//   memory.search(query, scope?)  — case-insensitive grep over wiki, returns hits with file:line
//   memory.read(path)             — read a single file under wiki/ as text
//   memory.list(folder?)          — list folder contents (one level), default = wiki root
//
// Safety:
//   - All paths are resolved under QUALIA_MEMORY_ROOT/wiki and rejected if they escape it.
//   - No write tools. Memory is curated by humans + qualia-framework SessionEnd hooks only.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = process.env.QUALIA_MEMORY_ROOT || path.join(require("os").homedir(), "qualia-memory");
const WIKI = path.join(ROOT, "wiki");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "qualia-memory", version: "0.1.0" };

const TOOLS = [
  {
    name: "memory.search",
    description:
      "Case-insensitive search across the Qualia memory wiki. Returns matches as " +
      "{ path, line, snippet }. Use this before /qualia-plan or /qualia-build to pull " +
      "prior decisions, client preferences, and reusable patterns.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term — plain text, no regex." },
        scope: {
          type: "string",
          description:
            "Optional subfolder of wiki/ to limit the search (e.g. 'concepts', 'entities', " +
            "'sessions'). Omit to search the whole wiki.",
        },
        max_results: { type: "integer", description: "Cap on hits (default 30).", default: 30 },
      },
      required: ["query"],
    },
  },
  {
    name: "memory.read",
    description: "Read a single wiki page as text. Path is relative to wiki/ root.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path under wiki/, e.g. 'concepts/llm-wiki.md'." },
      },
      required: ["path"],
    },
  },
  {
    name: "memory.list",
    description: "List one level of contents (files + subfolders) under a wiki folder.",
    inputSchema: {
      type: "object",
      properties: {
        folder: {
          type: "string",
          description: "Relative path under wiki/. Omit or '' for the wiki root.",
        },
      },
    },
  },
];

// ─── Path safety ──────────────────────────────────────────
// Resolve `rel` under WIKI and refuse anything that escapes (.. tricks, abs paths).
function safeResolve(rel) {
  const resolved = path.resolve(WIKI, rel || ".");
  if (resolved !== WIKI && !resolved.startsWith(WIKI + path.sep)) {
    throw new Error(`Path escapes wiki root: ${rel}`);
  }
  return resolved;
}

// ─── Tool implementations ────────────────────────────────
function toolSearch({ query, scope, max_results }) {
  if (!query || typeof query !== "string") throw new Error("query is required");
  const cap = Math.max(1, Math.min(200, Number(max_results) || 30));
  const target = scope ? safeResolve(scope) : WIKI;
  if (!fs.existsSync(target)) throw new Error(`Scope not found: ${scope}`);

  // grep is universally available on POSIX; -r recursive, -n line numbers, -i case-insensitive.
  // -F treats query as fixed string (no regex surprises). --include limits to text-ish files.
  const r = spawnSync(
    "grep",
    [
      "-rniF",
      "--include=*.md",
      "--include=*.txt",
      "--include=*.canvas",
      "--include=*.base",
      "--",
      query,
      target,
    ],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 10_000 },
  );

  if (r.status !== 0 && r.status !== 1) {
    // status 1 = no matches (normal). Anything else is a real failure.
    throw new Error(`grep failed: ${r.stderr || "exit " + r.status}`);
  }

  const hits = (r.stdout || "")
    .split("\n")
    .filter(Boolean)
    .slice(0, cap)
    .map((line) => {
      // grep output: <abs_path>:<lineno>:<text>
      const firstColon = line.indexOf(":");
      const secondColon = line.indexOf(":", firstColon + 1);
      if (firstColon < 0 || secondColon < 0) return null;
      const abs = line.slice(0, firstColon);
      const lineno = Number(line.slice(firstColon + 1, secondColon));
      const snippet = line.slice(secondColon + 1).trim();
      return {
        path: path.relative(WIKI, abs),
        line: lineno,
        snippet: snippet.length > 240 ? snippet.slice(0, 240) + "…" : snippet,
      };
    })
    .filter(Boolean);

  return { query, scope: scope || null, total: hits.length, hits };
}

function toolRead({ path: rel }) {
  if (!rel || typeof rel !== "string") throw new Error("path is required");
  const abs = safeResolve(rel);
  const stat = fs.statSync(abs);
  if (!stat.isFile()) throw new Error(`Not a file: ${rel}`);
  // Cap at 256KB so a runaway page doesn't blow the JSON-RPC frame.
  const MAX = 256 * 1024;
  let content = fs.readFileSync(abs, "utf8");
  let truncated = false;
  if (content.length > MAX) {
    content = content.slice(0, MAX);
    truncated = true;
  }
  return { path: rel, bytes: stat.size, truncated, content };
}

function toolList({ folder }) {
  const target = safeResolve(folder || ".");
  if (!fs.existsSync(target)) throw new Error(`Folder not found: ${folder || "(root)"}`);
  const entries = fs.readdirSync(target, { withFileTypes: true });
  return {
    folder: path.relative(WIKI, target) || ".",
    entries: entries
      .map((e) => ({ name: e.name, type: e.isDirectory() ? "dir" : "file" }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)),
  };
}

const TOOL_HANDLERS = {
  "memory.search": toolSearch,
  "memory.read": toolRead,
  "memory.list": toolList,
};

// ─── MCP / JSON-RPC plumbing ──────────────────────────────
function rpcResult(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}
function rpcError(id, code, message, data) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, ...(data && { data }) } });
}

function handleRequest(req) {
  const { id, method, params } = req;
  try {
    if (method === "initialize") {
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: SERVER_INFO,
        capabilities: { tools: {} },
      });
    }
    if (method === "tools/list") {
      return rpcResult(id, { tools: TOOLS });
    }
    if (method === "tools/call") {
      const { name, arguments: args } = params || {};
      const handler = TOOL_HANDLERS[name];
      if (!handler) return rpcError(id, -32601, `Unknown tool: ${name}`);
      const out = handler(args || {});
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      });
    }
    if (method === "notifications/initialized" || method === "notifications/cancelled") {
      return null; // notifications get no response
    }
    return rpcError(id, -32601, `Unknown method: ${method}`);
  } catch (err) {
    return rpcError(id, -32000, err.message || String(err));
  }
}

// ─── stdio loop ───────────────────────────────────────────
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let req;
    try {
      req = JSON.parse(line);
    } catch (err) {
      process.stdout.write(rpcError(null, -32700, "Parse error: " + err.message) + "\n");
      continue;
    }
    const out = handleRequest(req);
    if (out !== null) process.stdout.write(out + "\n");
  }
});

process.stdin.on("end", () => process.exit(0));

// Surface root config on startup so misconfigured installs are visible in MCP logs.
process.stderr.write(`[qualia-memory] wiki root: ${WIKI}\n`);
if (!fs.existsSync(WIKI)) {
  process.stderr.write(
    `[qualia-memory] WARNING: wiki root does not exist. Set QUALIA_MEMORY_ROOT or create ${ROOT}/wiki/.\n`,
  );
}
