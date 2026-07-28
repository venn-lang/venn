import type { FnSpec } from "@venn/types";
import type { ZodType } from "zod";
import type { ArgSpec } from "../schema/args.types.js";
import type { ActionContext, ActionInput } from "./context.types.js";

/**
 * A verb in a namespace (e.g. `http.get`). One definition feeds the runtime, the
 * LSP and the node graph. The registry stores this erased form; authors get typed
 * params from `defineAction`.
 */
export interface ActionDefinition {
  name: string;
  doc?: string;
  params?: ZodType;
  /**
   * The positional arguments, named. This is what the editor can show while the
   * call is still half-written, since a type alone says how many, never which.
   */
  args?: readonly ArgSpec[];
  /**
   * What this verb takes and gives back, as data the checker can act on.
   *
   * Its parameters are the **positional** arguments only: `http.get "url"` has
   * one. The trailing options map is described by the Zod schema above, which is
   * what checks its keys; listing it here would describe an argument the caller
   * never passes in that position.
   *
   * Absent means the call stays `dynamic`. A plugin that says nothing about
   * types is still a working plugin.
   */
  signature?: FnSpec;
  run(ctx: ActionContext, input: ActionInput<unknown>): unknown | Promise<unknown>;
}
