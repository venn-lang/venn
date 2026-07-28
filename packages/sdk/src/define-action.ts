import type { FnSpec, TypeSpec } from "@venn/types";
import type { ZodType, z } from "zod";
import { signatureOf } from "./schema/arg.js";
import type { ArgSpec } from "./schema/args.types.js";
import type { ActionDefinition } from "./types/action.types.js";
import type { ActionContext, ActionInput } from "./types/context.types.js";

/**
 * Define an action: a verb in a plugin's namespace. The options map handed to
 * `run` is typed from the Zod schema in `params`.
 *
 * `args` names the positional arguments, which is what the editor shows while a
 * call is still half-written. The `signature` the checker reads is derived from
 * them, so an author says what the verb takes exactly once.
 *
 * @param def Name, docs, params schema, argument names, result type and `run`.
 * @returns The definition object, with `signature` filled in when it can be
 * derived and left absent otherwise.
 */
export function defineAction<S extends ZodType = ZodType>(def: {
  name: string;
  doc?: string;
  params?: S;
  /** The positional arguments, in order: `http.on server handler`. */
  args?: readonly ArgSpec[];
  /** What the call evaluates to. The editor renders it, so there is no prose twin. */
  result?: TypeSpec;
  /** The whole type, for a shape `args` cannot describe. Wins when given. */
  signature?: FnSpec;
  run(ctx: ActionContext, input: ActionInput<z.infer<S>>): unknown | Promise<unknown>;
}): ActionDefinition {
  return { ...def, signature: def.signature ?? derive(def) } as unknown as ActionDefinition;
}

function derive(def: { args?: readonly ArgSpec[]; result?: TypeSpec }): FnSpec | undefined {
  if (!def.args && !def.result) return undefined;
  return signatureOf(def.args ?? [], def.result);
}
