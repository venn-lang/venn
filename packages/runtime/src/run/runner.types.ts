import type { Host } from "@venn-lang/contracts";
import type { Document, FragmentDecl, ImportedDeco, Problem, RunId } from "@venn-lang/core";
import type { PluginDefinition } from "@venn-lang/sdk";
import type { EventSink } from "../eventsink/index.js";
import type { PortBinding, PortResolver } from "../ports/index.js";
import type { Registry } from "../registry/index.js";
import type { CleanupSink, ImportGraph, RunFilter } from "../scheduler/index.js";

/** What one run reports back to the host that asked for it. */
export interface RunResult {
  run: RunId;
  /** What the decorators refused before a statement ran. */
  problems?: Problem[];
  passed: number;
  failed: number;
  /**
   * What `exit` asked the host to end with, absent if nothing called it. It
   * overrides the tally on purpose: `exit 0` is a clean ending, `exit 3` is a
   * failure the program named itself.
   */
  exitCode?: number;
}

/** The level-2 embedding API (§18): a host owns the process and drives runs. */
export interface Runner {
  /** Test mode: collect and run every `flow`, reporting each. */
  run(document: Document): Promise<RunResult>;
  /** Script mode: execute the file's top-level statements, top to bottom. */
  script(document: Document): Promise<RunResult>;
}

/** Everything {@link Runner} needs, settled once and reused for every run. */
export interface RunnerArgs {
  host: Host;
  plugins: readonly PluginDefinition[];
  sink: EventSink;
  ports?: readonly PortBinding[];
  uri?: string;
  /** Which flows and steps to include (`--tags`, `--flow`, `--step`). */
  filter?: RunFilter;
  /** Stop after the first flow that fails. */
  bail?: boolean;
  env?: Record<string, unknown>;
  moduleFragments?: Map<string, FragmentDecl>;
  /**
   * The files the import graph reached, so a `pub fn` can be called with the
   * module it was written in around it. Without this the name resolves and the
   * call fails on its first line.
   */
  modules?: ImportGraph;
  /** The `pub deco`s the imported files exported, so `@name` resolves across a file. */
  moduleDecos?: Map<string, ImportedDeco>;
  /**
   * Where a script-mode program registers what it opened. The host owns when a
   * program ends, so the host owns this list; without one the run keeps its own
   * and nothing closes until the process does.
   */
  cleanup?: CleanupSink;
}

/** What one `run(document)` needs: the runner's args plus the once-built services. */
export interface RunOnceInput {
  args: RunnerArgs;
  registry: Registry;
  resolver: PortResolver;
  document: Document;
}
