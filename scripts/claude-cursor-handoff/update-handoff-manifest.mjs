/**
 * Single source of truth for Claude handoff manifest files.
 * Run after every check-claude cycle AND from Poll-ClaudeQuestions.ps1.
 */
/* eslint-env node */
import fs from "fs";
import path from "path";

const QUESTIONS_DIR =
  "C:/Users/alan/Google Drive/Claude shared resources/Claude Questions for Cursor";
const OUTPUTS_DIR =
  "C:/Users/alan/Google Drive/Claude shared resources/Cursor Outputs for Claude";
const PROCESSED_DIR = path.join(QUESTIONS_DIR, "processed");

function yamlField(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

function readUtf8(filePath) {
  let raw = fs.readFileSync(filePath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return raw;
}

function writeUtf8NoBom(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
}

function listQuestions(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("QUESTION-") && f.endsWith(".md") && f !== "QUESTION-TEMPLATE.md")
    .map((f) => {
      const full = path.join(dir, f);
      const raw = readUtf8(full);
      const stat = fs.statSync(full);
      return {
        file: f,
        dir: path.basename(dir),
        id: yamlField(raw, "id"),
        status: yamlField(raw, "status"),
        priority: yamlField(raw, "priority"),
        modified: stat.mtime.toISOString(),
        size: stat.size,
      };
    });
}

function listResponses() {
  if (!fs.existsSync(OUTPUTS_DIR)) return [];
  return fs
    .readdirSync(OUTPUTS_DIR)
    .filter((f) => f.startsWith("RESPONSE-") && f.endsWith("-LATEST.md"))
    .map((f) => {
      const full = path.join(OUTPUTS_DIR, f);
      const raw = readUtf8(full);
      const stat = fs.statSync(full);
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      const answers = yamlField(raw, "answers_question");
      const answeredAt = yamlField(raw, "answered_at");
      const commitMatch = raw.match(/\*\*Commit\*\*\s*\|\s*`([^`]+)`/);
      return {
        file: f,
        path: full,
        id: answers || f.replace(/^RESPONSE-/, "").replace(/-LATEST\.md$/, ""),
        title: titleMatch ? titleMatch[1].trim() : f,
        answered_at: answeredAt,
        commit: commitMatch ? commitMatch[1] : null,
        modified: stat.mtime.toISOString(),
        size: stat.size,
        bytes: stat.size,
      };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

function listStatusUpdates() {
  if (!fs.existsSync(OUTPUTS_DIR)) return [];
  return fs
    .readdirSync(OUTPUTS_DIR)
    .filter((f) => f.startsWith("STATUS-") && f.endsWith("-LATEST.md"))
    .map((f) => {
      const full = path.join(OUTPUTS_DIR, f);
      const raw = readUtf8(full);
      const stat = fs.statSync(full);
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      return {
        file: f,
        path: full,
        title: titleMatch ? titleMatch[1].trim() : f,
        modified: stat.mtime.toISOString(),
        bytes: stat.size,
      };
    })
    .sort((a, b) => b.modified.localeCompare(a.modified));
}

const now = new Date().toISOString();
const inbox = listQuestions(QUESTIONS_DIR);
const processed = listQuestions(PROCESSED_DIR);
const pending = inbox.filter((q) => q.status === "pending");
const responses = listResponses();
const statusUpdates = listStatusUpdates();
const latestResponse = responses[0] || null;
const latestStatus = statusUpdates[0] || null;

const flagPath = path.join(OUTPUTS_DIR, ".inbox-has-pending");
if (pending.length > 0) {
  fs.writeFileSync(flagPath, String(pending.length), "utf8");
} else if (fs.existsSync(flagPath)) {
  fs.unlinkSync(flagPath);
}

const index = {
  updated_at: now,
  pending_count: pending.length,
  pending,
  latest_response: latestResponse,
  responses,
  recently_processed: processed
    .filter((q) => q.status === "answered")
    .sort((a, b) => b.modified.localeCompare(a.modified))
    .slice(0, 10),
};

writeUtf8NoBom(
  path.join(OUTPUTS_DIR, "HANDOFF-RESPONSE-INDEX-LATEST.json"),
  JSON.stringify(index, null, 2)
);

const mdLines = [
  "# Handoff response index",
  "",
  `**Updated:** ${now}`,
  `**Pending questions:** ${pending.length}`,
  "",
  "## Trust this file",
  "",
  "Claude: read this index (or the JSON twin) instead of relying on status file metadata alone.",
  "Google Drive sync can lag; check `bytes` > 0 before treating a response as empty.",
  "",
  "## Latest response",
  "",
];

if (latestResponse) {
  mdLines.push(
    `| Field | Value |`,
    `|-------|-------|`,
    `| File | \`${latestResponse.file}\` |`,
    `| Title | ${latestResponse.title} |`,
    `| ID | \`${latestResponse.id}\` |`,
    `| Modified (UTC) | ${latestResponse.modified} |`,
    `| Size (bytes) | ${latestResponse.bytes} |`,
    latestResponse.commit ? `| Commit | \`${latestResponse.commit}\` |` : null,
    latestResponse.answered_at ? `| Answered at | ${latestResponse.answered_at} |` : null,
    "",
    `**Full path:** \`${latestResponse.path}\``,
    ""
  );
} else {
  mdLines.push("_No RESPONSE-*-LATEST.md files in outbox._", "");
}

mdLines.push("## All responses (newest first)", "", "| File | Bytes | Modified (UTC) | Title |", "|------|------:|----------------|-------|");
for (const r of responses) {
  mdLines.push(`| ${r.file} | ${r.bytes} | ${r.modified} | ${r.title} |`);
}

if (pending.length > 0) {
  mdLines.push("", "## Pending inbox", "", "| File | ID | Priority |", "|------|-----|----------|");
  for (const p of pending) {
    mdLines.push(`| ${p.file} | ${p.id} | ${p.priority} |`);
  }
}

writeUtf8NoBom(path.join(OUTPUTS_DIR, "HANDOFF-RESPONSE-INDEX-LATEST.md"), mdLines.filter(Boolean).join("\n"));

const statusLines = [
  "# Cursor handoff status",
  "",
  `**Updated:** ${now}`,
  "**Filesystem sync note:** This file is rewritten by update-handoff-manifest.mjs on every poll and check-claude.",
  `**Pending questions:** ${pending.length}`,
  "",
  "## For Claude - read these (in order)",
  "",
  "1. `HANDOFF-RESPONSE-INDEX-LATEST.md` (or `.json`) - canonical index with file sizes",
  "2. `RESPONSE-*-LATEST.md` - full answer (if index shows bytes > 0)",
  "3. This file - quick summary only",
  "",
  "## Inbox",
  `\`${QUESTIONS_DIR}\``,
  "",
  "## Outbox",
  `\`${OUTPUTS_DIR}\``,
  "",
];

if (latestResponse) {
  statusLines.push(
    "## Latest response",
    "",
    `- **File:** \`${latestResponse.file}\` (${latestResponse.bytes} bytes, modified ${latestResponse.modified})`,
    `- **Title:** ${latestResponse.title}`,
    latestResponse.commit ? `- **Commit:** \`${latestResponse.commit}\`` : null,
    ""
  );
}

if (latestStatus) {
  statusLines.push(
    "## Latest status update (Alan confirmations / verified state)",
    "",
    `- **File:** \`${latestStatus.file}\` (${latestStatus.bytes} bytes, modified ${latestStatus.modified})`,
    `- **Title:** ${latestStatus.title}`,
    ""
  );
}

if (pending.length === 0) {
  statusLines.push("No pending questions.");
} else {
  statusLines.push("## Pending", "");
  for (const p of pending) {
    statusLines.push(`- ${p.file} (${p.priority})`);
  }
}

writeUtf8NoBom(path.join(OUTPUTS_DIR, "CURSOR-HANDOFF-STATUS-LATEST.md"), statusLines.filter(Boolean).join("\n"));

console.log(`handoff manifest updated: pending=${pending.length} responses=${responses.length} latest=${latestResponse?.file || "none"}`);
