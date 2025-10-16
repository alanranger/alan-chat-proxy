import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.env.MCP_HELPERS_ROOT || process.cwd();
const RG   = process.env.MCP_HELPERS_RG || "rg";

function runRg(args){
  return new Promise((res,rej)=>{
    execFile(RG,args,{cwd:ROOT,maxBuffer:10*1024*1024},(err,stdout,stderr)=>{
      if(err && !stdout) rej(new Error(stderr||err.message)); else res(stdout||stderr||"");
    });
  });
}

const server=new Server({name:"mcp-helpers",version:"0.0.1"},{capabilities:{tools:{}}});
const transport=new StdioServerTransport();

server.setRequestHandler(ListToolsRequestSchema, async ()=>({
  tools:[
    { name:"search",
      description:"ripgrep the workspace",
      inputSchema:{type:"object",properties:{pattern:{type:"string"},context:{type:"number"}},required:["pattern"]}},
    { name:"read",
      description:"read a file relative to workspace root",
      inputSchema:{type:"object",properties:{path:{type:"string"}},required:["path"]}}
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async req=>{
  const name=req.params.name; const a=req.params.arguments||{};
  if(name==="read"){
    const p=resolve(ROOT,String(a.path||"")); const txt=await readFile(p,"utf8");
    return {content:[{type:"text",text:txt}]};
  }
  if(name==="search"){
    const pattern=String(a.pattern||""); const context=Number.isFinite(a.context)?Number(a.context):0;
    const base=["--hidden","--line-number","--color","never"];
    const ignores=["!node_modules","!.git","!dist","!build","!.next","!coverage","!.venv"].flatMap(g=>["--glob",g]);
    const ctx=context>0?[`-C${context}`]:[];
    const out=await runRg([...base,...ignores,...ctx,pattern]);
    return {content:[{type:"text",text:out||"(no matches)"}]};
  }
  return {content:[{type:"text",text:`Unknown tool: ${name}`}]};
});

await server.connect(transport);
