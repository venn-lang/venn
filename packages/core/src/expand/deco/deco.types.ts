import type { Block, DecoDecl } from "../../generated/ast.js";
import type { Problem } from "../../problem/index.js";
import type { TargetKind } from "../handles/index.js";
import type { DecoEnv } from "./deco-env.js";

/**
 * A `deco`'s parameter list, read as what it means: the first parameter is the
 * thing decorated and its type is what may be decorated; the rest are the
 * decorator's own arguments, bound from `@name(…)`.
 */
export interface DecoSignature {
  /** The name the body calls its target by. */
  readonly target: string;
  /** The kinds the declared type allows. Several when it is a union. */
  readonly kinds: readonly TargetKind[];
  /** The remaining parameter names, in the order `@name(…)` fills them. */
  readonly args: readonly string[];
}

/** A signature that reads, or the one-line reason it does not. */
export type SignatureResult =
  | { readonly ok: true; readonly signature: DecoSignature }
  | { readonly ok: false; readonly title: string };

/**
 * A `pub deco` another file exported, with the file it was written in.
 *
 * The uri travels with the declaration because a fault in it (a signature that
 * does not read, a verb its kind has not got) belongs to the line that wrote it,
 * not to the line that imported it.
 */
export interface ImportedDeco {
  readonly decl: DecoDecl;
  readonly uri: string;
}

/** Everything running one decorator's body needs. */
export interface DecoBodyArgs {
  readonly body: Block;
  readonly env: DecoEnv;
  readonly uri: string;
  readonly reject: (problem: Problem) => void;
}
