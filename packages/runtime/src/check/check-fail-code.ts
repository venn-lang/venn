import {
  type ActionCall,
  type AstNode,
  beginsWithVN,
  buildProblem,
  CODES,
  isActionCall,
  isMapLit,
  isStringLit,
  NAME_IT_AFTER_WHAT_HAPPENED,
  type Problem,
  reservedCodeTitle,
} from "@venn-lang/core";
import { nodeSpan } from "../scheduler/index.js";
import type { CheckContext } from "./check.types.js";

/**
 * `fail "…" { code: "VNxxxx" }`, claiming a code the language owns.
 *
 * Every `VNxxxx` is catalogued, documented and searchable, so a program raising
 * one to mean its own thing is a program whose failures cannot be told from the
 * ones the language raises. What a program calls its own is otherwise its own
 * business: no registry, and no range to claim.
 *
 * Only a code written out is caught here. One computed is refused where it is
 * raised, which is the same refusal a beat later, in the same words: the
 * predicate and both sentences come from `failError`'s own module, so a code the
 * checker lets past cannot be one the raiser would have refused.
 */
export function checkFailCode(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isActionCall(node) || node.target !== "fail") return [];
  const written = writtenCode(node);
  if (!written || !beginsWithVN(written.value)) return [];
  return [
    {
      ...buildProblem({
        spec: CODES.VN3022_RESERVED_CODE,
        span: nodeSpan(written.node, ctx.uri),
        title: reservedCodeTitle(written.value),
      }),
      help: NAME_IT_AFTER_WHAT_HAPPENED,
    },
  ];
}

/** The `code:` this `fail` was written with, when it was written out. */
function writtenCode(node: ActionCall): { node: AstNode; value: string } | undefined {
  if (!isMapLit(node.opts)) return undefined;
  const entry = node.opts.entries.find((one) => one.key === "code");
  const value = entry?.value;
  return value && isStringLit(value) ? { node: value, value: value.value } : undefined;
}
