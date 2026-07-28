/**
 * Turns the per-package changelogs into the notes for one release.
 *
 * Every package in the language shares a version, so a release is of the
 * language, not of twenty-nine libraries that happen to move together. What a
 * reader wants to know is what is new and what was fixed, so entries are
 * grouped by that rather than by which package they landed in, and the package
 * becomes a label on the line.
 *
 * Entries recording only that an internal dependency moved are dropped: true,
 * and worth nothing to anyone reading.
 *
 * Usage: node scripts/release-notes.mjs <version>
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const PACKAGES = "packages";

/** What changesets calls each kind of section, and what a reader calls it. */
const SECTIONS = [
  { heading: "Major Changes", title: "Breaking changes" },
  { heading: "Minor Changes", title: "New features" },
  { heading: "Patch Changes", title: "Fixes and improvements" },
];

const BOOKKEEPING = /^-\s*Updated dependencies/;

/** ``- [#27](url) [`sha`](url) Thanks [@who](url)! - the sentence`` */
const CREDITED = /^\[(#\d+)\]\((\S+)\)\s+\[`\w+`\]\(\S+\)\s+Thanks \[@([^\]]+)\]\(\S+\)!\s+-\s+/;

async function packageDirs() {
  const entries = await readdir(PACKAGES, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

/** The body of one version's section, from its heading to the next version. */
function sectionFor(changelog, version) {
  const start = changelog.indexOf(`\n## ${version}\n`);
  if (start === -1) return "";
  const rest = changelog.slice(start + 1);
  const end = rest.indexOf("\n## ", 1);
  return (end === -1 ? rest : rest.slice(0, end)).split("\n").slice(1).join("\n");
}

/** The text under one `### ...` heading within a version's section. */
function under(section, heading) {
  const start = section.indexOf(`### ${heading}`);
  if (start === -1) return "";
  const rest = section.slice(start);
  const end = rest.indexOf("\n### ", 1);
  return (end === -1 ? rest : rest.slice(0, end)).split("\n").slice(1).join("\n");
}

/** Splits a block into bullets, keeping the lines each one runs over. */
function bullets(block) {
  const found = [];
  for (const raw of block.split("\n")) {
    if (raw.startsWith("- ")) found.push(raw);
    else if (found.length > 0 && (raw.startsWith("  ") || raw.trim() === "")) {
      found[found.length - 1] += `\n${raw}`;
    }
  }
  return found.filter((bullet) => !BOOKKEEPING.test(bullet)).map((bullet) => bullet.trim());
}

/** Pulls the pull request and the author back out of what changesets wrote. */
function credit(bullet) {
  const text = bullet.replace(/^-\s+/, "");
  const found = CREDITED.exec(text);
  if (!found) return { body: text, source: "", who: undefined };
  const [, pr, url, who] = found;
  const source = `[${pr}](${url}), [@${who}](https://github.com/${who})`;
  return { body: text.slice(found[0].length), source, who };
}

/** The first paragraph carries the change; the rest is detail worth folding. */
function split(body) {
  const at = body.indexOf("\n\n");
  if (at === -1) return { lead: body.trim(), rest: "" };
  return { lead: body.slice(0, at).trim(), rest: body.slice(at).trim() };
}

function line(entry) {
  const { lead, rest } = split(entry.body);
  const tail = entry.source ? ` (${entry.source})` : "";
  const head = `- **${entry.name}**: ${lead.replace(/\n\s*/g, " ")}${tail}`;
  return rest ? `${head}\n${folded(rest)}` : head;
}

/** Indented to stay inside the bullet, and shut so the page stays short. */
function folded(rest) {
  return `  <details><summary>Details</summary>\n\n  ${rest.replace(/\n\s*/g, "\n  ")}\n  </details>`;
}

async function entriesIn(directory, version) {
  const path = join(PACKAGES, directory, "CHANGELOG.md");
  const changelog = await readFile(path, "utf8").catch(() => "");
  if (!changelog) return [];
  const manifest = await readFile(join(PACKAGES, directory, "package.json"), "utf8");
  const name = JSON.parse(manifest).name;
  const section = sectionFor(changelog, version);
  return SECTIONS.flatMap(({ heading, title }) =>
    bullets(under(section, heading)).map((bullet) => ({ title, name, ...credit(bullet) })),
  );
}

function group(entries) {
  return SECTIONS.map(({ title }) => ({
    title,
    lines: entries.filter((entry) => entry.title === title).map(line),
  })).filter((section) => section.lines.length > 0);
}

/**
 * Who this release came from, named once at the end. The lines above credit
 * each change, which answers who did a particular thing. This answers the other
 * question: who worked on the release at all.
 */
function thanks(entries) {
  const handles = [...new Set(entries.map((entry) => entry.who).filter(Boolean))];
  if (handles.length === 0) return "";
  const credited = handles.map((handle) => `@${handle}`).join(", ");
  const lead = handles.length === 1 ? "Thanks to" : "Thanks to everyone who contributed:";
  return `**${lead} ${credited}.**\n`;
}

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
  ].join("\n");
}

function render(args) {
  const { version, entries, total } = args;
  const sections = group(entries).map((s) => `### ${s.title}\n\n${s.lines.join("\n")}\n`);
  const nothing = "Nothing user facing changed. Every package keeps the same version.\n";
  const parts = [sections.length > 0 ? sections.join("\n") : nothing, thanks(entries)];
  return `${parts.filter(Boolean).join("\n")}\n${footer({ version, total })}\n`;
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
  const found = await Promise.all(directories.map((d) => entriesIn(d, version)));
  const entries = found.flat().sort((a, b) => a.name.localeCompare(b.name));
  process.stdout.write(render({ version, entries, total: await publishedCount(directories) }));
}

await main();
