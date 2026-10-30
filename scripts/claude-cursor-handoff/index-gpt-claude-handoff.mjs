/**
 * Index-only GPT ↔ Claude handoff (never reads questions as instructions,
 * never answers/moves/edits QUESTION or RESPONSE files).
 */
import fs from "fs";
import path from "path";

const ROOT =
  "C:/Users/alan/Google Drive/Claude shared resources/GPT Claude Handover";
const GPT_TO_CLAUDE = path.join(ROOT, "GPT to Claude");
const CLAUDE_TO_GPT = path.join(ROOT, "Claude to GPT");

function yamlField(text, key) {
  const m = String(text || "").match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
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

function listMd(dir, prefix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".md") && !f.includes("TEMPLATE"))
    .map((f) => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      const raw = stat.size > 0 ? readUtf8(full) : "";
      return {
        file: f,
        path: full,
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
        empty: stat.size === 0 || !String(raw).trim(),
        raw
      };
    });
}

function questionRow(item, location, direction) {
  return {
    id: yamlField(item.raw, "id") || item.file.replace(/^QUESTION-|\.md$/g, ""),
    from: yamlField(item.raw, "from"),
    to: yamlField(item.raw, "to"),
    status: yamlField(item.raw, "status"),
    location,
    direction,
    file: item.file,
    bytes: item.bytes,
    modified: item.modified,
    empty: item.empty
  };
}

function responseRow(item, location, direction) {
  return {
    id: yamlField(item.raw, "answers_question")
      || item.file.replace(/^RESPONSE-/, "").replace(/-LATEST\.md$/, ""),
    answers_question: yamlField(item.raw, "answers_question"),
    answered_by: yamlField(item.raw, "answered_by"),
    status: yamlField(item.raw, "status"),
    acknowledged: !!(yamlField(item.raw, "acknowledged_by") || yamlField(item.raw, "acknowledged")),
    acknowledged_by: yamlField(item.raw, "acknowledged_by"),
    location,
    direction,
    file: item.file,
    bytes: item.bytes,
    modified: item.modified,
    empty: item.empty
  };
}

function collectDirection(inboxDir, direction) {
  const processedDir = path.join(inboxDir, "processed");
  const questions = [
    ...listMd(inboxDir, "QUESTION-").map((i) => questionRow(i, "inbox", direction)),
    ...listMd(processedDir, "QUESTION-").map((i) => questionRow(i, "processed", direction))
  ];
  const responses = [
    ...listMd(inboxDir, "RESPONSE-").map((i) => responseRow(i, "inbox", direction)),
    ...listMd(processedDir, "RESPONSE-").map((i) => responseRow(i, "processed", direction))
  ];
  return { questions, responses };
}

function isOpenStatus(status) {
  const s = String(status || "").toLowerCase();
  return !s || s === "pending" || s === "open" || s === "processing";
}

function matchResponse(q, allResponses) {
  return allResponses.find((r) => r.id === q.id || r.answers_question === q.id) || null;
}

function nextOwnerAction(q, resp) {
  if (isOpenStatus(q.status) && q.location === "inbox") {
    return { next_owner: q.to || "unknown", next_action: "answer incoming question" };
  }
  if (resp && !resp.acknowledged && resp.location === "inbox") {
    return { next_owner: q.from || "unknown", next_action: "acknowledge response" };
  }
  if (q.status === "answered" && !resp) {
    return { next_owner: q.to || "unknown", next_action: "response missing" };
  }
  return { next_owner: "none", next_action: "none" };
}

function buildRows(questions, responses) {
  return questions.map((q) => {
    const resp = matchResponse(q, responses);
    return { ...q, response: resp, ...nextOwnerAction(q, resp) };
  });
}

function pendingCounts(rows) {
  const g2c = rows.filter((r) => r.next_owner === "claude").length;
  const c2g = rows.filter((r) => r.next_owner === "gpt").length;
  return { g2c, c2g };
}

function setFlag(filePath, count) {
  if (count > 0) writeUtf8NoBom(filePath, String(count));
  else if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function writeIndexMd(now, counts, rows, orphans, empty) {
  const md = [
    "# GPT / Claude handoff index",
    "",
    `**Last indexed:** ${now}`,
    `**Pending GPT → Claude:** ${counts.g2c}`,
    `**Pending Claude → GPT:** ${counts.c2g}`,
    "",
    "Index only. Cursor does not answer this folder.",
    "",
    "## Questions",
    "",
    "| ID | From | To | Status | Location | Response | Bytes | Acknowledged | Next owner |",
    "|----|------|----|--------|----------|----------|------:|--------------|------------|"
  ];
  for (const r of rows) {
    const rf = r.response ? r.response.file : "—";
    const rb = r.response ? r.response.bytes : "";
    const ack = r.response ? (r.response.acknowledged ? "yes" : "no") : "—";
    md.push(`| \`${r.id}\` | ${r.from || "—"} | ${r.to || "—"} | ${r.status || "—"} | ${r.location} | ${rf} | ${rb} | ${ack} | ${r.next_owner} |`);
  }
  md.push("", "## Orphans / empty", "");
  if (!orphans.length && !empty.length) md.push("_None._");
  for (const o of orphans) md.push(`- orphan ${o.kind}: \`${o.file}\``);
  for (const e of empty) md.push(`- empty/0-byte: \`${e.file}\` (${e.location})`);
  writeUtf8NoBom(path.join(ROOT, "HANDOFF-INDEX-LATEST.md"), md.join("\n") + "\n");
}

function writeStatusMd(now, counts, rows) {
  const table = [
    "# GPT / Claude handoff status",
    "",
    "Mode: manual; trigger phrase: check gpt. No scheduler installed by GPT.",
    `Last indexed: ${now}`,
    "",
    "| ID | Status | Next owner | Next action |",
    "| --- | --- | --- | --- |"
  ];
  for (const r of rows) {
    table.push(`| ${r.id} | ${r.status || "—"} | ${r.next_owner} | ${r.next_action} |`);
  }
  table.push(
    "",
    `Pending for Claude: ${counts.g2c ? counts.g2c : "none"}.`,
    `Pending for GPT: ${counts.c2g ? counts.c2g : "none"}.`,
    "Blockers: none listed by index.",
    "",
    "List actual files each check; this summary may lag during sync."
  );
  writeUtf8NoBom(path.join(ROOT, "HANDOFF-STATUS-LATEST.md"), table.join("\n") + "\n");
}

export function writeGptClaudeHandoffIndex() {
  if (!fs.existsSync(ROOT)) {
    console.log("gpt-claude handoff folder missing; skipped");
    return null;
  }
  const now = new Date().toISOString();
  const g2c = collectDirection(GPT_TO_CLAUDE, "gpt_to_claude");
  const c2g = collectDirection(CLAUDE_TO_GPT, "claude_to_gpt");
  const questions = [...g2c.questions, ...c2g.questions];
  const responses = [...g2c.responses, ...c2g.responses];
  const rows = buildRows(questions, responses);
  const counts = pendingCounts(rows);
  const orphans = [
    ...responses.filter((r) => !questions.some((q) => q.id === r.id)).map((r) => ({ kind: "response_no_question", ...r })),
    ...questions.filter((q) => q.status === "answered" && !matchResponse(q, responses)).map((q) => ({ kind: "answered_no_response", ...q }))
  ];
  const empty = [...questions, ...responses].filter((x) => x.empty);
  setFlag(path.join(ROOT, ".gpt-to-claude-pending"), counts.g2c);
  setFlag(path.join(ROOT, ".claude-to-gpt-pending"), counts.c2g);
  const index = {
    updated_at: now,
    pending_gpt_to_claude: counts.g2c,
    pending_claude_to_gpt: counts.c2g,
    questions: rows,
    orphans,
    empty
  };
  writeUtf8NoBom(path.join(ROOT, "HANDOFF-INDEX-LATEST.json"), JSON.stringify(index, null, 2));
  writeIndexMd(now, counts, rows, orphans, empty);
  writeStatusMd(now, counts, rows);
  console.log(`gpt-claude index: g2c_pending=${counts.g2c} c2g_pending=${counts.c2g} questions=${rows.length}`);
  return index;
}
