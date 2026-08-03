import type { ArgSpec } from "@venn-lang/sdk";
import type { Arity } from "./arity.types.js";

/**
 * What a declaration says about how many arguments it takes.
 *
 * A verb that declares nothing is not policed: plugins are allowed to say
 * nothing about their shape, and refusing a call against a declaration that
 * does not exist would refuse every such plugin.
 *
 * @param args The declared positional arguments, in order.
 * @returns The range of counts the declaration accepts, or `undefined` when it
 * declares none.
 */
export function arityOf(args: readonly ArgSpec[] | undefined): Arity | undefined {
  if (!args || args.length === 0) return undefined;
  const rest = args.some((one) => one.rest);
  const least = args.filter((one) => !one.optional && !one.rest).length;
  return { least, most: rest ? Number.POSITIVE_INFINITY : args.length };
}

/** How the refusal says it, in the counts a reader can act on. */
export function tooManyOrFew(args: { name: string; arity: Arity; given: number }): string {
  const { name, arity, given } = args;
  if (given < arity.least) return `\`${name}\` needs ${counted(arity.least)}, and got ${given}.`;
  return `\`${name}\` takes ${wanted(arity)}, and got ${given}.`;
}

function wanted(arity: Arity): string {
  if (arity.least === arity.most) return counted(arity.most);
  return `at most ${counted(arity.most)}`;
}

function counted(many: number): string {
  return many === 1 ? "1 argument" : `${many} arguments`;
}
