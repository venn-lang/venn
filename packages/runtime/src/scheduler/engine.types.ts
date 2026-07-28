import type { Clock, LockProvider } from "@venn/contracts";
import type { FragmentDecl } from "@venn/core";
import type { ActionContext } from "@venn/sdk";
import type { Emitter } from "../emit/index.js";
import type { Registry } from "../registry/index.js";
import type { ImportGraph } from "./bind-imports.js";
import type { CleanupSink } from "./cleanup.types.js";
import type { RunFilter } from "./filter.types.js";
import type { FlakyTally } from "./flaky.types.js";

/** Mutable pass/fail tally accumulated across a run. */
export interface RunCounters {
  passed: number;
  failed: number;
}

/** The shared state every `run-*` step reads from. */
export interface Engine {
  registry: Registry;
  emitter: Emitter;
  ctx: ActionContext;
  clock: Clock;
  lock: LockProvider;
  uri: string;
  result: RunCounters;
  fragments: Map<string, FragmentDecl>;
  /**
   * How to reach what the imported files published: their modules, and how a
   * specifier names one. Absent when nothing was imported, which is most runs.
   */
  imports?: ImportGraph;
  /** `use "…" as h` aliases, mapped to the namespace each package contributes. */
  aliases: ReadonlyMap<string, string>;
  /** `@flaky(ratio)` tallies per annotated node, settled at the end of the run. */
  flaky: Map<object, FlakyTally>;
  /** Set on a `race` branch: once aborted, the branch stops at its next statement. */
  signal?: AbortSignal;
  /** What a script-mode program owes the machine when it ends. */
  cleanup: CleanupSink;
  env: Record<string, unknown>;
  /** Which flows and steps to include (`--tags`, `--flow`, `--step`). */
  filter: RunFilter;
  /** Stop after the first flow that fails. */
  bail?: boolean;
  /**
   * The code an `exit` asked to leave with, unset until one runs. Read by the
   * host: `exit 0` ends a run cleanly however many flows were left.
   */
  exit?: number;
}
