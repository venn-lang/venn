import { readFile } from "node:fs/promises";
import { ConsolePort, createHost } from "@venn/contracts";
import { checkTypes, type Document, parse } from "@venn/core";
import { createRunner } from "@venn/runtime";
import { allPlugins, stdlibPortBindings } from "@venn/stdlib";
import { capture } from "./capture.ts";
import type { Program } from "./program.types.ts";

/**
 * Parse a `.vn` file and hand back something that runs it.
 *
 * Parsing, type-checking and building the plugin registry all happen here,
 * once — the same way a real process does them once at startup. Only the
 * execution is timed, so the ratio compares engines, not startup costs.
 */
export async function loadProgram(path: string): Promise<Program> {
  const source = await readFile(path, "utf8");
  const started = process.hrtime.bigint();
  const { ast, problems } = parse(source, { uri: path });
  if (problems.length > 0) throw new Error(`${path}: ${problems[0]?.title}`);
  checkTypes(ast as Document, { uri: path });
  const compileMs = Number(process.hrtime.bigint() - started) / 1e6;
  return { compileMs, execute: executor(ast as Document, path) };
}

function executor(ast: Document, uri: string): () => Promise<string> {
  const out = capture();
  const runner = createRunner({
    host: createHost.test(),
    plugins: allPlugins,
    sink: { emit: () => {} },
    ports: [...stdlibPortBindings, { port: ConsolePort, impl: out.console }],
    uri,
  });
  return async () => {
    await runner.script(ast);
    return out.take();
  };
}
