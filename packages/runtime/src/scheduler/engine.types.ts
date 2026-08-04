import type { Clock, LockProvider } from "@venn-lang/contracts";
import type { FragmentDecl } from "@venn-lang/core";
import type { ActionContext, PluginDefinition } from "@venn-lang/sdk";
import type { CancelScope } from "../cancel/index.js";
import type { Emitter } from "../emit/index.js";
import type { Registry } from "../registry/index.js";
import type { Scope } from "../scope/index.js";
import type { ImportGraph } from "./bind-imports.js";
import type { CleanupSink } from "./cleanup.types.js";
import type { RunFilter } from "./filter.types.js";
import type { FlakyTally } from "./flaky.types.js";
import type { Tally } from "./tally.types.js";

/** Mutable pass/fail tally accumulated across a run. */
export interface RunCounters {
  passed: number;
  failed: number;
}

/** The shared state every `run-*` step reads from. */
export interface Engine {
  registry: Registry;
  /** What this run loaded, so a flow can give each plugin its state back. */
  plugins?: readonly PluginDefinition[];
  emitter: Emitter;
  ctx: ActionContext;
  clock: Clock;
  lock: LockProvider;
  uri: string;
  result: RunCounters;
  fragments: Map<string, FragmentDecl>;
  /**
   * Where a fragment that came from another file reads from: that file's scope.
   *
   * One written in this file needs no entry, since the scope it is run from
   * already has this file at the top of its chain.
   */
  homes?: ReadonlyMap<FragmentDecl, Scope>;
  /**
   * How to reach what the imported files published: their modules, and how a
   * specifier names one. Absent when nothing was imported, which is most runs.
   */
  imports?: ImportGraph;
  /** `use "…" as h` aliases, mapped to the namespace each package contributes. */
  aliases: ReadonlyMap<string, string>;
  /** `@flaky(ratio)` tallies per annotated node, settled at the end of the run. */
  flaky: Map<object, FlakyTally>;
  /**
   * How this part of the run ends: its own cancellation, and every one above it.
   *
   * Set by `@timeout`, `race` and `parallel`, composed rather than replaced at
   * each level, and read at every statement boundary and every loop back edge.
   * Absent on the cleanup path, where a `defer` has to reach the world it is
   * giving back even though what it tidies was cancelled.
   */
  cancel?: CancelScope;
  /**
   * What this frame is answerable for: its failures, and every frame above it.
   *
   * Composed rather than replaced at each level, exactly as `cancel` is, and
   * for the same reason: `result` is one number shared by reference with every
   * concurrent branch, so a frame that read it differentially read a sibling's
   * failure as its own. Absent at the root, where the run's total is the answer.
   */
  tally?: Tally;
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
