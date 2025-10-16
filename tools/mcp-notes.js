#!/usr/bin/env node
/**
 * Notes MCP — local scratchpad memory for Cursor AI
 * -------------------------------------------------
 * Gives Cursor read/write access to /notes/store/
 * Tools available:
 *   notes_list     → list note files
 *   notes_get      → read a note
 *   notes_create   → create a new note
 *   notes_append   → append text to an existing note
 *   notes_search   → find notes containing a phrase
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const NOTES_DIR = path.join(ROOT, "notes", "store");

// ---------- helpers ----------
async function ensureDir() {
  await fs.mkdir(NOTES_DIR, { recursive: true });
}
async function listNotes() {
  await ensureDir();
  const files = await fs.readdir(NOTES_DIR);
  return files.filter(f => f.endsWith(".md")).sort().reverse();
}
async function readNote(id) {
  const file = id.endsWith(".md") ? id : `${id}.md`;
  const p = path.join(NOTES_DIR, file);
  const text = await fs.readFile(p, "utf8");
  const [first, ...rest] = text.split(/\r?\n/);
  const title = first?.replace(/^#\s*/, "") || "(untitled)";
  return { id: file.replace(".md",""), title, body: rest.join("\n") };
}
async function createNote(title, content) {
  await ensureDir();
  const stamp = new Date().toISOString().replace(/[:T]/g,"-").split(".")[0];
  const file = `${stamp}-${title.toLowerCase().replace(/[^a-z0-9]+/g,"-")}.md`;
  const p = path.join(NOTES_DIR, file);
  const body = `# ${title}\n\n${content.trim()}\n`;
  await fs.writeFile(p, body, "utf8");
  return { id: file.replace(".md",""), path: p };
}
async function appendNote(id, content) {
  const file = id.endsWith(".md") ? id : `${id}.md`;
  const p = path.join(NOTES_DIR, file);
  await fs.appendFile(p, `\n${content.trim()}\n`, "utf8");
  return { id };
}
async function searchNotes(query, limit = 10) {
  await ensureDir();
  const files = await listNotes();
  const out = [];
  for (const f of files) {
    const txt = await fs.readFile(path.join(NOTES_DIR, f), "utf8");
    if (txt.toLowerCase().includes(query.toLowerCase())) {
      out.push({ file: f });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ---------- MCP setup ----------
const server = new Server(
  { name: "notes-mcp", version: "1.0.0", description: "Local writable scratchpad memory" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "notes_list", description: "List all notes", inputSchema: { type:"object" } },
    { name: "notes_get", description: "Read a note", inputSchema: { type:"object", required:["id"], properties:{ id:{type:"string"} } } },
    { name: "notes_create", description: "Create a new note", inputSchema: { type:"object", required:["title","content"], properties:{ title:{type:"string"}, content:{type:"string"} } } },
    { name: "notes_append", description: "Append to a note", inputSchema: { type:"object", required:["id","content"], properties:{ id:{type:"string"}, content:{type:"string"} } } },
    { name: "notes_search", description: "Search notes", inputSchema: { type:"object", required:["query"], properties:{ query:{type:"string"}, limit:{type:"integer"} } } }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  switch (name) {
    case "notes_list":   return { content: [{ type: "text", text: (await listNotes()).join("\n") }] };
    case "notes_get":    return { content: [{ type: "text", text: JSON.stringify(await readNote(args.id), null, 2) }] };
    case "notes_create": return { content: [{ type: "text", text: JSON.stringify(await createNote(args.title, args.content), null, 2) }] };
    case "notes_append": return { content: [{ type: "text", text: JSON.stringify(await appendNote(args.id, args.content), null, 2) }] };
    case "notes_search": return { content: [{ type: "text", text: JSON.stringify(await searchNotes(args.query, args.limit), null, 2) }] };
    default: throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
