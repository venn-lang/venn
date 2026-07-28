import type { TypeSpec } from "@venn-lang/types";
import ts from "tsc-api";
import { type Conversion, toSpec } from "./to-spec.js";

/**
 * A callable, as the language writes one.
 *
 * The first signature only. An overloaded function has several and the language
 * has one shape for a function; the first is what TypeScript itself shows on
 * hover, so a reader sees the same thing in both editors rather than two
 * different half-truths.
 */
export function fnSpec(signature: ts.Signature, conv: Conversion): TypeSpec {
  const params = signature.getParameters().map((param) => paramSpec(param, conv));
  const result = toSpec(conv.checker.getReturnTypeOfSignature(signature), conv);
  // Optional parameters are ordinary in TypeScript and this language checks
  // arity exactly, so `takes` is what keeps a call with no arguments legal
  // against a signature whose only parameter is optional, as in `z.string()`.
  return { kind: "fn", params, result, takes: requiredCount(signature) };
}

/**
 * How many arguments the caller must actually pass.
 *
 * Read from the declarations rather than from the checker's own count, which is
 * not part of its public surface. A parameter stops being required once it
 * carries a `?`, a default or a `...`, and so does everything after it.
 */
function requiredCount(signature: ts.Signature): number {
  const params = signature.getParameters();
  let required = 0;
  for (const param of params) {
    if (isOptional(param)) break;
    required++;
  }
  return required;
}

function isOptional(param: ts.Symbol): boolean {
  const decl = param.valueDeclaration ?? param.declarations?.[0];
  if (!decl || !ts.isParameter(decl)) return false;
  return Boolean(decl.questionToken ?? decl.initializer ?? decl.dotDotDotToken);
}

function paramSpec(param: ts.Symbol, conv: Conversion): TypeSpec {
  const decl = param.valueDeclaration ?? param.declarations?.[0];
  if (!decl) return { kind: "dynamic" };
  return toSpec(conv.checker.getTypeOfSymbolAtLocation(param, decl), conv);
}

/**
 * An object, as a record of what it holds.
 *
 * A method is a field whose type is a function, which is what it is in this
 * language too. So `schema.parse` is reached the same way `schema.shape` is,
 * and the reader is not asked to know which of the two the author chose.
 */
export function recordSpec(type: ts.Type, conv: Conversion): TypeSpec {
  const fields: Record<string, TypeSpec> = {};
  for (const property of type.getProperties()) {
    const spec = propertySpec(property, conv);
    if (spec) fields[property.getName()] = spec;
  }
  // Open, because a package's own type is the authority on what it holds and
  // this reading of it is not: anything missed should be reachable, not refused.
  return { kind: "record", fields, open: true };
}

function propertySpec(property: ts.Symbol, conv: Conversion): TypeSpec | undefined {
  const decl = property.valueDeclaration ?? property.declarations?.[0];
  if (!decl) return undefined;
  return toSpec(conv.checker.getTypeOfSymbolAtLocation(property, decl), conv);
}
