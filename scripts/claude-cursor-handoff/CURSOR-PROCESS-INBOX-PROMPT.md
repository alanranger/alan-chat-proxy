# Prompt: process Claude inbox (paste into Cursor chat or Cursor Automation)

Process the Claude ↔ Cursor handoff inbox.

## Paths

- **Inbox:** `C:\Users\alan\Google Drive\Claude shared resources\Claude Questions for Cursor\`
- **Outbox:** `C:\Users\alan\Google Drive\Claude shared resources\Cursor Outputs for Claude\`
- **Status:** read `CURSOR-HANDOFF-STATUS-LATEST.md` in outbox first

## Steps

1. List all `QUESTION-*.md` **and** `BUILD-BRIEF-*.md` in the inbox with YAML `status: pending`, `status: open`, or `status: processing` (master multi-phase briefs may stay `processing` across phases — do not treat as empty inbox).
2. For each pending/open item (highest `priority: high` first, then by file date); for `processing` master briefs, continue the next unfinished phase only:
   - Set frontmatter `status: processing` (save file) if it was pending/open.
   - Read the question/brief body and any `repos:` hints.
   - Investigate using codebase, Supabase MCP, and tools as needed.
   - Write answer to outbox: `RESPONSE-<id>-LATEST.md` with frontmatter:
     ```yaml
     ---
     answers_question: <id>
     question_file: <original filename>
     answered_by: cursor
     answered_at: <ISO datetime>
     status: complete
     ---
     ```
   - Move **completed** single-shot question files to `processed\` and set `status: answered`. Leave multi-phase `BUILD-BRIEF-*` in the inbox as `processing` until the brief’s final phase is done (or Claude files a superseding brief).
3. **Always** run handoff manifest refresh after processing (mandatory):
   `node scripts/claude-cursor-handoff/update-handoff-manifest.mjs`
   from Chat AI Bot repo root (or full path). This updates:
   - `CURSOR-HANDOFF-STATUS-LATEST.md`
   - `HANDOFF-RESPONSE-INDEX-LATEST.md`
   - `HANDOFF-RESPONSE-INDEX-LATEST.json`
   Do not hand-edit status only — the 15-min poll also uses this script; one writer avoids stale manifests. Manifest pending list includes both `QUESTION-*` and `BUILD-BRIEF-*`.
4. Reply with a short summary: how many answered, response filenames.

## Rules

- Do not put secrets in outbox files.
- One response file per question; use `-LATEST` suffix.
- If a question is ambiguous, still write a response noting what you need clarified.
- **Git (BUILD questions):** use **GitKraken MCP** (`git_add_or_commit`, `git_push`) — never Shell for add/commit/push. See `Chat AI Bot/.cursor/rules/gitkraken-git-ops.mdc`.
