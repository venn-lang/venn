/**
 * Turns the per-package changelogs into the notes for one release.
 *
 * Every package in the language shares a version, so a release is of the
 * language, not of twenty-nine libraries that happen to move together. Most of
 * those changelogs say only that an internal dependency moved, which is true
 * and worth nothing to a reader, so this keeps what a person actually did and
 * drops the rest.
 *
 * Usage: node scripts/release-notes.mjs <version>
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGES = "packages";

/** A changelog entry that only records an internal dependency moving. */
const BOOKKEEPING = /^-\s*Updated dependencies/;

async function packageDirs() {
  const entries = await readdir(PACKAGES, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** The body of one version's section, from its heading to the next one. */
function sectionFor(changelog, version) {
  const start = changelog.indexOf(`\n## ${version}\n`);
  if (start === -1) return "";
  const rest = changelog.slice(start + 1);
  const end = rest.indexOf("\n## ", 1);
  return (end === -1 ? rest : rest.slice(0, end)).split("\n").slice(1).join("\n");
}

/**
 * Drops the bookkeeping bullets and the headings left empty behind them.
 * A bullet can run over several lines, so continuation lines go with it.
 */
function meaningful(section) {
  const kept = [];
  let dropping = false;
  for (const line of section.split("\n")) {
    if (line.startsWith("-")) dropping = BOOKKEEPING.test(line);
    else if (dropping && (line.startsWith("  ") || line.trim() === "")) continue;
    else if (!line.startsWith(" ")) dropping = false;
    if (!dropping) kept.push(line);
  }
  return withoutEmptyHeadings(kept.join("\n"));
}

function withoutEmptyHeadings(text) {
  return text
    .replace(/###[^\n]*\n+(?=###|$)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The package is the heading here, so its own headings step down to labels. */
function asLabels(body) {
  return body.replace(/^### (.+)$/gm, "**$1**");
}

async function changesIn(directory, version) {
  const path = join(PACKAGES, directory, "CHANGELOG.md");
  const changelog = await readFile(path, "utf8").catch(() => "");
  if (!changelog) return undefined;
  const body = meaningful(sectionFor(changelog, version));
  if (!body) return undefined;
  const name = JSON.parse(await readFile(join(PACKAGES, directory, "package.json"), "utf8")).name;
  return { name, body };
}

function render(args) {
  const { version, entries, total } = args;
  if (entries.length === 0) {
    const nothing = "Nothing user facing changed. Every package keeps the same version.";
    return `${nothing}\n\n${footer({ version, total })}`;
  }
  const sections = entries.map((entry) => collapsed(entry)).join("\n");
  const parts = [summaryLine(entries), "", sections, thanks(entries), footer({ version, total })];
  return parts.filter((part) => part !== "").join("\n");
}

/**
 * Who this release came from, named once at the end.
 *
 * The changelog already credits each entry inline, which is where a reader
 * looks to see who did a particular thing. This is the other question: who
 * worked on the release at all. Nobody reconstructs that from twenty scattered
 * mentions, and someone who contributed for the first time should not have to.
 */
function thanks(entries) {
  const handles = contributors(entries);
  if (handles.length === 0) return "";
  const credited = handles.map((handle) => `@${handle}`).join(", ");
  const who = handles.length === 1 ? "Thanks to" : "Thanks to everyone who contributed:";
  return `**${who} ${credited}.**\n`;
}

/** Every GitHub handle the changelog thanks, in the order they first appear. */
function contributors(entries) {
  const seen = new Set();
  for (const entry of entries) {
    for (const [, handle] of entry.body.matchAll(/Thanks \[@([^\]]+)\]/g)) seen.add(handle);
  }
  return [...seen];
}

function summaryLine(entries) {
  const names = entries.map((entry) => `\`${entry.name}\``).join(", ");
  if (entries.length === 1) return `Changes in ${names}.`;
  return `Changes in ${entries.length} packages: ${names}.`;
}

/**
 * Folded shut. Twenty-nine packages release together and a reader should be
 * able to see what moved without scrolling past everything that did not.
 * GitHub renders `details` in release notes, but only when the markdown inside
 * is separated from the tags by blank lines.
 */
function collapsed(entry) {
  return [
    "<details>",
    `<summary><b>${entry.name}</b></summary>`,
    "",
    asLabels(entry.body),
    "",
    "</details>",
    "",
  ].join("\n");
}

/**
 * What a reader wants after the notes: how to get it. Every package shares a
 * version, so naming the count is more useful than listing twenty-nine names.
 */
function footer(args) {
  return [
    "---",
    "",
    `All ${args.total} packages are published at \`${args.version}\`.`,
    "",
    "```bash",
    "npm install -g @venn-lang/cli",
    "venn --version",
    "```",
    "",
  ].join("\n");
}

async function publishedCount(directories) {
  const manifests = directories.map((directory) =>
    readFile(join(PACKAGES, directory, "package.json"), "utf8")
      .then(JSON.parse)
      .catch(() => ({ private: true })),
  );
  return (await Promise.all(manifests)).filter((manifest) => !manifest.private).length;
}

async function main() {
  const version = process.argv[2];
  if (!version) throw new Error("usage: node scripts/release-notes.mjs <version>");
  const directories = await packageDirs();
  const found = await Promise.all(directories.map((d) => changesIn(d, version)));
  const entries = found.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const total = await publishedCount(directories);
  process.stdout.write(render({ version, entries, total }));
}

await main();
