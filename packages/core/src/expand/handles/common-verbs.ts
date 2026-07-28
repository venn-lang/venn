import type { AstNode } from "langium";
import { nativeFn } from "../../expr/index.js";
import { writeMeta } from "../node-meta.js";
import { swapNode } from "../swap-node.js";
import type { VerbTable } from "./handle.types.js";

/**
 * What every kind answers to: what it is called, what it carries, and leaving.
 *
 * `meta` is how a decorator says something the grammar has no word for, the same
 * channel `@retry(2)` uses, so a `deco` written in the language reaches exactly
 * what a plugin's TypeScript decorator reaches.
 */
export const COMMON_VERBS: VerbTable = {
  props: { name: (node) => nameOf(node) },
  calls: {
    meta: (node) =>
      nativeFn((args) => {
        writeMeta(node, String(args[0]), args[1]);
        return null;
      }),
    remove: (node) =>
      nativeFn(() => {
        swapNode(node, undefined);
        return null;
      }),
  },
};

/**
 * A flow or a step has a title rather than a name, and answers with it.
 *
 * Empty for the things that have neither. `$type` would answer, but with a word
 * out of the compiler's own tree: the one vocabulary this whole surface exists
 * to keep out of the language.
 */
function nameOf(node: AstNode): string {
  const named = node as { name?: string; title?: string };
  return named.name ?? named.title ?? "";
}
