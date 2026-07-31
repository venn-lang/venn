import { type ActionCall, type AstNode, CODES, isActionCall, type Problem } from "@venn-lang/core";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";

/**
 * `use "venn/http"` in a file written before it went.
 *
 * The keyword is gone from the grammar, so the line parses as a call to
 * something named `use` and would be reported as an action nobody provides.
 * That is true and useless. This says what it was and what to write instead.
 */
export function checkRemovedUse(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isActionCall(node) || node.target !== "use" || !onlyAString(node)) return [];
  const title = "`use` was removed: write `import` for what the package publishes.";
  const help = 'Write `import { … } from "…"` for the names you want.';
  return [{ ...problemAt(node, ctx, CODES.VN5001_REMOVED_KEYWORD, title), help }];
}

/** What a `use` line looked like, and nothing else: one string and no options. */
function onlyAString(node: ActionCall): boolean {
  return node.args.length === 1 && node.args[0]?.$type === "StringLit" && !node.opts;
}
