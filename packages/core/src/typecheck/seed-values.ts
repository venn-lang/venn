import type { AstNode } from "langium";
import type { DecoDecl, Document, LetStmt } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { TypeCatalog } from "./catalog.types.js";
import { createContext } from "./context.js";
import type { Infer, Slot } from "./infer.js";
import { collectNamedTypes } from "./named-types.js";
import type { SeedRun } from "./seed-params.js";
import { solidify } from "./solidify.js";
import type { Type } from "./type.types.js";

/** What the file's own top-level values turned out to be, by the name they carry. */
export type ValueSeeds = ReadonlyMap<string, Type>;

/**
 * A first pass, in silence: what the file's top-level `const`s and `let`s hold.
 *
 * A named `fn` is checked before those bindings exist, because generalising it
 * is what lets two callers use it at two types, and a binding written above it
 * may call it. So the file's values cannot simply be bound first. A function
 * body is still free to read them, since it runs later when they are all there,
 * and this pass is what gives those reads a type.
 *
 * Unlike the parameter seeds, a conflict elsewhere does not throw the answers
 * away. A value's type is written in the file, not guessed from a caller, and a
 * half-typed line somewhere else is the normal state of a file being edited:
 * exactly when the help is worth most.
 */
export function seedValues(args: {
  document: Document;
  catalog?: TypeCatalog;
  decos?: ReadonlyMap<string, DecoDecl>;
  parsed?: Map<AstNode, Slot[]>;
  run: SeedRun;
}): ValueSeeds {
  const values = topLevelValues(args.document);
  if (values.length === 0 || !args.document.decls.some(ast.isFnDecl)) return new Map();
  const ctx = createContext();
  const infer: Infer = {
    ctx,
    named: collectNamedTypes(args.document, ctx, args.catalog),
    catalog: args.catalog,
    decos: args.decos,
    parsed: args.parsed,
    types: new Map(),
    seeding: true,
  };
  args.run(args.document, infer);
  return settled(values, infer);
}

function topLevelValues(document: Document): LetStmt[] {
  return document.decls.filter(ast.isLetStmt);
}

function settled(values: readonly LetStmt[], infer: Infer): ValueSeeds {
  const seeds = new Map<string, Type>();
  for (const decl of values) {
    const found = infer.types?.get(decl);
    const solid = found && solidify(found);
    if (solid) seeds.set(decl.name, solid);
  }
  return seeds;
}
