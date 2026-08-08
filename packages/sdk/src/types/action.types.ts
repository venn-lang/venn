import type { FnSpec, TypeSpec } from "@venn-lang/types";
import type { ZodType, z } from "zod";
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
  /**
   * That this verb reaches nothing, whatever its plugin had to ask the host for.
   *
   * A capability is declared per plugin, which is the right grain for load-time
   * negotiation and too coarse to describe one verb: `date.now` reads the clock
   * while `date.format` writes out a moment it was handed, and `math.randomInt`
   * draws while `math.sqrt` computes. Reading the plugin's answer onto both of
   * each pair overstates the second one.
   *
   * So this is the exception, not the rule. Absent means the verb inherits its
   * plugin's answer, which is what keeps the default honest: a plugin author who
   * says nothing never claims more than they checked.
   *
   * `true` is the only value. "Not pure" has one spelling, which is leaving this
   * out, so there is no second way to say it and no way to say it by accident.
   *
   * It is checked rather than trusted. `requires` was a promise nobody verified
   * and was silently wrong in four plugins; this is the same shape with a worse
   * failure direction, since an over-claimed `pure` is a declaration that lies
   * about the verb it sits on. `a-verb-may-claim-purity.test.ts` in `@venn-lang/stdlib` drives
   * every verb and refuses any that claims this while asking for a port.
   */
  pure?: true;
  run(ctx: ActionContext, input: ActionInput<unknown>): unknown | Promise<unknown>;
}

/**
 * What an author writes, as opposed to the erased form the registry stores.
 *
 * The difference is `params`: an author's schema types the options map that
 * reaches `run`, and {@link ActionDefinition} keeps only the schema itself,
 * because the registry has no use for the inferred type. `result` and `args` are
 * here and not there for the same reason: `defineAction` folds them into the one
 * `signature` the checker reads, so an author says what a verb takes exactly once.
 *
 * It lives beside the definition rather than inline in `defineAction`, because it
 * is the shape every plugin in and out of this repository writes against.
 */
export interface ActionSpec<S extends ZodType = ZodType> {
  name: string;
  doc?: string;
  params?: S;
  /** The positional arguments, in order: `http.on server handler`. */
  args?: readonly ArgSpec[];
  /** What the call evaluates to. The editor renders it, so there is no prose twin. */
  result?: TypeSpec;
  /** The whole type, for a shape `args` cannot describe. Wins when given. */
  signature?: FnSpec;
  /**
   * That this verb touches nothing, so a `fn` may call it.
   *
   * See {@link ActionDefinition.pure}: absent inherits the plugin's answer, `true`
   * is the only value, and a verb claiming it while asking for a port is refused
   * by the stdlib guard rather than believed.
   */
  pure?: true;
  run(ctx: ActionContext, input: ActionInput<z.infer<S>>): unknown | Promise<unknown>;
}
