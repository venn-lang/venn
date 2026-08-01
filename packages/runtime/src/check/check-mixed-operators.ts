import {
  type AstNode,
  type Binary,
  buildProblem,
  CODES,
  isBinary,
  type Problem,
} from "@venn-lang/core";
import { nodeSource, nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/** The operator that touched `??`, and whether it was written before it. */
interface Mixed {
  readonly operator: string;
  readonly onTheLeft: boolean;
}

/**
 * `??` written next to `||` or `&&` without brackets.
 *
 * `a || b ?? c` reads as `(a || b) ?? c` and `a ?? b || c` as `a ?? (b || c)`,
 * which are different answers to a line that looks the same. The two ask
 * different questions, one about nothing and one about truth, so there is no
 * precedence a reader would call obvious, and the one the grammar has is not
 * worth guessing at.
 *
 * Refused rather than ranked, which is where JavaScript arrived for the same
 * pair after the same argument.
 */
export function checkMixedOperators(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isBinary(node) || node.operator !== "??") return [];
  const mixed = unsettled(node);
  if (!mixed) return [];
  return [
    {
      ...buildProblem({
        spec: CODES.VN1003_MIXED_OPERATORS,
        span: nodeSpan(node, ctx.uri),
        title: `\`??\` and \`${mixed.operator}\` ask different questions, so which comes first has to be written.`,
      }),
      help: advice(mixed),
    },
  ];
}

/** The side that mixes, unless the writer already settled the order. */
function unsettled(node: Binary): Mixed | undefined {
  const left = logicalSide(node.left);
  if (left && !bracketed(node.left)) return { operator: left, onTheLeft: true };
  const right = logicalSide(node.right);
  if (right && !bracketed(node.right)) return { operator: right, onTheLeft: false };
  return undefined;
}

/**
 * Whether this side was written in brackets.
 *
 * The tree does not keep them: `(a || b) ?? c` and `a || b ?? c` are the same
 * nodes, which is the whole reason one of them needs saying. What does keep
 * them is the source the node came from, which still reads `(a || b)`.
 */
function bracketed(side: AstNode): boolean {
  return nodeSource(side).startsWith("(");
}

/** Both readings, written out in the order the line has them. */
function advice(mixed: Mixed): string {
  const op = mixed.operator;
  if (mixed.onTheLeft) return `Bracket one of them: \`(a ${op} b) ?? c\`, or \`a ${op} (b ?? c)\`.`;
  return `Bracket one of them: \`a ?? (b ${op} c)\`, or \`(a ?? b) ${op} c\`.`;
}

/** The operator on this side, when it is one of the two that may not touch `??`. */
function logicalSide(side: Binary["left"]): string | undefined {
  if (!isBinary(side)) return undefined;
  return side.operator === "||" || side.operator === "&&" ? side.operator : undefined;
}
