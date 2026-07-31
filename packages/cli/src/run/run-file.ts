import { type Console, ConsolePort, type Host } from "@venn-lang/contracts";
import { type Problem, parse } from "@venn-lang/core";
import { type HttpClient, HttpClientPort, type HttpServer, HttpServerPort } from "@venn-lang/http";
import { createNodeServer } from "@venn-lang/http/node";
import {
  buildRegistry,
  type CleanupSink,
  checkImports,
  createRunner,
  type EventSink,
  type ModuleIo,
  type NpmModules,
  type RunFilter,
  type RunResult,
  resolveImports,
} from "@venn-lang/runtime";
import { allPlugins, stdlibPortBindings } from "@venn-lang/stdlib";

/** What one `.vn` file amounted to. */
export interface RunFileOutcome {
  /** Everything refused or reported. Empty when the file ran clean. */
  problems: Problem[];
  /** Absent when nothing ran: the parse or the imports stopped it first. */
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
  io?: ModuleIo;
  /** How an installed package is loaded, when the host can load one. */
  npm?: NpmModules;
  /** Where the program registers what it opened, so the host can close it. */
  cleanup?: CleanupSink;
  /** "test" runs the flows; "script" executes the file top to bottom. */
  mode?: "test" | "script";
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
  const io = args.io;
  const resolved = io
    ? await resolveImports({ document: ast, uri: args.uri, io, npm: args.npm })
    : undefined;
  const graph =
    resolved && io
      ? { modules: resolved.modules, resolve: io.resolve, npm: resolved.npm }
      : undefined;
  // Refused before anything runs. An import that names something the other file
  // never published would otherwise surface halfway through, as a value that
  // was quietly `undefined` until something called it.
  const registry = buildRegistry({ plugins: allPlugins, caps: args.host.caps });
  const bad = graph ? checkImports({ document: ast, uri: args.uri, graph, registry }) : [];
  if (bad.length > 0) return { problems: bad };
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
    modules: graph,
    moduleDecos: resolved?.decos,
    cleanup: args.cleanup,
  });
  const result = args.mode === "script" ? await runner.script(ast) : await runner.run(ast);
  // The result carries its own problems, a decorator that refused the program
  // among them, so both travel back together rather than one replacing the other.
  return { problems: result.problems ?? [], result };
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
