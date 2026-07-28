/** Where dropping the suffix would be wrong, because the user's word differs. */
const KINDS: Record<string, string> = {
  LetStmt: "Binding",
  CaptureStmt: "Binding",
};

/**
 * The user's word for a node type.
 *
 * `targets: ["FlowDecl"]` is the compiler talking to itself. A decorator says
 * it decorates a `Flow`, and that is the only spelling the editor shows.
 */
export function kindOf(type: string): string {
  return KINDS[type] ?? type.replace(/(Decl|Stmt|Expr)$/, "");
}
