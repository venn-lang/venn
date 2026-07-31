import type { AstNode } from "@venn-lang/core";
import { CODES, isUseDecl, type Problem, type UseDecl } from "@venn-lang/core";
import type { CheckContext } from "./check.types.js";
import { problemAt } from "./problem-at.js";

/**
 * `use` was removed in favour of `import`.
 *
 * It brought a package in and put whatever that package chose into scope, under
 * whatever name the package chose. Everything else in the language arrives by a
 * name the file wrote, which is what makes the top of a file the answer to where
 * something came from, and one keyword for that is one keyword.
 */
export function checkUse(node: AstNode, ctx: CheckContext): Problem[] {
  if (!isUseDecl(node)) return [];
  const title = "`use` was removed: write `import` for what the package publishes.";
  return [
    { ...problemAt(node, ctx, CODES.VN5001_REMOVED_KEYWORD, title), help: instead(node, ctx) },
  ];
}

/** The line to write instead, with the name this package publishes. */
function instead(node: UseDecl, ctx: CheckContext): string {
  const namespace = ctx.registry.namespaceOf(node.pkg);
  if (!namespace) return `Write \`import { … } from "${node.pkg}"\` for the names you want.`;
  const named = node.alias ? `${namespace} as ${node.alias}` : namespace;
  return `Write \`import { ${named} } from "${node.pkg}"\`.`;
}
