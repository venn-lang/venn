import type { AstNode } from "langium";
import type { DecoDecl, Document, Param } from "../generated/ast.js";
import * as ast from "../generated/ast.js";
import type { TypeCatalog } from "./catalog.types.js";
import { createContext } from "./context.js";
import type { Infer, Slot } from "./infer.js";
import { collectNamedTypes } from "./named-types.js";
import { solidify } from "./solidify.js";
import type { Type } from "./type.types.js";

/** What the call sites turned out to say about each unwritten parameter. */
export type ParamSeeds = ReadonlyMap<AstNode, Type>;

/** How the checker's two passes are wired, without either importing the other. */
export type SeedRun = (document: Document, infer: Infer) => void;

/**
 * A first pass, in silence: what the callers say the named functions take.
 *
 * A `fn` declared at the top of a file is not written where it is called, so on
 * its own it knows nothing about its parameters. The file does say, though:
 * every call is a statement of what goes in. This pass keeps the functions
 * monomorphic so those calls reach the declaration, reads off whatever got
 * decided, and throws the rest away. The real pass then starts from the answers.
 *
 * Nothing is carried over from a file that did not type-check cleanly: a
 * conflict means the first caller won by accident, and a guess made that way
 * would turn into an error the author never made.
 */
export function seedParams(args: {
  document: Document;
  catalog?: TypeCatalog;
  /** Carried through so this pass draws the same line around a reshaped `fn`;
   * without it one such function's calls would look like a conflict and every
   * seed in the file would be dropped. */
  decos?: ReadonlyMap<string, DecoDecl>;
  parsed?: Map<AstNode, Slot[]>;
  run: SeedRun;
}): ParamSeeds {
  const wanted = unwritten(args.document);
  if (wanted.length === 0) return new Map();
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
  return ctx.mismatches.length > 0 ? new Map() : settled(wanted, infer);
}

/** Every parameter of a top-level `fn` that carries no annotation. */
function unwritten(document: Document): Param[] {
  return document.decls
    .filter(ast.isFnDecl)
    .flatMap((decl) => decl.params?.params ?? [])
    .filter((param) => !param.paramType);
}

function settled(params: readonly Param[], infer: Infer): ParamSeeds {
  const seeds = new Map<AstNode, Type>();
  for (const param of params) {
    const found = infer.types?.get(param);
    const solid = found && solidify(found);
    if (solid) seeds.set(param, solid);
  }
  return seeds;
}
