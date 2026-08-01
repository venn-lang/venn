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

import { readFile, writeFile } from "node:fs/promises";
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

/**
 * A changeset this branch brought by hand, which must not be overwritten.
 *
 * Asked of the files the pull request changed, not of the directory. A
 * changeset waiting there for a release that has not gone out yet belongs to
 * another branch, and reading it as this one's leaves every pull request
 * opened in the meantime out of the changelog.
 *
 * Only this script's own output is excluded, and it is excluded by a name no
 * author would reach for. Naming the generated file after the branch, as this
 * once did, made the obvious hand-written name the reserved one: five of them
 * were replaced by a sentence taken from a pull request title before anybody
 * noticed.
 */
function writtenByHand(args) {
  const mine = fileName(args.slug).replaceAll("\\", "/");
  const isOne = (file) =>
    file.startsWith(`${CHANGESETS}/`) &&
    file.endsWith(".md") &&
    file !== `${CHANGESETS}/README.md` &&
    file !== mine;
  return args.files.map((file) => file.replaceAll("\\", "/")).some(isOne);
}

function body(args) {
  const front = args.names.map((name) => `"${name}": ${args.bump}`).join("\n");
  const sentence = args.subject.charAt(0).toUpperCase() + args.subject.slice(1);
  return `---\n${front}\n---\n\n${sentence}.\n`;
}

/**
 * Where this script writes.
 *
 * The branch is in the name, so a second push to the same branch rewrites the
 * same file and two open branches never collide on the way to `main`. The
 * prefix is what keeps it out of the way of whoever writes one by hand:
 * `fix-unresolved-import.md` is a name somebody chooses, and
 * `generated-fix-unresolved-import.md` is not.
 */
function fileName(slug) {
  const branch = slug.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return join(CHANGESETS, `generated-${branch}.md`);
}

function skip(reason) {
  process.stdout.write(`${reason}\n`);
}

async function main() {
  const [title, ...files] = process.argv.slice(2);
  if (!title) throw new Error('usage: node scripts/changeset-from-pr.mjs "<title>" <files...>');

  const slug = process.env.BRANCH || "auto";
  if (writtenByHand({ files, slug })) return skip("This branch wrote its own, leaving it alone.");
  if (!touchesSource(files)) return skip("No published source changed, nothing to release.");

  const parsed = parse(title);
  if (!parsed) return skip(`Title is not a conventional commit: ${title}`);
  if (!parsed.bump) return skip(`Nothing to release for this kind of change: ${title}`);

  const names = await publishedNames(dirsTouched(files));
  if (names.length === 0) return skip("Only private packages changed.");

  const path = fileName(slug);
  await writeFile(path, body({ names, bump: parsed.bump, subject: parsed.subject }), "utf8");
  process.stdout.write(`Wrote ${path}: ${parsed.bump} for ${names.join(", ")}\n`);
}

await main();
