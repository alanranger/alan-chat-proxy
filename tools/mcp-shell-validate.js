#!/usr/bin/env node
/**
 * Local MCP server that exposes SAFE, whitelisted npm validation scripts.
 * Works on Windows (uses npm.cmd) and macOS/Linux.
 *
 * Tools:
 *  - npm_validate_event
 *  - npm_validate_itemlist
 *  - npm_validate_all
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { spawn } from "child_process";
import process from "process";

const ROOT =
  process.env.SHELL_WORKDIR ||
  "G:\\Dropbox\\alan ranger photography\\Website Code\\Chat AI Bot";

// Use npm.cmd on Windows, npm elsewhere
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpmScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ["run", script], {
      cwd: ROOT,
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (code === 0) resolve({ code, stdout, stderr });
      else
        reject(
          new Error(
            `npm run ${script} exited with code ${code}\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
          )
        );
    });
  });
}

const TOOLS = [
  {
    name: "npm_validate_event",
    description: "Run `npm run validate:event` in the project root.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "npm_validate_itemlist",
    description: "Run `npm run validate:itemlist` in the project root.",
    inputSchema: { type: "object", additionalProperties: false },
  },
  {
    name: "npm_validate_all",
    description: "Run `npm run validate:all` in the project root.",
    inputSchema: { type: "object", additionalProperties: false },
  },
];

const server = new Server(
  {
    name: "shell-validate",
    version: "1.0.0",
    description:
      "Whitelisted validator: validate:event, validate:itemlist, validate:all",
  },
  {
    capabilities: { tools: {} },
  }
);

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = req.params.name;

  if (tool === "npm_validate_event") {
    const res = await runNpmScript("validate:event");
    return { content: [{ type: "text", text: res.stdout || "ok" }] };
  }
  if (tool === "npm_validate_itemlist") {
    const res = await runNpmScript("validate:itemlist");
    return { content: [{ type: "text", text: res.stdout || "ok" }] };
  }
  if (tool === "npm_validate_all") {
    const res = await runNpmScript("validate:all");
    return { content: [{ type: "text", text: res.stdout || "ok" }] };
  }

  // Unknown tool
  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${tool}. Available: ${TOOLS.map((t) => t.name).join(", ")}`,
      },
    ],
    isError: true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
