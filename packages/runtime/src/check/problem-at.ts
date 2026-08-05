import { type AstNode, buildProblem, type CODES, type Problem } from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * One problem on a node, with the uri every check reports against.
 *
 * Four copies of this used to live beside the checks that raise them, and being
 * private is how they drifted: one took `{ entry, uri }` instead of a context,
 * and one widened `spec` to `CodeSpec`, which let a check raise a code the
 * catalogue never listed.
 *
 * @param args The node the squiggle goes on, the context holding the file, the
 * catalogue entry naming the code and severity, and the sentence to say.
 * @returns The problem, placed at the node, `${…}` included.
 */
export function problemAt(args: {
  node: AstNode;
  ctx: CheckContext;
  spec: (typeof CODES)[keyof typeof CODES];
  title: string;
}): Problem {
  return buildProblem({
    spec: args.spec,
    span: nodeSpan(args.node, args.ctx.uri),
    title: args.title,
  });
}
