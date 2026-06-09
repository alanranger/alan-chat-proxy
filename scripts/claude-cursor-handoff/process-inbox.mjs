/* eslint-env node */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Agent } from "@cursor/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const QUESTIONS_DIR =
  "C:/Users/alan/Google Drive/Claude shared resources/Claude Questions for Cursor";
const PROMPT_PATH = path.join(__dirname, "CURSOR-PROCESS-INBOX-PROMPT.md");
const REPO_ROOT = process.env.HANDOFF_REPO_ROOT || path.join(__dirname, "../..");

const apiKey = process.env.CURSOR_API_KEY;
if (!apiKey) {
  console.error("CURSOR_API_KEY not set");
  process.exit(1);
}

const promptBody = fs.readFileSync(PROMPT_PATH, "utf8");
const pending = fs
  .readdirSync(QUESTIONS_DIR)
  .filter((f) => f.startsWith("QUESTION-") && f.endsWith(".md"));

const fullPrompt = `${promptBody}

## Automated run context

- Time: ${new Date().toISOString()}
- Pending files detected: ${pending.length}
- Files: ${pending.join(", ") || "(none)"}

Process all pending questions now. Write response files to the outbox. Do not ask for confirmation.
`;

const result = await Agent.prompt(fullPrompt, {
  apiKey,
  model: { id: "composer-2.5" },
  local: { cwd: REPO_ROOT },
});

console.log("status:", result.status);
if (result.result) console.log(String(result.result).slice(0, 2000));
const ok = result.status === "completed" || result.status === "finished";
process.exit(ok ? 0 : 2);
