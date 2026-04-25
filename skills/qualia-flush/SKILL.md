---
name: qualia-flush
description: "Promote daily-log raw entries to the curated knowledge tier — Karpathy-style raw→wiki flush. Reads ~/.claude/knowledge/daily-log/*.md, identifies recurring patterns and decisions, writes them to ~/.claude/knowledge/concepts/{topic}.md, updates index.md. Trigger on 'flush memory', 'promote learnings', 'consolidate logs', 'qualia-flush', 'process daily logs', or run weekly."
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# /qualia-flush — Promote Raw Daily Logs to Curated Concepts

Closes the **raw → wiki** loop in the Qualia memory layer. The Stop hook
(`hooks/stop-session-log.js`, shipped in v4.2.0 foundation) appends
mechanical session checkpoints to `~/.claude/knowledge/daily-log/{date}.md`.
Those entries accumulate but stay raw — they describe what happened, not
what to do about it. This skill reads the recent daily-log entries with an
LLM (you) and writes durable concepts that the builder, planner, and
debug skills will surface later via `node ~/.claude/bin/knowledge.js`.

Inspired by Karpathy's LLM knowledge bases and Cole Medin's self-evolving
Claude memory pattern (NotebookLM, 2026-04-25). Both run a daily/weekly
flush that promotes raw observations into structured wiki articles. We do
the same — manually-triggered, internal-data only, no vector DB.

## When to run

- **Manually:** `/qualia-flush` whenever the daily-log feels rich. Once a week
  is the recommended cadence. More than once a day is wasteful — the
  signal-to-noise ratio is too low at single-day windows.
- **Automatically:** not yet wired. v4.3.0 will add a cron-friendly
  `bin/knowledge-flush.js` non-interactive runner.

## Inputs

- `--days N` (optional, default 14) — how many days of daily-log to consider
- `--project NAME` (optional) — only flush entries for one project
- `--dry-run` (optional) — print the proposed writes, don't touch disk

If the user invokes the skill bare (no args), default to `--days 14` and
all projects. Show a one-line preview before writing anything destructive.

## Process

### 1. Banner + check the floor

```bash
node ~/.claude/bin/qualia-ui.js banner flush 2>/dev/null || true

# Resolve the knowledge dir. Fail loud if it doesn't exist — flush is
# meaningless without a daily-log to read.
KNOWLEDGE_DIR="$HOME/.claude/knowledge"
DAILY_DIR="$KNOWLEDGE_DIR/daily-log"
if [ ! -d "$DAILY_DIR" ]; then
  echo "QUALIA: No daily-log at $DAILY_DIR — Stop hook hasn't run yet, or knowledge layer wasn't initialized."
  echo "Run: npx qualia-framework@latest install"
  exit 1
fi

# Default 14-day window. Date math is cross-platform-safe with Node.
WINDOW_DAYS="${WINDOW_DAYS:-14}"
node -e "
  const d = new Date();
  d.setDate(d.getDate() - $WINDOW_DAYS);
  console.log(d.toISOString().split('T')[0]);
" > /tmp/qualia-flush-cutoff
CUTOFF=$(cat /tmp/qualia-flush-cutoff)
```

### 2. Collect the daily-log entries in window

```bash
# Iterate every file in daily-log/ whose name (YYYY-MM-DD.md) is >= CUTOFF.
# Concatenate them into one stream so the LLM (you) can scan as one corpus.
ls "$DAILY_DIR"/*.md 2>/dev/null | while read -r f; do
  base=$(basename "$f" .md)
  if [ "$base" \> "$CUTOFF" ] || [ "$base" = "$CUTOFF" ]; then
    echo "=== $base ==="
    cat "$f"
    echo ""
  fi
done
```

You now have the raw stream. Read it.

### 3. Identify what's worth promoting

Read every entry. Group by project. Look for these signals — these are
the things that promote into the wiki:

| Signal in raw entry | What to extract | Goes to |
|---|---|---|
| Same fix appears in 2+ sessions | A common fix recipe | `common-fixes.md` (via `knowledge.js append --type fix`) |
| A pattern shows up in 3+ projects | A reusable pattern | `learned-patterns.md` (via `knowledge.js append --type pattern`) |
| A client-name or project preference recurs | A client preference | `client-prefs.md` (via `knowledge.js append --type client`) |
| A new technology/library used successfully | A stack note | `concepts/{tech}.md` (new file, Write directly) |
| A recurring failure mode (verify-fail, regression) | A pitfall | `learned-patterns.md` framed as "anti-pattern: …" |

Things to **NOT** promote:
- Single-occurrence quirks (they're noise until they recur).
- Bare commit/branch info — that's already in git, no value duplicating.
- Anything containing secrets, tokens, customer PII. The knowledge layer
  is plain markdown, never put secrets here.
- Entries from `--dry-run` runs of other skills (they'll show as activity
  but didn't actually do anything).

### 4. Write the promotions

For each thing worth promoting, use the loader's `append`:

```bash
node ~/.claude/bin/knowledge.js append \
  --type {pattern|fix|client} \
  --title "{Concise title — what's the recurring thing?}" \
  --body "{The promoted lesson. Be specific. Include the project name(s) and dates where this pattern was observed so future you can verify.}" \
  --project "{specific project, or 'general' if cross-project}" \
  --context "Promoted by /qualia-flush from daily-log entries on {dates}"
```

For a brand-new topic that doesn't fit pattern/fix/client (e.g. a Stripe
integration approach worth its own file), Write to
`~/.claude/knowledge/concepts/{topic}.md`. Then **update `index.md`** so the
new file is reachable — list it under "What's where" with one line:

```bash
# After writing concepts/stripe-checkout.md:
node ~/.claude/bin/knowledge.js path stripe-checkout
# Returned path = ~/.claude/knowledge/stripe-checkout.md  (NOTE: top-level, not concepts/)
```

> **Subdirectory caveat:** the v4.2.0 loader resolves bare filenames at
> `~/.claude/knowledge/{name}.md`. Subdirectory `concepts/` files are not
> reachable via `knowledge.js load <name>` yet (deferred to v4.3.0). For
> now, write durable concept files at the top level — flat structure is
> fine, the index keeps it organized.

### 5. Mark the window as flushed

Write a stamp file so subsequent flushes can default to "since the last
flush" instead of "last 14 days":

```bash
date -u +%Y-%m-%dT%H:%M:%SZ > "$HOME/.claude/.qualia-last-flush"
```

### 6. Summarize

Print to the user, in plain language:

- N daily-log files scanned (date range)
- M promotions written (with file:title for each)
- K things considered but not promoted (single-occurrence — wait for them to recur)

Format:

```
⬢ Flushed daily-log {start} → {end} ({N} files, {total entries} entries)
  Promoted to wiki:
    + learned-patterns.md  "Supabase RLS in same migration"  (3 sessions, 2 projects)
    + common-fixes.md      "next/font crash on Vercel"       (2 sessions)
    + concepts/voice-agent-call-state.md  (new file)
  Skipped {K} single-occurrence entries — will revisit if they recur.
```

## Style

- **Be conservative.** False-positive promotions (writing noise as if it's a
  pattern) pollute the wiki and erode trust. Better to skip a candidate and
  let it recur next week than to inflate the curated tier.
- **Cite your sources.** Every promoted entry should reference the
  daily-log dates that sourced it, in the `--context` field. If a future
  flush wants to update it, the trail is there.
- **Keep titles short.** `--title "Supabase RLS same migration"` not `"You should always remember that when working with Supabase you need to..."`. The body is for nuance.
- **Don't promote private projects across boundaries.** A pattern from
  Project A is fine to promote as cross-project ONLY if it generalizes.
  Client-specific things stay client-specific (`--type client --project X`).

## Anti-patterns

- **Mass-promoting everything:** if you found "promotions" for 90% of
  daily-log entries, you're labeling, not promoting. Be selective.
- **Re-promoting on every flush:** before appending, run
  `node ~/.claude/bin/knowledge.js search "{title keywords}"` to check if
  the pattern already exists. If it does, either update it (find by `**ID:**`
  line) or skip — never duplicate.
- **Hand-writing to `learned-patterns.md` etc. directly:** always go
  through `knowledge.js append` so the canonical entry format and ID
  generation stay consistent. This skill is the only sanctioned promoter,
  but even it uses the loader for writes.

## Output contract

If invoked with `--dry-run`, print the proposed writes and exit without
touching disk. Otherwise, after step 6 returns the summary, the skill is
done — no follow-up prompts. The user sees the summary and the wiki tier
has new entries that are immediately reachable to every other skill via
the loader.
