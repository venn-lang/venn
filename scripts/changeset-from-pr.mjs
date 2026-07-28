/**
 * Writes the changeset a pull request did not bring.
 *
 * The title is already a conventional commit, which says both how the version
 * should move and what changed, so asking for the same thing twice is a chore
 * with no reader on the other end. A changeset written by hand is always kept:
 * a note explaining a change to whoever uses the language beats one derived
 * from a note explaining it to whoever maintains it.
 *
 * Usage: node scripts/changeset-from-pr.mjs "<pr title>" <changed file>...
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGES = "packages";
const CHANGESETS = ".changeset";

/** How each conventional type moves the version. Anything absent releases nothing. */
const BUMPS = { feat: "minor", fix: "patch", perf: "patch", refactor: "patch" };

const TITLE = /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<subject>.+)$/;

function parse(title) {
  const found = TITLE.exec(title.trim());
  if (!found?.groups) return undefined;
  const { type, breaking, subject } = found.groups;
  return { bump: breaking ? "major" : BUMPS[type], subject };
}

/** Only source counts: a change to a test or a config releases nothing. */
function touchesSource(files) {
  return files.some(
    (file) =>
      /^packages\/[^/]+\/src\//.test(file.replace(/\\/g, "/")) && !/\.(test|suite)\.ts$/.test(file),
  );
}

function dirsTouched(files) {
  const dirs = new Set();
  for (const file of files) {
    const found = /^packages\/([^/]+)\/src\//.exec(file.replace(/\\/g, "/"));
    if (found && !/\.(test|suite)\.ts$/.test(file)) dirs.add(found[1]);
  }
  return [...dirs];
}

async function publishedNames(dirs) {
  const read = dirs.map(async (dir) => {
    const raw = await readFile(join(PACKAGES, dir, "package.json"), "utf8").catch(() => "{}");
    const manifest = JSON.parse(raw);
    return manifest.private ? undefined : manifest.name;
  });
  return (await Promise.all(read)).filter(Boolean).sort();
}

/** A changeset already written by hand, which this must not overwrite. */
async function alreadyWritten() {
  const entries = await readdir(CHANGESETS).catch(() => []);
  return entries.some((entry) => entry.endsWith(".md") && entry !== "README.md");
}

function body(args) {
  const front = args.names.map((name) => `"${name}": ${args.bump}`).join("\n");
  const sentence = args.subject.charAt(0).toUpperCase() + args.subject.slice(1);
  return `---\n${front}\n---\n\n${sentence}.\n`;
}

/** Named after the branch, so a second push to the same branch rewrites it. */
function fileName(slug) {
  return join(CHANGESETS, `${slug.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`);
}

function skip(reason) {
  process.stdout.write(`${reason}\n`);
}

async function main() {
  const [title, ...files] = process.argv.slice(2);
  if (!title) throw new Error('usage: node scripts/changeset-from-pr.mjs "<title>" <files...>');

  if (await alreadyWritten()) return skip("A changeset is already here, leaving it alone.");
  if (!touchesSource(files)) return skip("No published source changed, nothing to release.");

  const parsed = parse(title);
  if (!parsed) return skip(`Title is not a conventional commit: ${title}`);
  if (!parsed.bump) return skip(`Nothing to release for this kind of change: ${title}`);

  const names = await publishedNames(dirsTouched(files));
  if (names.length === 0) return skip("Only private packages changed.");

  const path = fileName(process.env.BRANCH || "auto");
  await writeFile(path, body({ names, bump: parsed.bump, subject: parsed.subject }), "utf8");
  process.stdout.write(`Wrote ${path}: ${parsed.bump} for ${names.join(", ")}\n`);
}

await main();
