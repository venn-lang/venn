import { type Console, ConsolePort, type Host } from "@venn-lang/contracts";
import { type Document, type Problem, parse } from "@venn-lang/core";
import { type HttpClient, HttpClientPort, type HttpServer, HttpServerPort } from "@venn-lang/http";
import { createNodeServer } from "@venn-lang/http/node";
import {
  type AnalyzeArgs,
  type CleanupSink,
  collectFragments,
  createFrontEnd,
  createRunner,
  type EventSink,
  type ImportGraph,
  type ModuleIo,
  NOTHING_IMPORTED,
  type NpmModules,
  type ResolvedImports,
  type RunFilter,
  type RunResult,
  resolveImports,
} from "@venn-lang/runtime";
import { allPlugins, stdlibPortBindings } from "@venn-lang/stdlib";
import { createDiagnostics, type Diagnostics, isError, refuses } from "../diagnostics/index.js";
import { packageTypesFor } from "./package-types.js";
import { problemStream } from "./problem-stream.js";
import type { ProblemStream } from "./problem-stream.types.js";

/** What one `.vn` file amounted to. */
export interface RunFileOutcome {
  /** Everything refused or reported. Empty when the file ran clean. */
  problems: Problem[];
  /** Absent when nothing ran: the parse or the checks stopped it first. */
  result?: RunResult;
}

/** The source to run, the implementations behind its ports, and how to run it. */
export interface RunFileArgs {
  source: string;
  uri: string;
  host: Host;
  sink: EventSink;
  httpClient: HttpClient;
  /** Injected when the caller needs to close the servers itself, as `venn run` does. */
  httpServer?: HttpServer;
  console?: Console;
  filter?: RunFilter;
  bail?: boolean;
  env?: Record<string, unknown>;
  /**
   * The variables the project declares, as `venn check` and the editor see them.
   *
   * Absent means unknown, and then no `env.*` read is refused: that error is
   * only worth raising when the list is trustworthy. Never derived from `env`
   * below, which holds what a run resolved rather than what a project declared,
   * and deriving it is how three commands came to give three verdicts.
   */
  declared?: readonly string[];
  io?: ModuleIo;
  /** How an installed package is loaded, when the host can load one. */
  npm?: NpmModules;
  /**
   * Where the project lives, for reading what its installed packages published.
   *
   * `venn check` read those and a run did not, so the two commands type-checked
   * different worlds and disagreed about a name that came from a package.
   * Absent means there is no project, never "do not look".
   */
  root?: string;
  /** Where the program registers what it opened, so the host can close it. */
  cleanup?: CleanupSink;
  /** "test" runs the flows; "script" executes the file top to bottom. */
  mode?: "test" | "script";
  /**
   * The command's one list, so a mistake two files lead into is said once.
   *
   * Absent means this file is the whole command, which is what a test calling
   * `runFile` directly is.
   */
  diagnostics?: Diagnostics;
}

/** One file, once the imports have been walked: what every step below reads. */
interface Pass {
  document: Document;
  args: RunFileArgs;
  resolved: ResolvedImports | undefined;
  /** Undefined where the host has no way to read a neighbour. */
  graph: ImportGraph | undefined;
  /** The channel the reporters read, problems and all. */
  stream: ProblemStream;
}

/**
 * Parse and run a `.vn` source with the full stdlib loaded.
 *
 * The HttpClient, HttpServer and Console ports take injected implementations
 * (real in the CLI, fakes in tests); every other port takes the binding
 * `@venn-lang/stdlib` supplies.
 *
 * @param args - The source and its uri, the host and the ports, and how to run
 * it: the filter, the mode, the environment, the module and package loaders.
 * @returns The problems and, when anything ran, the run's result. A failing
 * flow is a `Problem` here, not an exception.
 * @throws Whatever an action or a loaded module let escape the runner.
 */
export async function runFile(args: RunFileArgs): Promise<RunFileOutcome> {
  const stream = problemStream({ sink: args.sink, host: args.host });
  try {
    return await passOver(stream, args);
  } finally {
    // Nothing may follow `run.finished`, and a decorator that refused the
    // program is only known once the runner has handed the result back, so the
    // ending waits here until the file has nothing left to say.
    stream.close();
  }
}

/** Parse, refuse, run: the file's own steps, all of them on the one stream. */
async function passOver(stream: ProblemStream, args: RunFileArgs): Promise<RunFileOutcome> {
  const { ast, problems } = parse(args.source, { uri: args.uri });
  if (problems.length > 0) return said({ args, stream, problems });
  const resolved = args.io
    ? await resolveImports({ document: ast, uri: args.uri, io: args.io, npm: args.npm })
    : undefined;
  const pass: Pass = { document: ast, args, resolved, stream, graph: graphOf(args, resolved) };
  const found = said({ args, stream, problems: await foundBefore(pass) });
  if (refuses(found.problems)) return found;
  const result = await execute(pass);
  // The result carries its own problems, a decorator that refused the program
  // among them, so both travel back together rather than one replacing the other.
  const late = said({ args, stream, problems: result.problems ?? [] });
  return { problems: [...found.problems, ...late.problems], result };
}

/**
 * Everything found, in the outcome, and on the stream in front of the run.
 *
 * What goes on the stream depends on who is reading it. `venn test` has a
 * reporter and a machine-readable document to fill, and a `failure` envelope is
 * what that document counts, so it is given the errors and nothing else: an
 * untidy import is not a failing test. `venn run` has no reporter at all, only
 * the sink that reads a failure out loud, so it is given the whole list and a
 * person sees every problem in one piece, in reading order, before the program
 * it belongs to starts printing.
 */
function said(args: {
  args: RunFileArgs;
  stream: ProblemStream;
  problems: Problem[];
}): RunFileOutcome {
  const script = args.args.mode === "script";
  args.stream.say(script ? args.problems : args.problems.filter(isError));
  return { problems: args.problems };
}

/**
 * What the front end found, before anything runs.
 *
 * Every pass, which for a long time was neither every nor any. `venn check` ran
 * the document check and `venn run` did not, so a lint was something you only
 * met if you happened to ask twice; then `venn check` grew type checking and
 * this did not follow, so a declared `: number` holding a string ran clean and
 * printed the string. Both because the list of what to check lived in two
 * functions in two files. There is one now.
 *
 * Every severity, and only an error stops the file. A warning or a hint used to
 * be dropped here and printed by `venn check`, so a program ran clean and failed
 * the check, which is two compilers wearing one name. Whoever prints this list
 * decides how loud to be about it; nobody decides whether it exists.
 */
async function foundBefore(pass: Pass): Promise<Problem[]> {
  const front = createFrontEnd({ plugins: allPlugins, caps: pass.args.host.caps });
  const analysis = front.analyze(await inputsFor(pass));
  const list = pass.args.diagnostics ?? createDiagnostics();
  return list.unsaid(analysis.problems);
}

/** What this run knows about the world outside the file. */
async function inputsFor(pass: Pass): Promise<AnalyzeArgs> {
  const { args, resolved } = pass;
  return {
    document: pass.document,
    uri: args.uri,
    graph: pass.graph ?? NOTHING_IMPORTED,
    decos: resolved?.decos ?? new Map(),
    fragments: reachable(pass),
    env: args.declared,
    // The same derived types `venn check` reads. Hardcoding an empty map here
    // was the last place the two commands still checked different worlds: a
    // name imported from an installed package was type-checked by `check` and
    // by the editor, and not by the command that ran it.
    packages: await packageTypesFor({ document: pass.document, root: args.root }),
    unreadable: resolved?.unreadable ?? [],
    cycles: resolved?.cycles ?? [],
  };
}

function graphOf(
  args: RunFileArgs,
  resolved: ResolvedImports | undefined,
): ImportGraph | undefined {
  if (!args.io || !resolved) return undefined;
  return { modules: resolved.modules, resolve: args.io.resolve, npm: resolved.npm };
}

function execute(pass: Pass): Promise<RunResult> {
  const { args, resolved } = pass;
  const runner = createRunner({
    host: args.host,
    plugins: allPlugins,
    sink: pass.stream.sink,
    ports: bindings(args),
    uri: args.uri,
    filter: args.filter,
    bail: args.bail,
    env: args.env,
    moduleFragments: resolved?.fragments,
    modules: pass.graph,
    moduleDecos: resolved?.decos,
    cleanup: args.cleanup,
  });
  return args.mode === "script" ? runner.script(pass.document) : runner.run(pass.document);
}

function bindings(args: RunFileArgs) {
  const console = args.console ? [{ port: ConsolePort, impl: args.console }] : [];
  // After the stdlib: the last binding wins, and these are the real ones.
  return [
    { port: HttpClientPort, impl: args.httpClient },
    ...stdlibPortBindings,
    { port: HttpServerPort, impl: args.httpServer ?? createNodeServer() },
    ...console,
  ];
}

/** Every fragment this file can call: its own, and the ones it imported. */
function reachable(pass: Pass): Set<string> {
  const own = collectFragments(pass.document).keys();
  return new Set([...own, ...(pass.resolved?.fragments.keys() ?? [])]);
}
