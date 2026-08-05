import type { FnSpec, TypeSpec } from "@venn-lang/types";
import type { ZodType } from "zod";
import { signatureOf } from "./schema/arg.js";
import type { ArgSpec } from "./schema/args.types.js";
import type { ActionDefinition, ActionSpec } from "./types/action.types.js";

/**
 * Define an action: a verb in a plugin's namespace. The options map handed to
 * `run` is typed from the Zod schema in `params`.
 *
 * `args` names the positional arguments, which is what the editor shows while a
 * call is still half-written. The `signature` the checker reads is derived from
 * them, so an author says what the verb takes exactly once.
 *
 * @param def Name, docs, params schema, argument names, result type and `run`.
 * See {@link ActionSpec} for the whole shape, field by field.
 * @returns The definition object, with `signature` filled in when it can be
 * derived and left absent otherwise.
 */
export function defineAction<S extends ZodType = ZodType>(def: ActionSpec<S>): ActionDefinition {
  return { ...def, signature: def.signature ?? derive(def) } as unknown as ActionDefinition;
}

function derive(def: { args?: readonly ArgSpec[]; result?: TypeSpec }): FnSpec | undefined {
  if (!def.args && !def.result) return undefined;
  return signatureOf(def.args ?? [], def.result);
}
