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
  if (!isActionCall(node) || node.target !== "use" || !looksLikeAUse(node)) return [];
  const title = "`use` was removed: write `import` for what the package publishes.";
  const help = 'Write `import { … } from "…"` for the names you want.';
  return [{ ...problemAt({ node, ctx, spec: CODES.VN5001_REMOVED_KEYWORD, title }), help }];
}

/**
 * What a `use` line looked like, and nothing else: one name and no options.
 *
 * Both spellings it ever had. `use "venn/http"` names the package and `use http`
 * names the namespace, and thirteen READMEs taught the second one, which was
 * reported as an unknown action nobody provides: true, and useless.
 */
function looksLikeAUse(node: ActionCall): boolean {
  const written = node.args[0]?.$type;
  return node.args.length === 1 && !node.opts && (written === "StringLit" || written === "Ref");
}
