import type { Param } from "../generated/ast.js";
// Type-only, so the cycle with `infer.ts` is erased at build.
import type { Infer } from "./infer.js";
import { DYNAMIC, type Type } from "./type.types.js";
import { typeRefToType } from "./type-ref.js";

/**
 * What a parameter says it takes, or `dynamic` where it says nothing.
 *
 * Read in two places: inside the body, where the parameter is a name in scope,
 * and at the call, where an argument is checked against it. One reading, so the
 * body and the caller can never be told different things.
 */
export function paramType(param: Param, infer: Infer): Type {
  const { ctx, named, catalog } = infer;
  return param.paramType ? typeRefToType({ ref: param.paramType, ctx, named, catalog }) : DYNAMIC;
}
