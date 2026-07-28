import type { Document } from "../generated/ast.js";
import type { Problem } from "../problem/index.js";

/** The result of {@link parse}: a (possibly partial) AST plus VN1xxx problems. */
export interface ParseOutput {
  ast: Document;
  problems: Problem[];
}
