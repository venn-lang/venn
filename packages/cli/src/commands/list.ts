import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type Document, type FlowDecl, isFlowDecl, parse, stepTitlesOf } from "@venn-lang/core";
import { matchesTitle } from "@venn-lang/runtime";
import { shorten } from "../paths/index.js";
import { bold, cyan, dim } from "../reporters/colors.js";
import { collectSourceFiles } from "../run/collect-files.js";

/** Everything `venn list` accepts. */
export interface ListOptions {
  file: string;
  flow?: string;
  step?: string;
}

/**
 * `venn list <file|directory>`: what would run, without running it.
 *
 * @returns 0, or 1 when the path holds no `.vn` file.
 */
export async function listCommand(options: ListOptions): Promise<number> {
  const files = await collectSourceFiles(resolve(options.file));
  if (files.length === 0) {
    process.stderr.write(`No .vn files found at ${options.file}\n`);
    return 1;
  }
  for (const file of files) await listFile(file, options);
  return 0;
}

async function listFile(file: string, options: ListOptions): Promise<void> {
  const { ast } = parse(await readFile(file, "utf8"), { uri: file });
  const flows = ast.decls.filter(isFlowDecl).filter((f) => matchesTitle(f.title, options.flow));
  if (flows.length === 0) return;
  write(`\n${cyan(shorten(file))}`);
  for (const flow of flows) writeFlow(flow, ast, options.step);
}

function writeFlow(flow: FlowDecl, document: Document, step: string | undefined): void {
  write(`  ${dim("❯")} ${bold(flow.title)}`);
  for (const title of stepTitlesOf(flow, document)) {
    if (matchesTitle(title, step)) write(`    ${dim("•")} ${title}`);
  }
}

function write(text: string): void {
  process.stdout.write(`${text}\n`);
}
