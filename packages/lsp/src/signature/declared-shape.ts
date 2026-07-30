import {
  type AstNode,
  DYNAMIC,
  isDatasetDecl,
  isFnDecl,
  isFnExpr,
  isFragmentDecl,
  isLetStmt,
  type Param,
  type ParamList,
  showTypes,
} from "@venn-lang/core";
import type { LangiumDocument } from "langium";
import type { TypeService } from "../types/index.js";
import type { CallShape } from "./call-shape.types.js";

export interface DeclaredShapeArgs {
  /** The node that binds the name: what `findBinding` answered. */
  binding: AstNode;
  name: string;
  document: LangiumDocument;
  types: TypeService;
}

/**
 * What a function the file itself declares takes, by name.
 *
 * The names are written right there in the source; the types come from
 * inference, which for an unannotated `fn` means a variable until the body
 * pins it down. A name with `a` next to it still tells the reader which
 * argument they are on, which is the question a half-typed call asks.
 */
/** How the parameter reads back: its name, or the pattern as it was written. */
function writtenName(param: Param): string {
  return param.name ?? param.pattern?.$cstNode?.text ?? "";
}

export function declaredShape(args: DeclaredShapeArgs): CallShape | undefined {
  const params = paramsOf(args.binding);
  if (!params) return undefined;
  const known = args.types.of(args.document).types;
  // Named together, so two unrelated parameters do not both come back as `a`.
  const shown = showTypes(params.params.map((param) => known.get(param) ?? DYNAMIC));
  return {
    target: args.name,
    args: params.params.map((param, at) => ({
      name: writtenName(param),
      type: shown[at] ?? "dynamic",
    })),
    options: [],
    returns: undefined,
  };
}

/** The parameter list, wherever the binding keeps one. */
function paramsOf(binding: AstNode): ParamList | undefined {
  if (isFnDecl(binding) || isFragmentDecl(binding) || isFnExpr(binding)) return binding.params;
  // `const op = (a, b) => a + b`: the parameters belong to the lambda it holds.
  const value = (isLetStmt(binding) || isDatasetDecl(binding)) && binding.value;
  return value && isFnExpr(value) ? value.params : undefined;
}
