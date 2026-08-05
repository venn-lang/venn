import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createNodeConsole, createNodeHost, createNodeSignals } from "@venn-lang/contracts/node";
import { createFetchClient } from "@venn-lang/http";
import { createNodeServer } from "@venn-lang/http/node";
import type { RunFilter } from "@venn-lang/runtime";
import { createDiagnostics, type Diagnostics, isError, refuses } from "../diagnostics/index.js";
import { declaredEnv, loadEnv, loadManifest, manifestProblems } from "../manifest/index.js";
import type { Reporter, RunTotals } from "../reporters/index.js";
import { pickReporter, reportProblems } from "../reporters/index.js";
import { collectSourceFiles } from "../run/collect-files.js";
import { problemStream, watchForAStuckRun } from "../run/index.js";
import { createNodeModuleIo } from "../run/node-io.js";
import { createNpmLoader } from "../run/npm-loader.js";
import { type RunFileArgs, type RunFileOutcome, runFile } from "../run/run-file.js";
import { createShutdown, installHooks, type Shutdown } from "../shutdown/index.js";
import { setProgramTitle } from "../title/index.js";
import { projectsOf } from "./check.js";

/** Everything `venn run` accepts. */
export interface RunOptions {
  file: string;
  reporter?: string;
  tags?: string;
  flow?: string;
  step?: string;
  env?: string;
  bail?: boolean;
}

/** What one pass over the files needs to carry from start to finish. */
interface RunPass {
  files: readonly string[];
  options: RunOptions;
  reporter: Reporter;
  shutdown: Shutdown;
  /** The whole command's list, so a mistake two files lead into is said once. */
  diagnostics: Diagnostics;
}

/**
 * `venn test <file|directory>`: run every matching flow, then report.
 *
 * @param options - The file or directory, the reporter, and the filters.
 * @returns The exit code: whatever a flow's `exit` named, else 0 when nothing
 * failed, else 1. Also 1 when the path holds no `.vn` file.
 */
export async function runCommand(options: RunOptions): Promise<number> {
  const files = await collectSourceFiles(resolve(options.file));
  if (files.length === 0) return noFiles(options.file);
  const reporter = pickReporter(options.reporter);
  const shutdown = hooked(options.file);
  const settled = watchForAStuckRun((line) => process.stderr.write(line));
  const diagnostics = createDiagnostics();
  const totals = await runAll({ files, options, reporter, shutdown, diagnostics });
  settled();
  reporter.finish(totals);
  // A suite that called `exit` named its own verdict, even `exit 0` after a
  // failure, which is the point of saying it.
  return totals.exitCode ?? (totals.failed === 0 ? 0 : 1);
}

/** Give the process its hooks and this run its name, as `venn run` also does. */
function hooked(target: string): Shutdown {
  const shutdown = createShutdown();
  setProgramTitle({ command: "test", target });
  installHooks({ signals: createNodeSignals(), shutdown, exit: (code) => process.exit(code) });
  return shutdown;
}

async function runAll(pass: RunPass): Promise<RunTotals> {
  const totals: RunTotals = { passed: 0, failed: 0, files: 0, ms: 0 };
  const started = Date.now();
  if (await refusedProject(pass)) totals.failed += 1;
  await eachFile(pass, totals);
  totals.ms = Date.now() - started;
  return totals;
}

/**
 * What the project itself is refused for, before a single file runs.
 *
 * `venn check` reads the manifest and this did not, so a stray key in
 * `venn.toml` failed one command and was nothing at all to the other. Errors
 * only, which is the rule the check stops on, and said on the reporter's
 * channel, which is where every other refusal goes.
 *
 * Counted as a failure and no more than that. Skipping the files as well ran
 * zero flows for one unrecognised key, with no `run.started` and no summary,
 * and it made the two commands less alike rather than more: `venn check` says
 * the manifest is wrong and checks every source anyway.
 */
async function refusedProject(pass: RunPass): Promise<boolean> {
  const errors = (await manifestProblems(await projectsOf(pass.files))).filter(isError);
  const first = errors[0];
  if (!first) return false;
  // Filed under the manifest, because that is the file the mistake is in.
  pass.reporter.beginFile(first.span.uri);
  problemStream({ sink: pass.reporter.sink, host: createNodeHost() }).say(errors);
  return true;
}

async function eachFile(pass: RunPass, totals: RunTotals): Promise<void> {
  for (const file of pass.files) {
    pass.reporter.beginFile(file);
    await runOne({ pass, file, totals });
    // `exit` ends the command, not just the file it was called in.
    if (totals.exitCode !== undefined) break;
    if (pass.options.bail && totals.failed > 0) break;
  }
}

/**
 * One file, and the servers it started closed with it.
 *
 * A suite that leaves a port bound holds it for the whole run, so a hundred
 * files that serve would end up holding a hundred ports. They are also on the
 * shutdown list, for the run that ends by signal instead of by finishing.
 */
async function runOne(args: { pass: RunPass; file: string; totals: RunTotals }): Promise<void> {
  const servers = createNodeServer();
  const forget = args.pass.shutdown.add(() => servers.closeAll());
  try {
    const outcome = await runFile(await buildArgs(args.file, args.pass, servers));
    // Errors went to the reporter, on the channel a failure uses. What is left
    // is worth reading and worth nobody's exit code, and stdout belongs to the
    // report, so it is said on the other stream.
    reportProblems(outcome.problems.filter((one) => !isError(one)));
    tally(args.totals, outcome);
  } finally {
    await servers.closeAll();
    forget();
  }
}

function tally(totals: RunTotals, outcome: RunFileOutcome): void {
  if (refuses(outcome.problems)) {
    totals.files += 1;
    totals.failed += 1;
    return;
  }
  if (outcome.result?.exitCode !== undefined) totals.exitCode = outcome.result.exitCode;
  const passed = outcome.result?.passed ?? 0;
  const failed = outcome.result?.failed ?? 0;
  // A file whose flows were all filtered out is not part of the run.
  if (passed + failed > 0) totals.files += 1;
  totals.passed += passed;
  totals.failed += failed;
}

async function buildArgs(
  file: string,
  pass: RunPass,
  httpServer: ReturnType<typeof createNodeServer>,
): Promise<RunFileArgs> {
  const found = await loadManifest(file);
  const manifest = found?.manifest;
  return {
    source: await readFile(file, "utf8"),
    diagnostics: pass.diagnostics,
    uri: file,
    host: createNodeHost(),
    sink: pass.reporter.sink,
    httpClient: createFetchClient(),
    httpServer,
    // The real streams, as `venn run` has always had them. Without this every
    // `print` in a flow wrote into a buffer nobody drained, so the reporter
    // showed a passing step and none of the text under it.
    //
    // Under `venn test` the program writes to standard error, because standard
    // output belongs to the reporter: a `print` among the envelopes is a line
    // of NDJSON nobody can parse, and one before the XML prolog is not a JUnit
    // file. Both streams reach the same terminal, so a person still sees it.
    console: createNodeConsole({ argv: [], stdout: process.stderr }),
    filter: filterOf(pass.options),
    bail: pass.options.bail,
    env: await loadEnv({
      manifest,
      name: pass.options.env ?? "local",
      dir: found?.dir ?? dirname(file),
    }),
    declared: await declaredEnv(found),
    // Where the project is, so a run reads what its packages published, which
    // is what `venn check` reads. Two commands checking different worlds is how
    // they came to disagree about a name that came from a package.
    root: found?.dir,
    io: createNodeModuleIo({
      paths: manifest?.paths ?? {},
      rootDir: found?.dir ?? dirname(file),
    }),
    npm: createNpmLoader({ root: found?.dir ?? dirname(file) }),
  };
}

function filterOf(options: RunOptions): RunFilter {
  return { tags: parseTags(options.tags), flow: options.flow, step: options.step };
}

function parseTags(tags: string | undefined): readonly string[] | undefined {
  if (!tags) return undefined;
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "");
}

function noFiles(path: string): number {
  process.stderr.write(`No .vn files found at ${path}\n`);
  return 1;
}
