/**
 * `==` and `!=` between two lists, or between two maps.
 *
 * The operator asks whether the two are the same value, so two lists holding the
 * same items are never equal by it. That rule is defensible; a line that reads
 * as an assertion, fails, and prints a diff explaining none of it is not. The
 * matcher `equals` is the structural comparison, and is what such a line meant.
 */

import type { AstNode } from "langium";
import { CODES } from "../codes/index.js";
import type { TypeMismatch } from "./context.js";
import type { Type } from "./type.types.js";
import { prune } from "./unify.js";

/** The kinds compared by identity, under the word the language uses for each. */
const CONTAINERS: Readonly<Record<string, string>> = { list: "lists", record: "maps" };

/**
 * The lint for comparing two containers by identity.
 *
 * @param args The operator as written, the node to report it on, and the types
 * of both sides.
 * @returns The mismatch to report, or nothing when the comparison is an ordinary
 * one: anything but two containers of the same kind, which includes every `x ==
 * null` guard, since nothing that may be nothing is a list or a map.
 */
export function identityComparison(args: {
  node: AstNode;
  op: string;
  left: Type;
  right: Type;
}): TypeMismatch | undefined {
  const { node, op, left, right } = args;
  if (op !== "==" && op !== "!=") return undefined;
  const what = sameContainer(prune(left), prune(right));
  if (!what) return undefined;
  return {
    node,
    expected: left,
    actual: right,
    code: CODES.VN5006_IDENTITY_COMPARISON,
    sentence: `\`${op}\` compares two ${what} by identity, not by what is in them.`,
    help: "Compare the contents with the matcher `equals`.",
  };
}

/** What both sides are, when they are both the same kind of container. */
function sameContainer(left: Type, right: Type): string | undefined {
  return left.kind === right.kind ? CONTAINERS[left.kind] : undefined;
}
