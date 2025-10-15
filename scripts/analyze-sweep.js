import fs from "fs";
import path from "path";

const input = process.argv[2] || process.env.INPUT || "results/live-sweep-*.json";

function globOne(pattern) {
  if (!pattern.includes("*")) return pattern;
  const dir = path.dirname(pattern);
  const base = path.basename(pattern).replace(/\*/g, ".*");
  const rx = new RegExp(`^${base}$`);
  const files = fs.readdirSync(dir).filter(f => rx.test(f)).sort();
  return files.length ? path.join(dir, files[files.length - 1]) : null;
}

const resolved = globOne(input);
if (!resolved) {
  console.error("No input report found for pattern", input);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resolved, "utf8"));

function firstOptions(steps, depth) {
  const s = (steps || []).find(st => st.depth === depth);
  return (s && s.options && s.options[0]) || "";
}

const rows = [];
let suspectedLoops = 0;
for (const r of data) {
  const d0 = firstOptions(r.steps, 0);
  const d1 = firstOptions(r.steps, 1);
  const d2 = firstOptions(r.steps, 2);
  const repeated = d0 && d1 && d0 === d1 || d1 && d2 && d1 === d2 ? 1 : 0;
  if (repeated) suspectedLoops += 1;
  rows.push({ idx: r.idx, question: r.question, status: r.status, d0, d1, d2, suspected_loop: repeated });
}

const outCsv = [
  "idx,question,status,depth0_option,depth1_option,depth2_option,suspected_loop",
  ...rows.map(x => [x.idx, JSON.stringify(x.question), x.status, JSON.stringify(x.d0), JSON.stringify(x.d1), JSON.stringify(x.d2), x.suspected_loop].join(","))
].join("\n");

const outPath = `results/live-sweep-issues-${Date.now()}.csv`;
fs.writeFileSync(outPath, outCsv);

console.log(JSON.stringify({ input: resolved, total: data.length, suspectedLoops }, null, 2));
console.log("Saved:", outPath);


