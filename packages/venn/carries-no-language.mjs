/**
 * Fails the build if the orchestrator can reach the language.
 *
 * The whole point of the split is that `venn` installs in a second and carries
 * no compiler. Nothing enforces that on its own: one convenient import of
 * something from `@venn-lang/core` would pull in the parser, the runtime and
 * the standard library, and the binary would quietly go back to being what it
 * was. Nobody notices a package getting slowly larger.
 *
 * The same rule `@venn-lang/core` already lives by, where a stray `node:`
 * import fails the build rather than being found later by someone whose editor
 * stopped working.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** What the orchestrator may depend on. Everything else is the language. */
const ALLOWED = new Set(["@venn-lang/contracts", "@venn-lang/toolchain"]);

/** How large the built binary may be, in bytes. */
const LIMIT = 512 * 1024;

const failures = [];

const manifest = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
for (const name of Object.keys(manifest.dependencies ?? {})) {
  if (name.startsWith("@venn-lang/") && !ALLOWED.has(name)) {
    failures.push(`depends on ${name}, which is the language`);
  }
}

for (const file of await sourceFiles(new URL("./src", import.meta.url).pathname.slice(1))) {
  const source = await readFile(file, "utf8");
  for (const [, imported] of source.matchAll(/from\s+"(@venn-lang\/[^"]+)"/g)) {
    const [scope, name] = imported.split("/");
    const packageName = `${scope}/${name}`;
    if (!ALLOWED.has(packageName)) failures.push(`${file} imports ${imported}`);
  }
}

const built = await readFile(new URL("./dist/cli.mjs", import.meta.url)).catch(() => undefined);
if (built && built.length > LIMIT) {
  const size = (built.length / 1024).toFixed(0);
  failures.push(`dist/cli.mjs is ${size} KB, over the ${LIMIT / 1024} KB it is allowed`);
}

if (failures.length > 0) {
  console.error("The orchestrator must not carry the language:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log("The orchestrator carries no language.");

async function sourceFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await sourceFiles(path)));
    else if (path.endsWith(".ts")) found.push(path);
  }
  return found;
}
