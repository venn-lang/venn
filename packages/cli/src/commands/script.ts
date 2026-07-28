import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createNodeConsole, createNodeHost, createNodeSignals } from "@venn/contracts/node";
import { createFetchClient } from "@venn/http";
import { createNodeServer, type NodeHttpServer } from "@venn/http/node";
import { envDirOf, loadEnv, loadManifest } from "../manifest/index.js";
import { createProblemSink, errorLine, reportProblems } from "../reporters/index.js";
import type { Ending } from "../run/ending.types.js";
import { exitCodeOf } from "../run/exit-code.js";
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
  try {
    const outcome = await runFile(await scriptArgs({ options, uri, servers, shutdown }));
    if (outcome.problems.length > 0) return { code: report(outcome.problems), leave: true };
    return await ending(exitCodeOf(outcome.result), asked(outcome.result), shutdown);
  } catch (error) {
    await shutdown.close();
    return { code: crashed(error), leave: true };
  }
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
  await shutdown.close();
  return { code, leave: true };
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

/** An error thrown mid-script: print it the way the program would see it, then fail. */
function crashed(error: unknown): number {
  process.stderr.write(`${errorLine(error)}\n`);
  return 1;
}
