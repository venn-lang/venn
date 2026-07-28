// Sum self-time per function from a V8 .cpuprofile, hottest first.
import { readdirSync, readFileSync } from "node:fs";

const dir = process.argv[2] ?? "prof-out";
const file = readdirSync(dir).find((name) => name.endsWith(".cpuprofile"));
const profile = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
const nodes = new Map(profile.nodes.map((node) => [node.id, node.callFrame]));
const self = new Map();

for (const id of profile.samples) {
  const frame = nodes.get(id);
  if (!frame) continue;
  const where = `${frame.url.split(/[/]/).slice(-2).join("/")}:${frame.lineNumber + 1}`;
  const key = `${frame.functionName || "(anonymous)"}  ${where}`;
  self.set(key, (self.get(key) ?? 0) + 1);
}

for (const [key, count] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`${((count / profile.samples.length) * 100).toFixed(1).padStart(5)}%  ${key}`);
}
