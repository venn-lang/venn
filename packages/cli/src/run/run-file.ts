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
  /** Where the program registers what it opened, so the host can close it. */
  cleanup?: CleanupSink;
  /** "test" runs the flows; "script" executes the file top to bottom. */
  mode?: "test" | "script";
}

/** One file, once the imports have been walked: what every step below reads. */
interface Pass {
  document: Document;
  args: RunFileArgs;
  resolved: ResolvedImports | undefined;
  /** Undefined where the host has no way to read a neighbour. */
  graph: ImportGraph | undefined;
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
  const { ast, problems } = parse(args.source, { uri: args.uri });
  if (problems.length > 0) return { problems };
  const resolved = args.io
    ? await resolveImports({ document: ast, uri: args.uri, io: args.io, npm: args.npm })
    : undefined;
  const pass: Pass = { document: ast, args, resolved, graph: graphOf(args, resolved) };
  const refused = refusedBefore(pass);
  if (refused.length > 0) return { problems: refused };
  const result = await execute(pass);
  // The result carries its own problems, a decorator that refused the program
  // among them, so both travel back together rather than one replacing the other.
  return { problems: result.problems ?? [], result };
}

/**
 * What the front end refuses, before anything runs.
 *
 * Every pass, which for a long time was neither every nor any. `venn check` ran
 * the document check and `venn run` did not, so a lint was something you only
 * met if you happened to ask twice; then `venn check` grew type checking and
 * this did not follow, so a declared `: number` holding a string ran clean and
 * printed the string. Both because the list of what to check lived in two
 * functions in two files. There is one now.
 *
 * Errors only. A warning or a hint is `venn check`'s business: a run already
 * stops for a parse error and for an import that names nothing, and printing an
 * untidy import on every run would teach people to stop reading them.
 */
function refusedBefore(pass: Pass): Problem[] {
  const front = createFrontEnd({ plugins: allPlugins, caps: pass.args.host.caps });
  return front.analyze(inputsFor(pass)).problems.filter((one) => one.severity === "error");
}

/** What this run knows about the world outside the file. */
function inputsFor(pass: Pass): AnalyzeArgs {
  const { args, resolved } = pass;
  return {
    document: pass.document,
    uri: args.uri,
    graph: pass.graph ?? NOTHING_IMPORTED,
    decos: resolved?.decos ?? new Map(),
    fragments: reachable(pass),
    env: args.declared,
    // Nothing yet: what an installed package publishes is read from `target/`,
    // which `venn check` does and a run has never needed.
    packages: new Map(),
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
    sink: args.sink,
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
