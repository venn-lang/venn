import {
  type Declaration,
  isConfigDecl,
  isDecoDecl,
  isFlowDecl,
  isFnDecl,
  isFragmentDecl,
  isLifecycleDecl,
  isMatrixDecl,
  isTypeDecl,
  type Statement,
} from "../generated/ast.js";

/**
 * Whether a top-level node runs, or merely defines.
 *
 * A `flow`, a `fn`, a `type` are definitions: they exist for something else to
 * reach. Everything else at the top of a file is a statement, and statements
 * run in the order they are written. That holds in a script, where the file is
 * the program, and in a test file, so the same lines mean the same thing in
 * both.
 */
export function isRunnable(node: Declaration): node is Declaration & Statement {
  return !(
    isFlowDecl(node) ||
    isFnDecl(node) ||
    isFragmentDecl(node) ||
    isTypeDecl(node) ||
    isConfigDecl(node) ||
    isMatrixDecl(node) ||
    isDecoDecl(node) ||
    isLifecycleDecl(node)
  );
}
