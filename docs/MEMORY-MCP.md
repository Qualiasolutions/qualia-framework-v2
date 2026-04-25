# Memory MCP

Read-only Model Context Protocol server that exposes the Qualia knowledge wiki to Claude Code (and any other MCP client) without giving it write access.

The wiki itself lives in `~/qualia-memory/` — a Karpathy-style LLM Wiki on Obsidian. Humans and the framework's `SessionEnd` hooks curate it. This MCP server only reads from `wiki/`.

## Why read-only

The previous design idea was a full Memory API service with embeddings and write endpoints. We dropped it because:

1. The wiki already exists and works — it doesn't need a rewrite into a Next.js service.
2. Writes from agents create memory pollution (every model thinks its insight is worth saving). Curation should remain human-led, with hooks promoting raw session logs through the existing `_raw → wiki` pipeline.
3. A read-only surface is easier to reason about and impossible to corrupt.

If we later want write tools, they go through the framework's existing flush hook (`hooks/stop-session-log.js`), not through this MCP server.

## Tools

| Tool | Args | Returns |
|------|------|---------|
| `memory.search` | `{ query: string, scope?: string, max_results?: number }` | `{ query, scope, total, hits: [{ path, line, snippet }] }` |
| `memory.read` | `{ path: string }` | `{ path, bytes, truncated, content }` (capped at 256 KB) |
| `memory.list` | `{ folder?: string }` | `{ folder, entries: [{ name, type }] }` |

All paths are relative to `wiki/`. Anything that resolves outside `wiki/` is rejected.

## Install

The framework installer (`bin/install.js`) registers `qualia-memory` globally in `~/.claude/settings.json` under `mcpServers`, pointing at `mcp/memory-mcp/server.js` inside the framework install directory. Every Claude Code session picks it up — no per-project config required.

To override the vault location for a specific project, add a project-scoped `.mcp.json` that re-declares the server with a different `QUALIA_MEMORY_ROOT`. The server warns on stderr when the resolved `wiki/` directory does not exist.

## Dependencies

None. The server speaks JSON-RPC 2.0 over stdio directly and shells out to `grep` for search. Same zero-dep posture as `bin/state.js`.

Search uses `grep -rniF` over `*.md`, `*.txt`, `*.canvas`, `*.base`. Plain-text queries — no regex.

## Manual smoke test

```bash
node mcp/memory-mcp/server.js
```

Then paste these line-delimited JSON-RPC frames on stdin:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"memory.list","arguments":{}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"memory.search","arguments":{"query":"qualia","max_results":5}}}
```

Each frame yields one response line on stdout. The startup banner goes to stderr.

## Future tools (not yet implemented)

- `memory.recent(days)` — list pages modified in the last N days. Useful before `/qualia-plan`.
- `memory.client(slug)` — fetch the per-client preference page when a project is linked to a `client_id`.

Both can be added without changing the protocol surface — they're new entries in `TOOLS` and `TOOL_HANDLERS`.
