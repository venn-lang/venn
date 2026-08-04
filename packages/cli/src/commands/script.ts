import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createNodeConsole, createNodeHost, createNodeSignals } from "@venn-lang/contracts/node";
import { createFetchClient } from "@venn-lang/http";
import { createNodeServer, type NodeHttpServer } from "@venn-lang/http/node";
import { unclaimed } from "@venn-lang/runtime";
import { declaredEnv, envDirOf, loadEnv, loadManifest } from "../manifest/index.js";
import { createProblemSink, errorLine, problemThrown, reportProblems } from "../reporters/index.js";
import type { Ending } from "../run/ending.types.js";
import { exitCodeOf } from "../run/exit-code.js";
import { watchForAStuckRun } from "../run/index.js";
import { createNodeModuleIo } from "../run/node-io.js";
import { createNpmLoader } from "../run/npm-loader.js";
import { type RunFileArgs, runFile } from "../run/run-file.js";
import { shouldLeave } from "../run/should-leave.js";
import { createShutdown, installHooks, type Shutdown } from "../shutdown/index.js";
import { setProgramTitle } from "../title/index.js";

/** Everything `venn run` (script mode) accepts. */
export interface ScriptOptions {
  file: string;
  args?: readonly string[];
  env?: string;
}

/**
 * `venn run <file>`: execute the file as a program, its statements in order.
 *
 * A program that serves keeps running after the last statement, which is the
 * point of it, so what it opened is closed on the way out instead: whether the
 * way out is a signal, a fault, or a crash mid-script.
 *
 * @returns The code to leave with, and whether the process should go now.
 */
export async function scriptCommand(options: ScriptOptions): Promise<Ending> {
  const uri = resolve(options.file);
  const servers = createNodeServer();
  const shutdown = hooked({ servers, file: uri });
  // A program whose work cannot settle never reaches any of the lines below, so
  // the watch has to be armed before the run and disarmed by it.
  const settled = watchForAStuckRun((line) => process.stderr.write(line));
  try {
    return await script({ options, uri, servers, shutdown, settled });
  } catch (error) {
    settled();
    await shutdown.close();
    return { code: crashed(error), leave: true };
  }
}

async function script(args: {
  options: ScriptOptions;
  uri: string;
  servers: NodeHttpServer;
  shutdown: Shutdown;
  settled: () => void;
}): Promise<Ending> {
  const outcome = await runFile(await scriptArgs(args));
  args.settled();
  if (outcome.problems.length > 0) return { code: report(outcome.problems), leave: true };
  return await ending(exitCodeOf(outcome.result), asked(outcome.result), args.shutdown);
}

/** Whether the program said when to stop, rather than simply running out of lines. */
function asked(result: { exitCode?: number } | undefined): boolean {
  return result?.exitCode !== undefined;
}

/**
 * Leave, or stay and let the loop decide.
 *
 * A program that asked to exit gets what it asked for, but tidily: whatever it
 * opened is given back first, which is the half `process.exit` on its own skips.
 * One that merely reached its last line is not asked to stop, because a server
 * has not finished just because the file has.
 */
async function ending(code: number, requested: boolean, shutdown: Shutdown): Promise<Ending> {
  if (!shouldLeave({ code, requested })) return { code, leave: false };
  // A cleanup that could not finish is a program still holding something it
  // meant to give back, so it does not get to leave with 0. A code the program
  // named itself stands: it said how it went, and this is not better informed.
  const failures = await shutdown.close();
  return { code: failures.length > 0 ? Math.max(code, 1) : code, leave: true };
}

/** Give the process its hooks, its name, and this run's servers to close. */
function hooked(args: { servers: NodeHttpServer; file: string }): Shutdown {
  const shutdown = createShutdown();
  setProgramTitle({ command: "run", target: args.file });
  shutdown.add(() => args.servers.closeAll());
  installHooks({ signals: createNodeSignals(), shutdown, exit: (code) => process.exit(code) });
  return shutdown;
}

/** Everything a script run needs from the machine: the file, the manifest, the ports. */
async function scriptArgs(args: {
  options: ScriptOptions;
  uri: string;
  servers: NodeHttpServer;
  shutdown: Shutdown;
}): Promise<RunFileArgs> {
  const { options, uri } = args;
  const found = await loadManifest(uri);
  const manifest = found?.manifest;
  return {
    source: await readFile(uri, "utf8"),
    uri,
    mode: "script",
    env: await loadEnv({
      manifest,
      name: options.env ?? "local",
      dir: found?.dir ?? envDirOf(uri),
    }),
    declared: await declaredEnv(found),
    // Where the project is, so a run reads what its packages published, which
    // is what `venn check` reads. Two commands checking different worlds is how
    // they came to disagree about a name that came from a package.
    root: found?.dir,
    io: createNodeModuleIo({
      paths: manifest?.paths ?? {},
      rootDir: found?.dir ?? dirname(uri),
    }),
    npm: createNpmLoader({ root: found?.dir ?? dirname(uri) }),
    cleanup: args.shutdown,
    ...nodePorts({ argv: options.args ?? [], servers: args.servers }),
  };
}

/** The real implementations behind the ports a script talks through. */
function nodePorts(args: {
  argv: readonly string[];
  servers: NodeHttpServer;
}): Pick<RunFileArgs, "host" | "sink" | "httpClient" | "httpServer" | "console"> {
  return {
    host: createNodeHost(),
    sink: createProblemSink(),
    httpClient: createFetchClient(),
    httpServer: args.servers,
    console: createNodeConsole({ argv: args.argv }),
  };
}

function report(problems: Parameters<typeof reportProblems>[0]): number {
  reportProblems(problems);
  return 1;
}

/**
 * An error thrown mid-script: print it the way the program would see it, then
 * fail.
 *
 * A throw that carries a code of ours goes through the same report as a
 * compile-time problem, so the code, the location and the help survive the throw
 * instead of arriving as a bare title under a format of their own. Reading the
 * throw rather than its class is what covers every raiser: a `ProblemError` from
 * the kernel is not a `VennError`, a plugin's is neither, and `VennError` carries
 * most of the runtime's codes.
 *
 * This is the last catcher, so it says only what nobody claimed. A raise site
 * that reported its own failure already put it on the stream, and the sink said
 * it out loud: repeating it here is the same failure told twice.
 */
function crashed(error: unknown): number {
  const problem = problemThrown(error);
  if (problem) return unclaimed(error) ? report([problem]) : 1;
  process.stderr.write(`${errorLine(error)}\n`);
  return 1;
}
